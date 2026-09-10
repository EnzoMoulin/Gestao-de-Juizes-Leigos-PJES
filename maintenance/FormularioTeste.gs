// Copie junto com PrepararPlanilha.gs para o projeto separado de manutenção.
// Nunca implante este projeto como Web App.
function cargosFormulario_() {
  return ['Magistrada ou Magistrado', 'Assessora ou Assessor', 'Juíza Leiga ou Juiz Leigo'];
}

// Converte respostas antigas para os mesmos valores usados pelos filtros da planilha.
function normalizarCargoFormulario_(valor) {
  const cargo = String(valor || '').trim();
  if (cargosFormulario_().includes(cargo)) return cargo;
  const antigos = {
    'Magistrado(a)': 'Magistrada ou Magistrado',
    'Assessor(a)': 'Assessora ou Assessor',
    'Juiz Leigo': 'Juíza Leiga ou Juiz Leigo',
    'Juíza Leiga': 'Juíza Leiga ou Juiz Leigo'
  };
  if (Object.prototype.hasOwnProperty.call(antigos, cargo)) return antigos[cargo];
  throw new Error('Cargo não reconhecido.');
}

// Atualiza somente as opções da pergunta existente. Não exclui respostas ou itens.
function atualizarCargosFormulario_(form) {
  const perguntas = form.getItems().filter(item => item.getTitle().trim() === JL_CONFIG.HEADERS.FUNCTION);
  if (perguntas.length !== 1) throw new Error('A pergunta Cargo ou Função deve existir uma única vez.');
  if (perguntas[0].getType() !== FormApp.ItemType.LIST) {
    throw new Error('A pergunta Cargo ou Função deve ser uma lista suspensa. Nenhuma pergunta foi substituída.');
  }
  const item = perguntas[0].asListItem();
  const cargos = cargosFormulario_();
  const atuais = item.getChoices().map(choice => choice.getValue());
  if (JSON.stringify(atuais) !== JSON.stringify(cargos)) item.setChoiceValues(cargos);
}

function autorizarFormulario_() {
  const email = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  const admins = propriedadeObrigatoria_('ADMIN_EMAILS').split(/[;,\n]+/).map(v => v.trim().toLowerCase());
  if (!email || !email.endsWith('@' + dominioInstitucional_()) || !admins.includes(email)) {
    throw new Error('A conta executora deve ser institucional e estar em ADMIN_EMAILS.');
  }
}

function fonteFormulario_() {
  const p = PropertiesService.getScriptProperties();
  const id = propriedadeObrigatoria_('SPREADSHEET_ID');
  const nome = String(p.getProperty('SOURCE_SHEET') || JL_CONFIG.SOURCE_SHEET).trim();

  // O formulário fica preso ao destino validado na instalação.
  if (p.getProperty('TEST_FORM_ID') &&
      (p.getProperty('TEST_FORM_SPREADSHEET_ID') !== id ||
       p.getProperty('TEST_FORM_SOURCE_SHEET') !== nome)) {
    throw new Error('O destino mudou desde a instalação do formulário. Restaure as propriedades antes de continuar.');
  }

  const book = SpreadsheetApp.openById(id);
  const sheet = book.getSheetByName(nome);

  if (!sheet || !sheet.getLastColumn()) {
    throw new Error('Aba de origem ausente ou vazia: ' + nome);
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(normalizarCabecalhoOrigem_);

  Object.values(JL_CONFIG.HEADERS).forEach(title => {
    if (headers.indexOf(title) < 0 || headers.indexOf(title) !== headers.lastIndexOf(title)) {
      throw new Error('Cabeçalho ausente ou duplicado: ' + title);
    }
  });

  if (headers.filter(v => v === 'FORM_RESPONSE_ID').length > 1) {
    throw new Error('FORM_RESPONSE_ID duplicado.');
  }

  return {
    book: book,
    sheet: sheet,
    headers: headers,
    nome: nome
  };
}

function prepararFormularioTeste() {
  autorizarFormulario_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const source = fonteFormulario_();
    const p = PropertiesService.getScriptProperties();

    let id = p.getProperty('TEST_FORM_ID');
    let form;

    if (id) {
      if (p.getProperty('TEST_FORM_READY') !== 'TRUE') {
        throw new Error(
          'Criação anterior incompleta. Confira o formulário TEST_FORM_ID antes de tentar uma nova instalação.'
        );
      }

      form = FormApp.openById(id);

      if (!destinoFormularioCorreto_(form, source.book)) {
        throw new Error('O destino de respostas do formulário foi alterado.');
      }

    } else {
      form = FormApp.create('CONECTA JULES — Formulário de teste');
      form.setAcceptingResponses(false);

      id = form.getId();

      p.setProperties({
        TEST_FORM_ID: id,
        TEST_FORM_SPREADSHEET_ID: source.book.getId(),
        TEST_FORM_SOURCE_SHEET: source.nome
      });

      form.setDescription(
        'Homologação do fluxo formulário → planilha → site. Use dados fictícios. ' +
        'Para a unidade, informe a demanda; para juiz leigo, informe a disponibilidade.'
      );

      form.setConfirmationMessage(
        'Resposta registrada. A integração atualizará a planilha e o site após o processamento.'
      );

      // E-mail explícito mantém o título esperado, independentemente do idioma do Forms.
      form.addTextItem()
        .setTitle(JL_CONFIG.HEADERS.EMAIL)
        .setRequired(true)
        .setValidation(
          FormApp.createTextValidation()
            .requireTextIsEmail()
            .build()
        );

      form.addTextItem()
        .setTitle(JL_CONFIG.HEADERS.NAME)
        .setRequired(true);

      form.addTextItem()
        .setTitle(JL_CONFIG.HEADERS.PHONE);

      // Cargos padronizados.
      form.addListItem()
        .setTitle(JL_CONFIG.HEADERS.FUNCTION)
        .setRequired(true)
        .setChoiceValues([
          'Magistrada ou Magistrado',
          'Assessora ou Assessor',
          'Juíza Leiga ou Juiz Leigo'
        ]);

      form.addTextItem()
        .setTitle(JL_CONFIG.HEADERS.UNIT)
        .setRequired(true)
        .setHelpText(
          'Unidade: local que receberá o auxílio. ' +
          'Juiz leigo: unidade de vínculo ou Sem vínculo.'
        );

      form.addTextItem()
        .setTitle(JL_CONFIG.HEADERS.CAPACITY)
        .setRequired(true)
        .setHelpText(
          'Unidade: quantidade solicitada. ' +
          'Juiz leigo: capacidade disponível no mês. ' +
          'Informe um inteiro positivo.'
        )
        .setValidation(
          FormApp.createTextValidation()
            .requireTextMatchesPattern('^[1-9][0-9]*$')
            .build()
        );

      [
        'CASES',
        'GUIDANCE',
        'PREFERRED_JUDGE',
        'SUBJECTS',
        'PRODUCTIVITY',
        'SKILLS'
      ].forEach(key => {
        form.addParagraphTextItem()
          .setTitle(JL_CONFIG.HEADERS[key]);
      });

      // Forms cria uma aba própria de respostas brutas.
      // SOURCE_SHEET não é renomeada.
      form.setDestination(
        FormApp.DestinationType.SPREADSHEET,
        source.book.getId()
      );

      p.setProperty('TEST_FORM_READY', 'TRUE');
    }

    atualizarCargosFormulario_(form);
    ajustarCamposFormulario_(form);

    const triggers = ScriptApp.getProjectTriggers().filter(t =>
      t.getHandlerFunction() === 'receberRespostaFormulario' &&
      t.getTriggerSourceId() === id
    );

    if (!triggers.length) {
      ScriptApp
        .newTrigger('receberRespostaFormulario')
        .forForm(form)
        .onFormSubmit()
        .create();
    }

    if (!source.headers.includes('FORM_RESPONSE_ID')) {
      const col = source.sheet.getLastColumn() + 1;

      if (source.sheet.getMaxColumns() < col) {
        source.sheet.insertColumnsAfter(
          source.sheet.getMaxColumns(),
          1
        );
      }

      source.sheet
        .getRange(1, col)
        .setValue('FORM_RESPONSE_ID');
    }

    registrarFormularioNaPlanilha_(source, form);

    // O administrador revisa publicação e permissões de respondentes antes de abrir.
    const result = {
      formulario: form.getPublishedUrl(),
      editar: form.getEditUrl(),
      planilha: source.book.getUrl(),
      abaDoSite: source.nome
    };

    console.log(JSON.stringify(result));

    return result;

  } finally {
    lock.releaseLock();
  }
}

function receberRespostaFormulario(evento) {
  autorizarFormulario_();

  const p = PropertiesService.getScriptProperties();

  if (
    !evento ||
    !evento.source ||
    evento.source.getId() !== p.getProperty('TEST_FORM_ID') ||
    !evento.response
  ) {
    throw new Error('Execute pelo gatilho do formulário configurado.');
  }

  importarRespostaFormulario_(evento.response);
}

function importarRespostaFormulario_(response) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const source = fonteFormulario_();
    const idIndex = source.headers.indexOf('FORM_RESPONSE_ID');
    const responseId = String(response.getId() || '');

    if (idIndex < 0 || !responseId) {
      throw new Error('Integração não preparada ou resposta sem identificador.');
    }

    const count = source.sheet.getLastRow() - 1;

    if (
      count > 0 &&
      source.sheet
        .getRange(2, idIndex + 1, count, 1)
        .getDisplayValues()
        .some(row => row[0] === responseId)
    ) {
      return false;
    }

    const answers = {};

    response.getItemResponses().forEach(item => {
      const title = item.getItem().getTitle().trim();

      if (Object.prototype.hasOwnProperty.call(answers, title)) {
        throw new Error('Pergunta duplicada: ' + title);
      }

      const resposta = item.getResponse();
      answers[title] = (Array.isArray(resposta) ? resposta.join(', ') : String(resposta == null ? '' : resposta)).trim();
    });

    const h = JL_CONFIG.HEADERS;
    const emailColetado = typeof response.getRespondentEmail === 'function' ? response.getRespondentEmail() : '';
    answers[h.EMAIL] = String(emailColetado || answers[h.EMAIL] || '').trim().toLowerCase();

    if (
      !answers[h.NAME] ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[h.EMAIL] || '')
    ) {
      throw new Error('Nome ou e-mail inválido.');
    }

    answers[h.FUNCTION] = normalizarCargoFormulario_(answers[h.FUNCTION]);
    const quantidade = answers[h.CAPACITY] || '';
    const juiz = answers[h.FUNCTION] === 'Juíza Leiga ou Juiz Leigo';
    if ((juiz && !quantidade) || (quantidade && !/^[1-9][0-9]*$/.test(quantidade))) {
      throw new Error('Quantidade inválida. Juiz leigo deve informar um inteiro positivo; para a unidade, o campo é opcional.');
    }

    // Unidade obrigatória para magistratura e assessoria.
    // Para juiz(a) leigo(a), permanece a regra de permitir "Sem vínculo".
    if (
      ['Magistrada ou Magistrado', 'Assessora ou Assessor'].includes(
        answers[h.FUNCTION]
      ) &&
      !answers[h.UNIT]
    ) {
      throw new Error(
        'Informe a unidade judiciária na resposta antes de reprocessar.'
      );
    }

    const values = source.headers.map(title => {
      // Campos de gestão jamais são importados de respostas do usuário.
      if (title === h.TIMESTAMP) {
        return response.getTimestamp();
      }

      if (title === h.STATUS) {
        return 'Pendente';
      }

      if (title === 'FORM_RESPONSE_ID') {
        return responseId;
      }

      if (
        [
          h.ASSIGNED_JUDGE,
          h.ASSIGNED_AT,
          h.NOTES
        ].includes(title)
      ) {
        return '';
      }

      const value = Object.values(h).includes(title)
        ? (answers[title] || '')
        : '';

      // Proteção contra fórmula/injeção de fórmula na planilha.
      return /^[=+\-@\t\r]/.test(value)
        ? "'" + value
        : value;
    });

    const nextRow = source.sheet.getLastRow() + 1;

    if (nextRow > source.sheet.getMaxRows()) {
      source.sheet.insertRowsAfter(
        source.sheet.getMaxRows(),
        1
      );
    }

    source.sheet
      .getRange(nextRow, 1, 1, values.length)
      .setValues([values]);

    SpreadsheetApp.flush();

    return true;

  } finally {
    lock.releaseLock();
  }
}

// Recupera falhas de gatilho sem duplicar respostas já importadas.
function reprocessarRespostasFormularioTeste() {
  autorizarFormulario_();
  fonteFormulario_();

  const form = FormApp.openById(
    propriedadeObrigatoria_('TEST_FORM_ID')
  );

  let importadas = 0;
  let falhas = 0;

  form.getResponses().forEach(response => {
    try {
      if (importarRespostaFormulario_(response)) {
        importadas++;
      }
    } catch (error) {
      falhas++;
      console.error(
        'Resposta ' + response.getId() + ': ' + error.message
      );
    }
  });

  console.log(
    JSON.stringify({
      importadas: importadas,
      falhas: falhas
    })
  );

  return {
    importadas: importadas,
    falhas: falhas
  };
}

// Não depende de propriedades do projeto do site:
// ambos leem a mesma planilha.
function registrarFormularioNaPlanilha_(source, form) {
  let sheet = source.book.getSheetByName('JL_FORMULARIO');

  if (sheet && sheet.getLastRow()) {
    const headers = sheet
      .getRange(1, 1, 1, 2)
      .getDisplayValues()[0];

    if (
      headers[0] !== 'CHAVE' ||
      headers[1] !== 'VALOR'
    ) {
      throw new Error(
        'A aba JL_FORMULARIO já existe com outra estrutura. ' +
        'Nenhum metadado foi substituído.'
      );
    }
  }

  if (!sheet) {
    sheet = source.book.insertSheet('JL_FORMULARIO');
  }

  const rows = [
    ['CHAVE', 'VALOR'],
    ['FORM_URL', form.getPublishedUrl()],
    ['SPREADSHEET_ID', source.book.getId()],
    ['SOURCE_SHEET', source.nome]
  ];

  sheet
    .getRange(1, 1, rows.length, 2)
    .setValues(rows);
}

function diagnosticarFormularioTeste() {
  autorizarFormulario_();

  const source = fonteFormulario_();

  const form = FormApp.openById(
    propriedadeObrigatoria_('TEST_FORM_ID')
  );

  const idIndex = source.headers.indexOf('FORM_RESPONSE_ID');
  const count = source.sheet.getLastRow() - 1;

  const imported = new Set(
    idIndex >= 0 && count > 0
      ? source.sheet
          .getRange(2, idIndex + 1, count, 1)
          .getDisplayValues()
          .map(row => row[0])
          .filter(Boolean)
      : []
  );

  const responses = form.getResponses();

  const pendentes = responses.filter(
    response => !imported.has(String(response.getId()))
  ).length;

  const triggers = ScriptApp.getProjectTriggers().filter(t =>
    t.getHandlerFunction() === 'receberRespostaFormulario' &&
    t.getTriggerSourceId() === form.getId()
  );

  const result = {
    formulario: form.getPublishedUrl(),
    planilha: source.book.getUrl(),
    abaDoSite: source.nome,
    destinoCorreto: destinoFormularioCorreto_(form, source.book),
    integracaoPorGatilho: PropertiesService.getScriptProperties().getProperty('TEST_FORM_TRIGGER_ONLY') === 'TRUE',
    aceitaRespostas: form.isAcceptingResponses(),
    gatilhosDaConta: triggers.length,
    respostasNoFormulario: responses.length,
    importadasDesteFormulario: responses.length - pendentes,
    pendentesDeImportacao: pendentes
  };

  console.log(JSON.stringify(result));

  return result;
}

/**
 * Ajusta os campos de texto do formulário de teste já criado.
 * Não converte itens, não altera seções e não exclui respostas.
 */
function ajustarCamposFormulario_(form) {
  const h = JL_CONFIG.HEADERS;
  const regras = [
    [h.UNIT, false, 'Obrigatório para solicitação da unidade. Juiz leigo pode deixar em branco.'],
    [h.CAPACITY, false, 'Juiz leigo: informe a capacidade mensal como inteiro positivo. Unidade: preenchimento opcional.'],
    [h.PHONE, true, 'Informe seu telefone para contato.']
  ];
  const itens = form.getItems();
  const encontrados = regras.map(regra => {
    const matches = itens.filter(item => item.getTitle().trim() === regra[0]);
    if (matches.length > 1) throw new Error('Pergunta duplicada: ' + regra[0]);
    return {regra: regra, item: matches[0]};
  });
  encontrados.forEach(({regra, item}) => {
    // Formulários oficiais podem ter unidade como lista e navegação por seções.
    // As regras condicionais desses itens permanecem com o administrador do Forms.
    if (item && item.getType() === FormApp.ItemType.TEXT) {
      const texto = item.asTextItem().setRequired(regra[1]).setHelpText(regra[2]);
      if (regra[0] === h.CAPACITY) {
        texto.setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[1-9][0-9]*$').build());
      }
    }
  });
}


// No modo exclusivo, somente o gatilho escreve na aba usada pelo site.
function destinoFormularioCorreto_(form, book) {
  const exclusivo = PropertiesService.getScriptProperties().getProperty('TEST_FORM_TRIGGER_ONLY') === 'TRUE';
  return exclusivo ? !obterDestinoFormulario_(form) : obterDestinoFormulario_(form) === book.getId();
}

/**
 * Recuperação específica da planilha Teste de 19 colunas (A:S).
 * Preserva todas as linhas e posições; corrige apenas M1 e N1.
 * Execute antes de reprocessarRespostasFormularioTeste().
 */
function recuperarIntegracaoTeste() {
  autorizarFormulario_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = PropertiesService.getScriptProperties();
    const id = propriedadeObrigatoria_('SPREADSHEET_ID');
    const nome = String(p.getProperty('SOURCE_SHEET') || JL_CONFIG.SOURCE_SHEET).trim();
    if (id !== '1mkPVag7GJPdSbQoJMvjv2J5SvwmRgtxy73xr_WHKbek' || nome !== 'Respostas ao formulário 1' ||
        p.getProperty('TEST_FORM_SPREADSHEET_ID') !== id || p.getProperty('TEST_FORM_SOURCE_SHEET') !== nome) {
      throw new Error('Recuperação permitida somente na planilha Teste e no destino já configurado.');
    }
    const book = SpreadsheetApp.openById(id);
    const sheet = book.getSheetByName(nome);
    if (!sheet) throw new Error('Aba de teste ausente.');
    const h = JL_CONFIG.HEADERS;
    const esperado = [h.TIMESTAMP, h.EMAIL, h.NAME, h.PHONE, h.FUNCTION, h.UNIT,
      h.CASES, h.GUIDANCE, h.PREFERRED_JUDGE, h.CAPACITY, h.SUBJECTS, h.PRODUCTIVITY,
      h.STATUS, 'E-mail adicional (preservado)', h.NOTES, h.SKILLS,
      h.ASSIGNED_JUDGE, h.ASSIGNED_AT, 'FORM_RESPONSE_ID'];
    const atual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(normalizarCabecalhoOrigem_);
    if (atual.length !== esperado.length || atual.some((v, i) =>
      i === 12 ? ![h.STATUS, h.SKILLS].includes(v) :
      i === 13 ? ![h.EMAIL, esperado[i]].includes(v) : v !== esperado[i])) {
      throw new Error('A estrutura mudou. Nenhuma coluna foi alterada; revise os cabeçalhos A:S.');
    }
    const count = sheet.getLastRow() - 1;
    if (count > 0 && sheet.getRange(2, 13, count, 1).getDisplayValues().some(row =>
      !['', 'Pendente', 'Em atendimento', 'Concluído', 'Cancelado'].includes(String(row[0]).trim()))) {
      throw new Error('A coluna M contém valores diferentes dos status esperados. Nenhum cabeçalho foi alterado.');
    }
    const form = FormApp.openById(propriedadeObrigatoria_('TEST_FORM_ID'));
    if (form.getPublishedUrl().split('?')[0] !== 'https://docs.google.com/forms/d/e/1FAIpQLSenUp7ShEu8a13psWqG7on_Ru5gSox4hgADY1HL_Pxymevw4A/viewform') {
      throw new Error('O formulário configurado não é o formulário de teste autorizado.');
    }
    const destino = obterDestinoFormulario_(form);
    const vinculo = sheet.getFormUrl();
    if (destino && (destino !== id || !vinculo || FormApp.openByUrl(vinculo).getId() !== form.getId())) {
      throw new Error('O vínculo nativo não aponta para esta aba e este formulário. Nenhum vínculo foi removido.');
    }
    if (!destino && vinculo) throw new Error('A aba está vinculada a outro formulário.');
    const triggers = ScriptApp.getProjectTriggers().filter(t =>
      t.getHandlerFunction() === 'receberRespostaFormulario' && t.getTriggerSourceId() === form.getId());
    // Garante o importador antes de desligar a escrita nativa concorrente.
    if (!triggers.length) ScriptApp.newTrigger('receberRespostaFormulario').forForm(form).onFormSubmit().create();
    // Registrar primeiro permite retomar após falha parcial. As respostas permanecem no Forms.
    p.setProperty('TEST_FORM_TRIGGER_ONLY', 'TRUE');
    if (destino) form.removeDestination();
    if (obterDestinoFormulario_(form) || sheet.getFormUrl()) {
      throw new Error('O vínculo ainda não foi liberado. Execute recuperarIntegracaoTeste novamente.');
    }
    sheet.getRange(1, 13, 1, 2).setValues([[esperado[12], esperado[13]]]);
    SpreadsheetApp.flush();
    fonteFormulario_();
    console.log('Cabeçalhos corrigidos; respostas preservadas. Execute reprocessarRespostasFormularioTeste e depois diagnosticarFormularioTeste.');
    return {cabecalhosCorrigidos: true, integracaoPorGatilho: true, abaDoSite: nome};
  } finally { lock.releaseLock(); }
}


// O serviço lança esta exceção específica quando o vínculo já foi removido.
// Erros de acesso, autorização e falhas do serviço continuam sendo propagados.
function obterDestinoFormulario_(form) {
  try {
    return form.getDestinationId() || null;
  } catch (error) {
    const mensagem = String(error && error.message || error).replace(/^Exception:\s*/, '').trim();
    if (mensagem === 'The form currently has no response destination.') return null;
    throw error;
  }
}
