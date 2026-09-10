const fs = require('fs'), vm = require('vm'), assert = require('assert');
let email = 'admin@tjes.jus.br', releases = 0;
const props = {ADMIN_EMAILS: email, SPREADSHEET_ID: 'book', TEST_FORM_ID: 'form', TEST_FORM_SPREADSHEET_ID: 'book', TEST_FORM_SOURCE_SHEET: 'Respostas ao formulário 1'};
const rows = [];
const sheet = {
  getLastColumn: () => rows[0].length, getLastRow: () => rows.length, getMaxRows: () => 100,
  getRange(r, c, n = 1, m = 1) { return {
    getDisplayValues: () => rows.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + m).map(String)),
    setValues(values) { values.forEach((row, i) => { rows[r - 1 + i] = row; }); }
  }; }
};
const context = vm.createContext({console, Session: {getEffectiveUser: () => ({getEmail: () => email})},
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || ''})},
  SpreadsheetApp: {openById: () => ({getSheetByName: () => sheet}), flush() {}},
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() { releases++; }})}
});
for (const file of ['maintenance/PrepararPlanilha.gs', 'maintenance/FormularioTeste.gs', 'src/Data.gs']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const h = context.JL_CONFIG.HEADERS;
rows.push([...Object.values(h).reverse(), 'FORM_RESPONSE_ID']); // Order must not matter.
function response(id, overrides = {}) {
  const a = {[h.EMAIL]: 'teste@tjes.jus.br', [h.NAME]: '=formula', [h.FUNCTION]: 'Magistrado(a)', [h.UNIT]: 'Unidade TESTE', [h.CAPACITY]: '12', [h.STATUS]: 'Concluído', [h.ASSIGNED_JUDGE]: 'Injetado', ...overrides};
  return {getId: () => id, getTimestamp: () => new Date('2026-09-09'), getItemResponses: () => Object.entries(a).map(([title, value]) => ({getItem: () => ({getTitle: () => title}), getResponse: () => value}))};
}
const event = r => ({source: {getId: () => 'form'}, response: r});
context.receberRespostaFormulario(event(response('r1')));
assert.equal(rows.length, 2);
const value = key => rows[1][rows[0].indexOf(h[key])];
assert.equal(value('NAME'), "'=formula"); assert.equal(value('STATUS'), 'Pendente'); assert.equal(value('ASSIGNED_JUDGE'), '');
context.receberRespostaFormulario(event(response('r1'))); assert.equal(rows.length, 2);
context.receberRespostaFormulario(event(response('r2', {[h.FUNCTION]: 'Juíza Leiga'}))); assert.equal(rows.length, 3);
context.normalizarNome_ = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const map = Object.fromEntries(rows[0].map((v, i) => [v, i]));
assert(context.ehSolicitacao_(rows[1], map)); assert(context.ehJuizLeigo_(rows[2], map));
assert.throws(() => context.receberRespostaFormulario(event(response('r3', {[h.FUNCTION]: 'Outro'}))), /Cargo/);
assert.throws(() => context.receberRespostaFormulario(event(response('r3', {[h.UNIT]: ''}))), /unidade/);
assert.throws(() => context.receberRespostaFormulario(event(response('r3', {[h.CAPACITY]: '-1'}))), /Quantidade/);
assert.throws(() => context.receberRespostaFormulario({source: {getId: () => 'other'}, response: response('r3')}), /gatilho/);
email = 'visitor@tjes.jus.br'; assert.throws(() => context.receberRespostaFormulario(event(response('r3'))), /conta executora/);
email = props.ADMIN_EMAILS; props.SPREADSHEET_ID = 'other'; assert.throws(() => context.receberRespostaFormulario(event(response('r3'))), /destino mudou/);
assert.equal(rows.length, 3); assert(releases >= 7);
console.log('Forms tests passed: mapping, classification, deduplication, protected fields, formula escaping, validation, authorization and destination binding.');
// Metadata must bind the respondent link to the exact source and allow only Forms URLs.
vm.runInContext(fs.readFileSync('src/FormIntegration.gs', 'utf8'), context);
let metadata = [['CHAVE','VALOR'],['FORM_URL','https://docs.google.com/forms/d/e/test/viewform'],['SPREADSHEET_ID','book'],['SOURCE_SHEET','Source']];
const metaBook = {getId: () => 'book', getSheetByName: () => ({getLastRow: () => metadata.length, getRange: () => ({getDisplayValues: () => metadata})})};
const metaSource = {getName: () => 'Source'};
assert.equal(context.diagnosticoFormulario_(metaBook, metaSource).configurado, true);
metadata[1][1] = 'javascript:alert(1)'; assert.equal(context.diagnosticoFormulario_(metaBook, metaSource).configurado, false);
metadata[1][1] = 'https://docs.google.com/forms/d/e/test/viewform'; metadata[3][1] = 'Outra aba';
assert.equal(context.diagnosticoFormulario_(metaBook, metaSource).configurado, false);
assert.equal(context.diagnosticoFormulario_({getSheetByName: () => null}, metaSource).configurado, false);
console.log('Form metadata tests passed: destination binding, missing configuration and unsafe URLs.');
// Exact supplied layout: quantity G, processes H, guidance I, preference J;
// the supplied M heading contains status values, not skills.
props.SPREADSHEET_ID = 'book';
rows.length = 0;
const originalLayout = Object.values(h);
assert.equal(originalLayout[6], h.CAPACITY);
assert.equal(originalLayout[7], h.CASES);
assert.equal(originalLayout[8], h.GUIDANCE);
assert.equal(originalLayout[9], h.PREFERRED_JUDGE);
originalLayout[12] = 'Competências necessárias — coluna duplicada (revisar)';
rows.push([...originalLayout, 'FORM_RESPONSE_ID']);
context.receberRespostaFormulario(event(response('modelo', {
  [h.CASES]: 'PROCESSO TESTE', [h.GUIDANCE]: 'ORIENTAÇÃO TESTE',
  [h.PREFERRED_JUDGE]: 'PREFERÊNCIA TESTE', [h.SKILLS]: 'MATÉRIA TESTE'
})));
assert.equal(rows[1][6], '12');
assert.equal(rows[1][7], 'PROCESSO TESTE');
assert.equal(rows[1][8], 'ORIENTAÇÃO TESTE');
assert.equal(rows[1][9], 'PREFERÊNCIA TESTE');
assert.equal(rows[1][12], 'Pendente');
assert.equal(rows[1][14], 'MATÉRIA TESTE');
assert.equal(rows[1][17], 'modelo');
assert.equal(rows[0][12], 'Competências necessárias — coluna duplicada (revisar)');
const mapped = context.mapaCabecalhos_(sheet);
assert.equal(mapped[h.STATUS], 12);
assert.equal(mapped[h.SKILLS], 14);
rows[1][12] = 'Concluído';
assert.equal(context.statusNormalizado_(context.valor_(rows[1], mapped, 'STATUS')), 'Concluído');
context.receberRespostaFormulario(event(response('modelo')));
assert.equal(rows.length, 2); assert.equal(rows[1][12], 'Concluído');
rows[0].push(h.STATUS);
assert.throws(() => context.mapaCabecalhos_(sheet), /duplicado/);
assert.throws(() => context.fonteFormulario_(), /duplicado/);
console.log('Original layout tests passed: all positions, legacy status, existing data preserved and ambiguous status rejected.');
// Canonical options match the exact-match FILTER formulas in the workbook.
rows.length = 0;
rows.push([...Object.values(h), 'FORM_RESPONSE_ID']);
const roles = [
  ['Magistrado(a)', 'Magistrada ou Magistrado'],
  ['Assessor(a)', 'Assessora ou Assessor'],
  ['Juiz Leigo', 'Juíza Leiga ou Juiz Leigo'],
  ['Juíza Leiga', 'Juíza Leiga ou Juiz Leigo'],
  ['Magistrada ou Magistrado', 'Magistrada ou Magistrado'],
  ['Assessora ou Assessor', 'Assessora ou Assessor'],
  ['Juíza Leiga ou Juiz Leigo', 'Juíza Leiga ou Juiz Leigo']
];
roles.forEach(([input, expected], index) => {
  context.receberRespostaFormulario(event(response('role-' + index, {[h.FUNCTION]: input})));
  assert.equal(rows[index + 1][4], expected);
});
for (const role of ['Magistrado(a)', 'Assessor(a)', 'Magistrada ou Magistrado', 'Assessora ou Assessor']) {
  assert.throws(() => context.receberRespostaFormulario(event(response('no-unit-' + role, {[h.FUNCTION]: role, [h.UNIT]: ''}))), /unidade/);
}
context.receberRespostaFormulario(event(response('judge-no-unit', {[h.FUNCTION]: 'Juíza Leiga ou Juiz Leigo', [h.UNIT]: ''})));
let choices = ['Juiz Leigo'], choiceWrites = 0;
const question = {getTitle: () => h.FUNCTION, getType: () => 'LIST', asListItem() {return this;}, getChoices: () => choices.map(value => ({getValue: () => value})), setChoiceValues(values) {choices = Array.from(values); choiceWrites++;}};
context.FormApp = {ItemType: {LIST: 'LIST'}};
context.atualizarCargosFormulario_({getItems: () => [question]});
assert.deepEqual(choices, ['Magistrada ou Magistrado', 'Assessora ou Assessor', 'Juíza Leiga ou Juiz Leigo']);
context.atualizarCargosFormulario_({getItems: () => [question]});
assert.equal(choiceWrites, 1, 'repeat setup should not rewrite unchanged choices');
assert.throws(() => context.atualizarCargosFormulario_({getItems: () => []}), /uma única vez/);
assert.throws(() => context.atualizarCargosFormulario_({getItems: () => [question, question]}), /uma única vez/);
assert.throws(() => context.atualizarCargosFormulario_({getItems: () => [{...question, getType: () => 'TEXT'}]}), /lista suspensa/);
assert.equal(choiceWrites, 1);
console.log('Role tests passed: old/new submissions, unit validation, existing-form update and repeated setup.');
// Official form: collected email and unit request without the judge-only capacity.
rows.length = 0;
const liveLayout = Object.values(h).filter(v => v !== h.CAPACITY);
liveLayout.splice(9, 0, h.CAPACITY);
liveLayout.splice(13, 0, 'E-mail adicional (preservado)');
rows.push([...liveLayout, 'FORM_RESPONSE_ID']);
const requestWithoutCapacity = response('official-unit', {
  [h.FUNCTION]: 'Magistrada ou Magistrado', [h.EMAIL]: '', [h.CAPACITY]: '',
  [h.SKILLS]: ['Juizado Especial Cível', 'Juizado Especial Criminal']
});
requestWithoutCapacity.getRespondentEmail = () => 'Teste@tjes.jus.br';
context.receberRespostaFormulario(event(requestWithoutCapacity));
assert.equal(rows[1][1], 'teste@tjes.jus.br');
assert.equal(rows[1][9], '');
assert.equal(rows[1][12], 'Pendente');
assert.equal(rows[1][13], '');
assert.equal(rows[1][15], 'Juizado Especial Cível, Juizado Especial Criminal');
const officialMap = context.mapaCabecalhos_(sheet);
assert(context.ehSolicitacao_(rows[1], officialMap));
assert.throws(() => context.receberRespostaFormulario(event(response('judge-missing-capacity', {[h.FUNCTION]: 'Juíza Leiga ou Juiz Leigo', [h.CAPACITY]: ''}))), /Quantidade/);
context.receberRespostaFormulario(event(response('official-judge', {[h.FUNCTION]: 'Juíza Leiga ou Juiz Leigo', [h.UNIT]: '', [h.CAPACITY]: '20'})));
assert(context.ehJuizLeigo_(rows[2], officialMap));
assert.equal(rows[2][9], '20');
context.receberRespostaFormulario(event(requestWithoutCapacity));
assert.equal(rows.length, 3);
console.log('Official form tests passed: collected email, optional unit quantity, checkbox values, 19-column source and website classification.');
// Historic questions retained outside respondent routes still map to canonical columns.
rows.length = 0; rows.push([...Object.values(h), 'FORM_RESPONSE_ID']);
context.receberRespostaFormulario(event(response('historic-layout', {
  [h.SKILLS]: '', ['[Histórico] ' + h.SKILLS]: 'Juizado Especial Cível'
})));
assert.equal(rows[1][rows[0].indexOf(h.SKILLS)], 'Juizado Especial Cível');
console.log('Archived question responses still import without empty-answer collisions.');
