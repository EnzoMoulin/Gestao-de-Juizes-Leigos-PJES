const fs=require('fs'),vm=require('vm'),assert=require('assert');
const props={TEST_FORM_ID:'test',TEST_FORM_TRIGGER_ONLY:'TRUE'};
const items=[];let accepting=true,seq=0;
class Item {
 constructor(type,title=''){this.type=type;this.title=title;this.id=++seq;items.push(this);}
 getType(){return this.type;} getTitle(){return this.title;} getId(){return this.id;} getIndex(){return items.indexOf(this);}
 setTitle(v){this.title=v;return this;} setRequired(v){this.required=v;return this;} setHelpText(v){this.help=v;return this;}
 setChoiceValues(v){this.values=v;return this;} setValidation(v){this.validation=v;return this;}
 setGoToPage(v){this.go=v;return this;} createChoice(value,page){return {value,page};} setChoices(v){this.choices=v;return this;}
 asTextItem(){assert.equal(this.type,'TEXT');return this;} asParagraphTextItem(){assert.equal(this.type,'PARAGRAPH_TEXT');return this;}
 asListItem(){assert.equal(this.type,'LIST');return this;} asCheckboxItem(){assert.equal(this.type,'CHECKBOX');return this;} asPageBreakItem(){assert.equal(this.type,'PAGE_BREAK');return this;}
}
const form={getItems:()=>items.slice(),getPublishedUrl:()=> 'https://docs.google.com/forms/d/e/1FAIpQLSenUp7ShEu8a13psWqG7on_Ru5gSox4hgADY1HL_Pxymevw4A/viewform',getEditUrl:()=> 'edit',
 isAcceptingResponses:()=>accepting,setAcceptingResponses:v=>{accepting=v;},moveItem:(a,b)=>{items.splice(b,0,items.splice(a,1)[0]);}};
for(const [method,type] of Object.entries({addTextItem:'TEXT',addListItem:'LIST',addParagraphTextItem:'PARAGRAPH_TEXT',addCheckboxItem:'CHECKBOX',addPageBreakItem:'PAGE_BREAK'}))form[method]=()=>new Item(type);
const context=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v,deleteProperty:k=>delete props[k]})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},FormApp:{openById:()=>form,ItemType:{LIST:'LIST',PAGE_BREAK:'PAGE_BREAK'},PageNavigationType:{SUBMIT:'SUBMIT'},createTextValidation:()=>({requireTextMatchesPattern:()=>({build:()=>({})})})}});
vm.runInContext(fs.readFileSync('maintenance/PrepararPlanilha.gs','utf8'),context);
context.autorizarFormulario_=()=>{};context.fonteFormulario_=()=>({book:{}});context.destinoFormularioCorreto_=()=>true;context.propriedadeObrigatoria_=k=>props[k];
vm.runInContext(fs.readFileSync('maintenance/FormularioPorCargo.gs','utf8'),context);
const h=context.JL_CONFIG.HEADERS;
for(const k of ['EMAIL','NAME','PHONE'])new Item('TEXT',h[k]).setRequired(true);
const cargo=new Item('LIST',h.FUNCTION).setRequired(true);
const first=items.slice();
for(const k of ['UNIT','CAPACITY'])new Item('TEXT',h[k]);
for(const k of ['CASES','GUIDANCE','PREFERRED_JUDGE','SUBJECTS','PRODUCTIVITY','SKILLS'])new Item('PARAGRAPH_TEXT',h[k]);
const oldIds=items.map(i=>i.id);
let r=context.atualizarFormularioPorCargo();assert(!r.unidadeEmLista);assert(accepting);
assert.deepEqual(items.slice(0,4),first);
assert.equal(cargo.choices[0].page,cargo.choices[1].page);assert.notEqual(cargo.choices[0].page,cargo.choices[2].page);
const find=k=>items.find(i=>i.title===h[k]);
assert.equal(find('CAPACITY').required,true);assert.equal(find('UNIT').required,true);
assert.equal(find('SKILLS').type,'CHECKBOX');assert.equal(find('SUBJECTS').values.length,3);
assert.equal(cargo.choices[2].page.go,'SUBMIT');
const archive=items.find(i=>i.title==='Histórico de perguntas substituídas');assert.equal(archive.go,'SUBMIT');
assert(items.filter(i=>i.title.startsWith('[Histórico] ')).every(i=>i.getIndex()>archive.getIndex()&&!i.required));
assert(oldIds.every(id=>items.some(i=>i.id===id)));
const count=items.length;context.atualizarFormularioPorCargo();assert.equal(items.length,count);
props.TEST_FORM_UNIDADES_JSON=JSON.stringify(['Unidade de teste']);r=context.atualizarFormularioPorCargo();assert(r.unidadeEmLista);assert.equal(find('UNIT').type,'LIST');
console.log('Layout: first page preserved, role routes, section submission, archive preservation, rerun and unit list conversion passed.');
