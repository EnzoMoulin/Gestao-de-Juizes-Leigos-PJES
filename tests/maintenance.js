const fs=require('fs'),vm=require('vm'),assert=require('assert');
let email='admin@tjes.jus.br',writes=0;
const props={ADMIN_EMAILS:email,SPREADSHEET_ID:'fixture'};
const sheets=new Map();
function sheet(headers){return {getLastRow:()=>headers.length?1:0,getLastColumn:()=>headers.length,getMaxColumns:()=>30,setFrozenRows(){},getRange:()=>({getDisplayValues:()=>[headers],setValues:values=>{headers=values[0];writes++;}})};}
const book={getName:()=> 'Teste',getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=sheet([]);sheets.set(n,s);return s;}};
const c=vm.createContext({console,Session:{getEffectiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||''})},SpreadsheetApp:{openById:()=>book,flush(){}}});
vm.runInContext(fs.readFileSync('maintenance/PrepararPlanilha.gs','utf8'),c);
const headers=vm.runInContext('Object.values(JL_CONFIG.HEADERS)',c);
sheets.set('Respostas ao formulário 1',sheet(headers));
email='';assert.throws(()=>c.prepararPlanilha(),/conta executora/);assert.equal(writes,0);
email='viewer@tjes.jus.br';assert.throws(()=>c.prepararPlanilha(),/conta executora/);assert.equal(writes,0);
email=props.ADMIN_EMAILS;
sheets.set('AUDITORIA',sheet(['Incompatível']));assert.throws(()=>c.prepararPlanilha(),/incompatíveis/);assert.equal(writes,0);
sheets.delete('AUDITORIA');c.prepararPlanilha();assert.equal(writes,3);c.prepararPlanilha();assert.equal(writes,6);
assert.equal(sheets.size,4);
console.log('Maintenance tests passed: authorization, preflight and repeated setup.');
