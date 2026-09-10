// Projeto de manutenção, junto com FormularioTeste.gs e PrepararPlanilha.gs.
function atualizarFormularioPorCargo() {
  autorizarFormulario_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const p = PropertiesService.getScriptProperties();
    const source = fonteFormulario_();
    const form = FormApp.openById(propriedadeObrigatoria_('TEST_FORM_ID'));
    if (form.getPublishedUrl().split('?')[0] !== 'https://docs.google.com/forms/d/e/1FAIpQLSenUp7ShEu8a13psWqG7on_Ru5gSox4hgADY1HL_Pxymevw4A/viewform') throw new Error('Formulário de teste incorreto.');
    if (p.getProperty('TEST_FORM_TRIGGER_ONLY') !== 'TRUE' || !destinoFormularioCorreto_(form, source.book)) throw new Error('Execute recuperarIntegracaoTeste primeiro.');
    const h = JL_CONFIG.HEADERS;
    const materias = ['Juizado Especial Cível','Juizado Especial Criminal','Juizado Especial da Fazenda Pública'];
    const titulos = ['Indicação dos processos e orientações para elaboração das minutas.',
      'Indicação da meta de produtividade e de eventuais afinidades por matéria.', 'Histórico de perguntas substituídas'];
    const itens = form.getItems();
    const buscar = title => form.getItems().filter(i => i.getTitle().trim() === title);
    const cargo = buscar(h.FUNCTION);
    if (cargo.length !== 1 || cargo[0].getType() !== FormApp.ItemType.LIST) throw new Error('Cargo ou Função deve ser uma única lista.');
    const keys = ['UNIT','CASES','SKILLS','GUIDANCE','PREFERRED_JUDGE','CAPACITY','SUBJECTS','PRODUCTIVITY'];
    const metodos = {TEXT:'asTextItem',PARAGRAPH_TEXT:'asParagraphTextItem',LIST:'asListItem',CHECKBOX:'asCheckboxItem'};
    keys.forEach(k => {
      const a = buscar(h[k]);
      if (a.length > 1 || a.some(i => !metodos[String(i.getType())])) throw new Error('Pergunta ambígua ou tipo inesperado: ' + h[k]);
    });
    if (itens.slice(cargo[0].getIndex()+1).some(i => !keys.some(k => i.getTitle().trim() === h[k]) && !i.getTitle().startsWith('[Histórico] ') && !titulos.includes(i.getTitle()))) throw new Error('Há perguntas ou seções adicionais após Cargo. Revise antes de reorganizar.');
    titulos.forEach(t => { const a=buscar(t); if (a.length>1 || a.some(i=>i.getType()!==FormApp.ItemType.PAGE_BREAK)) throw new Error('Seção ambígua: '+t); });
    let unidades = null;
    if (p.getProperty('TEST_FORM_UNIDADES_JSON')) {
      unidades = JSON.parse(p.getProperty('TEST_FORM_UNIDADES_JSON'));
      if (!Array.isArray(unidades) || !unidades.length || unidades.some(v=>typeof v!=='string'||!v.trim()) || new Set(unidades).size!==unidades.length) throw new Error('TEST_FORM_UNIDADES_JSON deve conter uma lista JSON de unidades únicas.');
    }
    const aberto = form.isAcceptingResponses();
    if (!p.getProperty('TEST_FORM_LAYOUT_RESTORE_OPEN')) p.setProperty('TEST_FORM_LAYOUT_RESTORE_OPEN',aberto?'TRUE':'FALSE');
    form.setAcceptingResponses(false);
    // Falha parcial mantém fechado. Nova execução retoma sem excluir perguntas.
    const converter = i => i[metodos[String(i.getType())]]();
    const secao = titulo => buscar(titulo).length ? buscar(titulo)[0].asPageBreakItem() : form.addPageBreakItem().setTitle(titulo);
    const unidadePage=secao(titulos[0]), juizPage=secao(titulos[1]), historicoPage=secao(titulos[2]);
    const obter = (key,tipo,obrigatorio) => {
      let item=buscar(h[key])[0];
      if (item && String(item.getType())!==tipo) {
        converter(item).setRequired(false).setTitle('[Histórico] '+h[key]); item=null;
      }
      if (!item) {
        const criar={TEXT:'addTextItem',PARAGRAPH_TEXT:'addParagraphTextItem',LIST:'addListItem',CHECKBOX:'addCheckboxItem'};
        item=form[criar[tipo]]().setTitle(h[key]);
      }
      return converter(item).setRequired(obrigatorio).setHelpText('');
    };
    const unidadeAntiga=buscar(h.UNIT)[0];
    const unidadeLista=!!unidades || !!(unidadeAntiga && unidadeAntiga.getType()===FormApp.ItemType.LIST);
    const unidade=obter('UNIT',unidadeLista?'LIST':'TEXT',true);
    if (unidades) unidade.setChoiceValues(unidades);
    const processos=obter('CASES','PARAGRAPH_TEXT',false);
    const skills=obter('SKILLS','CHECKBOX',false).setChoiceValues(materias);
    const orientacoes=obter('GUIDANCE','PARAGRAPH_TEXT',false);
    const preferido=obter('PREFERRED_JUDGE','TEXT',false);
    const quantidade=obter('CAPACITY','TEXT',true).setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[1-9][0-9]*$').build());
    const assuntos=obter('SUBJECTS','CHECKBOX',false).setChoiceValues(materias);
    const observacoes=obter('PRODUCTIVITY','PARAGRAPH_TEXT',false);
    const ordem=[unidadePage,unidade,processos,skills,orientacoes,preferido,juizPage,quantidade,assuntos,observacoes,historicoPage];
    const inicio=cargo[0].getIndex()+1;
    ordem.forEach((item,i)=>form.moveItem(item.getIndex(),inicio+i));
    // Cada quebra configura o término da seção ANTERIOR.
    juizPage.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    historicoPage.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    const lista=cargo[0].asListItem();
    lista.setChoices([lista.createChoice('Magistrada ou Magistrado',unidadePage),lista.createChoice('Assessora ou Assessor',unidadePage),lista.createChoice('Juíza Leiga ou Juiz Leigo',juizPage)]);
    p.setProperty('TEST_FORM_LAYOUT_BY_ROLE','TRUE');
    if (p.getProperty('TEST_FORM_LAYOUT_RESTORE_OPEN')==='TRUE') form.setAcceptingResponses(true);
    p.deleteProperty('TEST_FORM_LAYOUT_RESTORE_OPEN');
    const resultado={formulario:form.getPublishedUrl(),editar:form.getEditUrl(),navegacaoPorCargo:true,unidadeEmLista:unidadeLista,primeiraPartePreservada:true};
    console.log(JSON.stringify(resultado));
    if (!unidadeLista) console.log('Pendente: lista oficial de unidades. Campo de texto mantido; configure TEST_FORM_UNIDADES_JSON e execute novamente.');
    return resultado;
  } finally { lock.releaseLock(); }
}
