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
