const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const props = { SPREADSHEET_ID:'fixture', ADMIN_EMAILS:'admin@tjes.jus.br', ALLOWED_EMAILS:'viewer@tjes.jus.br' };
let active = 'admin@tjes.jus.br';
let writes = 0;
const ctx = vm.createContext({ console, PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||''})}, Session:{getActiveUser:()=>({getEmail:()=>active}),getScriptTimeZone:()=> 'America/Sao_Paulo'}, Utilities:{formatDate:d=>d.toISOString().slice(0,10),DigestAlgorithm:{SHA_256:1},computeDigest:()=>[],base64EncodeWebSafe:()=> 'hash'}, LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})} });
for(const name of ['Config','Management','Data','Auth','Users','API']) vm.runInContext(fs.readFileSync('src/'+name+'.gs','utf8'),ctx);
const run = code => vm.runInContext(code,ctx);
const headers = run('JL_CONFIG.HEADERS');
const titles = Object.values(headers);
function row(cargo, name, status='') {const r=titles.map(()=> '');r[titles.indexOf(headers.FUNCTION)]=cargo;r[titles.indexOf(headers.NAME)]=name;r[titles.indexOf(headers.STATUS)]=status;return r;}
const rows = Array.from({length:6},(_,i)=>row('Juiz Leigo','Juiz '+i));
const source = {getName:()=>props.SOURCE_SHEET||'Respostas ao formulário 1',getSheetId:()=>0,getLastRow:()=>rows.length+1,getLastColumn:()=>titles.length,getRange:(r,c,n)=>({getDisplayValues:()=>r===1?[titles]:rows.slice(r-2,r-2+n),getValues:()=>rows.slice(r-2,r-2+n),setValue:()=>writes++})};
const auxiliary={getLastRow:()=>0};
const book={getName:()=> 'Origem de teste',getId:()=> 'fixture',getUrl:()=> 'https://docs.google.com/spreadsheets/d/fixture/edit',getSheetByName:n=>n==='USUARIOS'?null:n==='GESTAO_SOLICITACOES'||n==='AUDITORIA'?auxiliary:n===(props.SOURCE_SHEET||'Respostas ao formulário 1')?source:null};
ctx.SpreadsheetApp={openById:id=>{assert.equal(id,'fixture');return book;}};
const data=()=>run('listarDados_({email:"admin@tjes.jus.br",perfil:"ADMIN"})');
assert.equal(data().juizes.length,6);
rows.push(row('Juiza   Leiga','Sétima'));
assert.equal(data().juizes.length,7);
assert.equal(data().fonte.respostas,7);
rows.push(row('Assessor','Pedido'),row('Juiz Leigo','Encerrado','concluido'),row('Outra função','Ignorado'),row('Juiz Leigo','Revisar','status inesperado'));
assert.equal(data().solicitacoes.length,1);
assert.equal(data().fonte.juizesEncerrados,1);
assert.equal(data().fonte.totalIgnoradas,1);
assert.equal(data().fonte.statusDesconhecidos.length,1);
assert.equal(run('listarDados_({email:"viewer@tjes.jus.br",perfil:"CONSULTA"}).fonte'),null);
assert.equal(run('listarDados_({email:"viewer@tjes.jus.br",perfil:"CONSULTA"}).solicitacoes.length'),0);
props.SOURCE_SHEET='Outra aba';assert.equal(data().fonte.aba,'Outra aba');
assert.throws(()=>run('validarGestao_("Alta","2026-02-31")'),/Prazo inválido/);
assert.doesNotThrow(()=>run('validarGestao_("Alta","2028-02-29")'));
assert.throws(()=>run('atualizarSolicitacao_({email:"admin@tjes.jus.br",perfil:"ADMIN"},9,"Pendente","","Alta","2026-02-31")'),/Prazo inválido/);
assert.equal(writes,0,'invalid deadline must not modify source');
// Maintenance wrappers must compute a role before authorizing.
run('verificarConfiguracao_ = function(){return "validada";}');
assert.equal(run('verificarConfiguracao()'),'validada');
active='viewer@tjes.jus.br';assert.throws(()=>run('verificarConfiguracao()'),/administrador/);
ctx.CacheService={getScriptCache:()=>({get:()=>JSON.stringify({email:'admin@tjes.jus.br',perfil:'ADMIN'})})};
assert.throws(()=>run('exigirSessao_("token")'),/outra conta/);
assert.throws(()=>run('garantirCabecalhos_({getLastRow:()=>2,getLastColumn:()=>1,getName:()=>"USUARIOS",getRange:()=>({getDisplayValues:()=>[["ERRADO"]]})},["EMAIL"])'),/incompatíveis/);

// Private editor maintenance uses only the authorized executor, not a web fallback.
active='';
let effective='admin@tjes.jus.br';
ctx.Session.getEffectiveUser=()=>({getEmail:()=>effective});
run('instalarEstruturasAuxiliares_ = function(){ __installations++; return "instalada"; }');
ctx.__installations=0;
assert.equal(run('prepararProjetoNoEditor_()'),'validada');
assert.equal(ctx.__installations,1);
assert.throws(()=>run('instalarEstruturasAuxiliares()'),/identificar/);
assert.throws(()=>run('verificarConfiguracao()'),/identificar/);
assert.throws(()=>run('apiLogin()'),/identificar/);
for (const email of ['', 'viewer@tjes.jus.br', 'admin@example.com']) {
  effective=email;
  assert.throws(()=>run('prepararProjetoNoEditor_()'),/conta executora/);
}
assert.equal(ctx.__installations,1,'unauthorized maintenance must not install');
effective='admin@tjes.jus.br';
const originalMap=ctx.mapaCabecalhos_;
ctx.mapaCabecalhos_=()=>{throw new Error('Origem inválida');};
assert.throws(()=>run('prepararProjetoNoEditor_()'),/Origem inválida/);
assert.equal(ctx.__installations,1,'invalid source must not install');
ctx.mapaCabecalhos_=originalMap;

// Evaluate the real UI with a small DOM stub; no live Google requests.
const elements = new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,textContent:'',innerHTML:'',addEventListener(){}});return elements.get(id);};
const ui=vm.createContext({window:{},document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null},setInterval(){},setTimeout(){},clearTimeout(){}});
const app=fs.readFileSync('src/App.html','utf8').replace(/^<script>/,'').replace(/<\/script>\s*$/,'').replace(/boot\(\);\s*$/,'');
vm.runInContext(app,ui);
assert.equal(vm.runInContext('esc(\'<img src="x">\')',ui),'&lt;img src=&quot;x&quot;&gt;');
assert.equal(vm.runInContext('csvCell("=1+1")',ui),'"\'=1+1"');
assert.match(vm.runInContext('safeText("https://example.com/?a=1&b=2")',ui),/href="https:\/\/example.com\/\?a=1&amp;b=2"/);
assert.ok(!vm.runInContext('safeText(\'<img src=x onerror="alert(1)">\')',ui).includes('<img'));
assert.equal(vm.runInContext('storage("sessionStorage","getItem","x")',ui),null);
vm.runInContext('state.token="x";server=async()=>{throw new Error("Sessão ausente ou expirada.");}',ui);
(async()=>{await assert.rejects(vm.runInContext('loadData()',ui),/Sessão/);assert.equal(vm.runInContext('state.token',ui),'');console.log('Regression tests passed: appended responses, source, roles, dates, safe rendering, CSV and expired session.');})().catch(error=>{console.error(error);process.exitCode=1;});
