// Copie junto com PrepararPlanilha.gs para o projeto separado de manutenção.
// Nunca implante este projeto como Web App.
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
      (p.getProperty('TEST_FORM_SPREADSHEET_ID') !== id || p.getProperty('TEST_FORM_SOURCE_SHEET') !== nome)) {
    throw new Error('O destino mudou desde a instalação do formulário. Restaure as propriedades antes de continuar.');
  }
  const book = SpreadsheetApp.openById(id);
  const sheet = book.getSheetByName(nome);
  if (!sheet || !sheet.getLastColumn()) throw new Error('Aba de origem ausente ou vazia: ' + nome);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(normalizarCabecalhoOrigem_);
  Object.values(JL_CONFIG.HEADERS).forEach(title => {
    if (headers.indexOf(title) < 0 || headers.indexOf(title) !== headers.lastIndexOf(title)) {
      throw new Error('Cabeçalho ausente ou duplicado: ' + title);
    }
  });
  if (headers.filter(v => v === 'FORM_RESPONSE_ID').length > 1) throw new Error('FORM_RESPONSE_ID duplicado.');
  return {book: book, sheet: sheet, headers: headers, nome: nome};
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
      if (p.getProperty('TEST_FORM_READY') !== 'TRUE') throw new Error('Criação anterior incompleta. Confira o formulário TEST_FORM_ID antes de tentar uma nova instalação.');
      form = FormApp.openById(id);
      if (form.getDestinationId() !== source.book.getId()) throw new Error('O destino de respostas do formulário foi alterado.');
    } else {
      form = FormApp.create('CONECTA JULES — Formulário de teste');
      form.setAcceptingResponses(false);
      id = form.getId();
      p.setProperties({TEST_FORM_ID: id, TEST_FORM_SPREADSHEET_ID: source.book.getId(), TEST_FORM_SOURCE_SHEET: source.nome});
      form.setDescription('Homologação do fluxo formulário → planilha → site. Use dados fictícios. Para a unidade, informe a demanda; para juiz leigo, informe a disponibilidade.');
      form.setConfirmationMessage('Resposta registrada. A integração atualizará a planilha e o site após o processamento.');
      // E-mail explícito mantém o título esperado, independentemente do idioma do Forms.
      form.addTextItem().setTitle(JL_CONFIG.HEADERS.EMAIL).setRequired(true)
        .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
      form.addTextItem().setTitle(JL_CONFIG.HEADERS.NAME).setRequired(true);
      form.addTextItem().setTitle(JL_CONFIG.HEADERS.PHONE);
      form.addListItem().setTitle(JL_CONFIG.HEADERS.FUNCTION).setRequired(true)
        .setChoiceValues(['Magistrado(a)', 'Assessor(a)', 'Juiz Leigo', 'Juíza Leiga']);
      form.addTextItem().setTitle(JL_CONFIG.HEADERS.UNIT).setRequired(true)
        .setHelpText('Unidade: local que receberá o auxílio. Juiz leigo: unidade de vínculo ou Sem vínculo.');
      form.addTextItem().setTitle(JL_CONFIG.HEADERS.CAPACITY).setRequired(true)
        .setHelpText('Unidade: quantidade solicitada. Juiz leigo: capacidade disponível no mês. Informe um inteiro positivo.')
        .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[1-9][0-9]*$').build());
      ['CASES', 'GUIDANCE', 'PREFERRED_JUDGE', 'SUBJECTS', 'PRODUCTIVITY', 'SKILLS'].forEach(key => {
        form.addParagraphTextItem().setTitle(JL_CONFIG.HEADERS[key]);
      });
      // Forms cria uma aba própria de respostas brutas. SOURCE_SHEET não é renomeada.
      form.setDestination(FormApp.DestinationType.SPREADSHEET, source.book.getId());
      p.setProperty('TEST_FORM_READY', 'TRUE');
    }
    const triggers = ScriptApp.getProjectTriggers().filter(t =>
      t.getHandlerFunction() === 'receberRespostaFormulario' && t.getTriggerSourceId() === id);
    if (!triggers.length) ScriptApp.newTrigger('receberRespostaFormulario').forForm(form).onFormSubmit().create();
    if (!source.headers.includes('FORM_RESPONSE_ID')) {
      const col = source.sheet.getLastColumn() + 1;
      if (source.sheet.getMaxColumns() < col) source.sheet.insertColumnsAfter(source.sheet.getMaxColumns(), 1);
      source.sheet.getRange(1, col).setValue('FORM_RESPONSE_ID');
    }
    registrarFormularioNaPlanilha_(source, form);
    // O administrador revisa publicação e permissões de respondentes antes de abrir.
    const result = {formulario: form.getPublishedUrl(), editar: form.getEditUrl(), planilha: source.book.getUrl(), abaDoSite: source.nome};
    console.log(JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

function receberRespostaFormulario(evento) {
  autorizarFormulario_();
  const p = PropertiesService.getScriptProperties();
  if (!evento || !evento.source || evento.source.getId() !== p.getProperty('TEST_FORM_ID') || !evento.response) {
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
    if (idIndex < 0 || !responseId) throw new Error('Integração não preparada ou resposta sem identificador.');
    const count = source.sheet.getLastRow() - 1;
    if (count > 0 && source.sheet.getRange(2, idIndex + 1, count, 1).getDisplayValues().some(row => row[0] === responseId)) return false;
    const answers = {};
    response.getItemResponses().forEach(item => {
      const title = item.getItem().getTitle();
      if (Object.prototype.hasOwnProperty.call(answers, title)) throw new Error('Pergunta duplicada: ' + title);
      answers[title] = String(item.getResponse() || '').trim();
    });
    const h = JL_CONFIG.HEADERS;
    if (!answers[h.NAME] || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[h.EMAIL] || '')) throw new Error('Nome ou e-mail inválido.');
    if (!['Magistrado(a)', 'Assessor(a)', 'Juiz Leigo', 'Juíza Leiga'].includes(answers[h.FUNCTION])) throw new Error('Cargo não reconhecido.');
    if (!/^[1-9][0-9]*$/.test(answers[h.CAPACITY] || '')) throw new Error('Quantidade inválida.');
    if (['Magistrado(a)', 'Assessor(a)'].includes(answers[h.FUNCTION]) && !answers[h.UNIT]) throw new Error('Informe a unidade judiciária na resposta antes de reprocessar.');
    const values = source.headers.map(title => {
      // Campos de gestão jamais são importados de respostas do usuário.
      if (title === h.TIMESTAMP) return response.getTimestamp();
      if (title === h.STATUS) return 'Pendente';
      if (title === 'FORM_RESPONSE_ID') return responseId;
      if ([h.ASSIGNED_JUDGE, h.ASSIGNED_AT, h.NOTES].includes(title)) return '';
      const value = Object.values(h).includes(title) ? (answers[title] || '') : '';
      return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
    });
    const nextRow = source.sheet.getLastRow() + 1;
    if (nextRow > source.sheet.getMaxRows()) source.sheet.insertRowsAfter(source.sheet.getMaxRows(), 1);
    source.sheet.getRange(nextRow, 1, 1, values.length).setValues([values]);
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

// Recupera falhas de gatilho sem duplicar respostas já importadas.
function reprocessarRespostasFormularioTeste() {
  autorizarFormulario_();
  fonteFormulario_();
  const form = FormApp.openById(propriedadeObrigatoria_('TEST_FORM_ID'));
  let importadas = 0, falhas = 0;
  form.getResponses().forEach(response => {
    try { if (importarRespostaFormulario_(response)) importadas++; }
    catch (error) { falhas++; console.error('Resposta ' + response.getId() + ': ' + error.message); }
  });
  console.log(JSON.stringify({importadas: importadas, falhas: falhas}));
  return {importadas: importadas, falhas: falhas};
}

// Não depende de propriedades do projeto do site: ambos leem a mesma planilha.
function registrarFormularioNaPlanilha_(source, form) {
  let sheet = source.book.getSheetByName('JL_FORMULARIO');
  if (sheet && sheet.getLastRow()) {
    const headers = sheet.getRange(1, 1, 1, 2).getDisplayValues()[0];
    if (headers[0] !== 'CHAVE' || headers[1] !== 'VALOR') throw new Error('A aba JL_FORMULARIO já existe com outra estrutura. Nenhum metadado foi substituído.');
  }
  if (!sheet) sheet = source.book.insertSheet('JL_FORMULARIO');
  const rows = [['CHAVE', 'VALOR'], ['FORM_URL', form.getPublishedUrl()],
    ['SPREADSHEET_ID', source.book.getId()], ['SOURCE_SHEET', source.nome]];
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
}

function diagnosticarFormularioTeste() {
  autorizarFormulario_();
  const source = fonteFormulario_();
  const form = FormApp.openById(propriedadeObrigatoria_('TEST_FORM_ID'));
  const idIndex = source.headers.indexOf('FORM_RESPONSE_ID');
  const count = source.sheet.getLastRow() - 1;
  const imported = new Set(idIndex >= 0 && count > 0 ? source.sheet.getRange(2, idIndex + 1, count, 1).getDisplayValues().map(row => row[0]).filter(Boolean) : []);
  const responses = form.getResponses();
  const pendentes = responses.filter(response => !imported.has(String(response.getId()))).length;
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'receberRespostaFormulario' && t.getTriggerSourceId() === form.getId());
  const result = {formulario: form.getPublishedUrl(), planilha: source.book.getUrl(), abaDoSite: source.nome,
    destinoCorreto: form.getDestinationId() === source.book.getId(), aceitaRespostas: form.isAcceptingResponses(),
    gatilhosDaConta: triggers.length, respostasNoFormulario: responses.length,
    importadasDesteFormulario: responses.length - pendentes, pendentesDeImportacao: pendentes};
  console.log(JSON.stringify(result));
  return result;
}
