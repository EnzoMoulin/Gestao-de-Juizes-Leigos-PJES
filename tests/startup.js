const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const strip = html => html.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
const guard = strip(fs.readFileSync('src/Startup.html', 'utf8'));
const app = strip(fs.readFileSync('src/App.html', 'utf8'));
// Compile the complete script, including event binding and boot().
new vm.Script(app, {filename: 'App.html'});
function setup() {
  const elements = {loading: {hidden: false}, app: {hidden: true}, login: {hidden: true}, loginError: {textContent: ''}};
  const listeners = {};
  let timeout;
  vm.runInNewContext(guard, {
    window: {addEventListener: (name, fn) => { listeners[name] = fn; }},
    document: {getElementById: id => elements[id]},
    setTimeout(fn) { timeout = fn; }
  });
  return {elements, listeners, expire: () => timeout()};
}
let s = setup();
s.listeners.error({message: "Uncaught SyntaxError: Unexpected identifier 'input'"});
assert(s.elements.loading.hidden);
assert(!s.elements.login.hidden);
assert.match(s.elements.loginError.textContent, /Unexpected identifier 'input'/);
s = setup(); s.expire(); assert(s.elements.loading.hidden);
s = setup(); s.listeners.unhandledrejection({reason: new Error('Falha de conexão')});
assert.match(s.elements.loginError.textContent, /Falha de conexão/);
s = setup(); s.elements.app.hidden = false;
s.listeners.error({message: 'Erro após login'}); s.expire();
assert.equal(s.elements.login.hidden, true, 'must not interrupt an initialized application');
s = setup(); s.elements.loading.hidden = true; s.elements.loginError.textContent = 'Acesso negado'; s.expire();
assert.equal(s.elements.loginError.textContent, 'Acesso negado', 'must preserve the actual authentication error');
const index = fs.readFileSync('src/index.html', 'utf8');
assert(index.indexOf("include_('Startup')") < index.indexOf("include_('App')"));
console.log('Startup tests passed: full syntax, independent error display, timeout and preservation of login state.');
