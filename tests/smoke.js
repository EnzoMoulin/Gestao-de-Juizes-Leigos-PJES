const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const properties = {
  SPREADSHEET_ID: 'spreadsheet-test',
  ALLOWED_EMAILS: 'primeiro@tjes.jus.br; SEGUNDO@TJES.JUS.BR',
  ADMIN_EMAILS: 'primeiro@tjes.jus.br',
  INSTITUTIONAL_DOMAIN: 'tjes.jus.br',
  SEND_NOTIFICATIONS: 'TRUE'
};
const userRows = [['gestor@tjes.jus.br', 'Pessoa Gestora', 'GESTOR', 'TRUE', '04/09/2026']];
const userSheet = {
  getLastRow: () => userRows.length + 1,
  getRange: () => ({ getDisplayValues: () => userRows })
};
const spreadsheet = { getSheetByName: name => name === 'USUARIOS' ? userSheet : null };
const sentEmails = [];
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] || '' }) },
  SpreadsheetApp: { openById: () => spreadsheet },
  Session: {
    getActiveUser: () => ({ getEmail: () => 'primeiro@tjes.jus.br' }),
    getScriptTimeZone: () => 'America/Sao_Paulo'
  },
  Utilities: {
    formatDate: date => date.toISOString().slice(0, 10),
    computeDigest: () => [],
    base64EncodeWebSafe: () => 'hash',
    getUuid: () => 'uuid'
  },
  MailApp: { sendEmail: options => sentEmails.push(options) }
});

for (const file of ['Config.gs', 'Management.gs', 'Data.gs', 'Auth.gs', 'Users.gs', 'API.gs', 'Main.gs']) {
  vm.runInContext(fs.readFileSync('src/' + file, 'utf8'), context, { filename: file });
}
const call = expression => vm.runInContext(expression, context);

assert.strictEqual(call('JSON.stringify(emailsPermitidos_())'), '["primeiro@tjes.jus.br","segundo@tjes.jus.br"]');
assert.strictEqual(call("emailAutorizado_('gestor@tjes.jus.br')"), true);
assert.strictEqual(call("perfilUsuario_({email:'gestor@tjes.jus.br'})"), 'GESTOR');
assert.strictEqual(call('identidadeWorkspace_().email'), 'primeiro@tjes.jus.br');
context.Session.getActiveUser = () => ({ getEmail: () => 'naoautorizado@tjes.jus.br' });
assert.throws(() => call('identidadeWorkspace_()'), /não está autorizada/);

assert.strictEqual(call("textoCelulaSeguro_('texto comum')"), 'texto comum');
assert.strictEqual(call("textoCelulaSeguro_('=IMPORTXML(\"x\")')"), "'=IMPORTXML(\"x\")");
assert.strictEqual(call("statusNormalizado_('')"), 'Pendente');
assert.strictEqual(call("numeroQuantidade_('20 minutas')"), 20);
assert.strictEqual(call("normalizarNome_('João Ávila')"), 'joao avila');
assert.strictEqual(call("dataIso_(new Date('2026-09-04T12:00:00Z'))"), '2026-09-04');

const headers = call('JL_CONFIG.HEADERS');
const map = {};
Object.values(headers).forEach((header, index) => { map[header] = index; });
context.__map = map;
context.__row = Array(Object.keys(headers).length).fill('');
context.__row[map[headers.FUNCTION]] = 'Juíza Leiga ou Juiz Leigo';
assert.strictEqual(call('ehJuizLeigo_(__row, __map)'), true);
context.__row[map[headers.FUNCTION]] = 'Assessora ou Assessor';
assert.strictEqual(call('ehSolicitacao_(__row, __map)'), true);

const notification = call("enviarNotificacao_('destino@tjes.jus.br','Assunto','Corpo')");
assert.strictEqual(notification.enviada, true);
assert.strictEqual(sentEmails.length, 1);
assert.strictEqual(call("enviarNotificacao_('externo@example.com','Assunto','Corpo').enviada"), false);

const styles = fs.readFileSync('src/Styles.html', 'utf8');
const indexHtml = fs.readFileSync('src/index.html', 'utf8');
const appHtml = fs.readFileSync('src/App.html', 'utf8');
assert.match(styles, /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
assert.match(indexHtml, /id="tutorialPanel"/);
assert.match(indexHtml, /id="adminPanel"/);
assert.match(indexHtml, /id="detailsDialog"/);
assert.match(indexHtml, /Designar juiz e iniciar atendimento/);
assert.match(appHtml, /exportRequests/);
assert.match(appHtml, /apiHistoricoSolicitacao/);
assert.match(appHtml, /apiSalvarUsuario/);
const apiCode = fs.readFileSync('src/API.gs', 'utf8');
assert.match(apiCode, /function instalarEstruturasAuxiliares\(\)/);
assert.match(apiCode, /function verificarConfiguracao\(\)/);

const appScript = appHtml.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
assert.doesNotThrow(() => new Function(appScript));

console.log('Smoke tests passed.');
