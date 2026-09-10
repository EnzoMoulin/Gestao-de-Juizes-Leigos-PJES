const fs = require('fs'), vm = require('vm'), assert = require('assert');
const id = '1mkPVag7GJPdSbQoJMvjv2J5SvwmRgtxy73xr_WHKbek';
const props = {ADMIN_EMAILS:'admin@tjes.jus.br',SPREADSHEET_ID:id,TEST_FORM_ID:'form',TEST_FORM_SPREADSHEET_ID:id,TEST_FORM_SOURCE_SHEET:'Respostas ao formulário 1'};
let destination = id, linked = true, triggers = [], mutations = 0;
const rows = [];
const sheet = {getLastColumn:()=>rows[0].length,getLastRow:()=>rows.length,getFormUrl:()=>linked?'edit-url':null,
 getRange(r,c,n=1,m=1){return {getDisplayValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m).map(String)),setValues(values){mutations++;values.forEach((row,i)=>row.forEach((v,j)=>rows[r-1+i][c-1+j]=v));}};}};
const book = {getId:()=>id,getSheetByName:()=>sheet};
const form = {getId:()=> 'form',getDestinationId:()=>destination,
 getPublishedUrl:()=> 'https://docs.google.com/forms/d/e/1FAIpQLSenUp7ShEu8a13psWqG7on_Ru5gSox4hgADY1HL_Pxymevw4A/viewform',
 removeDestination(){assert(triggers.length);mutations++;destination=null;linked=false;}};
const context=vm.createContext({console,Session:{getEffectiveUser:()=>({getEmail:()=>props.ADMIN_EMAILS})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;}})},
 SpreadsheetApp:{openById:()=>book,flush(){}},FormApp:{openById:()=>form,openByUrl:()=>form},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:()=>({forForm:()=>({onFormSubmit:()=>({create(){triggers.push({getHandlerFunction:()=> 'receberRespostaFormulario',getTriggerSourceId:()=> 'form'});}})})})}});
for(const path of ['maintenance/PrepararPlanilha.gs','maintenance/FormularioTeste.gs'])vm.runInContext(fs.readFileSync(path,'utf8'),context);
const h=context.JL_CONFIG.HEADERS;
rows.push([h.TIMESTAMP,h.EMAIL,h.NAME,h.PHONE,h.FUNCTION,h.UNIT,h.CASES,h.GUIDANCE,h.PREFERRED_JUDGE,h.CAPACITY,h.SUBJECTS,h.PRODUCTIVITY,h.SKILLS,h.EMAIL,h.NOTES,h.SKILLS,h.ASSIGNED_JUDGE,h.ASSIGNED_AT,'FORM_RESPONSE_ID']);
rows.push(Array(19).fill('')); rows[1][12]='Concluído';rows[1][13]='preservar@tjes.jus.br';rows[1][18]='existing-id';
const before=JSON.stringify(rows.slice(1));
rows[1][12]='Juizado Especial Cível';
assert.throws(()=>context.recuperarIntegracaoTeste(),/coluna M/);assert.equal(mutations,0);
rows[1][12]='Concluído';destination='other';
assert.throws(()=>context.recuperarIntegracaoTeste(),/vínculo/);assert.equal(mutations,0);
destination=id;rows[0][2]='Outra pergunta';
assert.throws(()=>context.recuperarIntegracaoTeste(),/estrutura/);assert.equal(mutations,0);rows[0][2]=h.NAME;
context.recuperarIntegracaoTeste();
assert.equal(rows[0][12],h.STATUS);assert.equal(rows[0][13],'E-mail adicional (preservado)');
assert.equal(JSON.stringify(rows.slice(1)),before);assert.equal(destination,null);
assert(context.destinoFormularioCorreto_(form,book));
context.recuperarIntegracaoTeste();assert.equal(triggers.length,1);assert.equal(JSON.stringify(rows.slice(1)),before);
destination=id;assert(!context.destinoFormularioCorreto_(form,book));
console.log('Recovery tests passed: preservation, repeat execution, trigger installed before unlink, schema/status guards and wrong destination rejected.');
