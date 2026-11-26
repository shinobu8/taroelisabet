'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const runtime=fs.readFileSync(path.join(__dirname,'dist/i18n.js'),'utf8');
const translations=fs.readFileSync(path.join(__dirname,'dist/translations.js'),'utf8');
const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'localization-source.json'),'utf8'));
function boot(options={}) {
  const events={},docEvents={},store=options.store||new Map(options.language?[['elisabet-language',options.language]]:[]);
  function element(tag,attrs={},children=[]){return {nodeType:1,tagName:tag,attrs:{...attrs},childNodes:children,dataset:{},listeners:{},value:'',hasAttribute(k){return k in this.attrs;},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.listeners[k]=f;}};}
  const textNode={nodeType:3,nodeValue:' Астрология '};
  const input=element('INPUT',{'placeholder':'Поиск по темам','aria-label':'Язык сайта'});
  const header=element('HEADER',{},[textNode,input]);
  const root=element('HTML',{'data-theme':'dark'});
  const meta=element('META',{content:'ELISABET — на одной орбите с собой'});
  const select=element('SELECT');
  const document={readyState:options.loading?'loading':'complete',documentElement:root,
    querySelector(s){if(s==='.header')return header;if(s==='meta[property="og:title"]')return meta;return null;},
    querySelectorAll(s){return s==='[data-language-select]'?[select]:[];},addEventListener(k,f){docEvents[k]=f;}};
  const window={localStorage:{getItem(k){if(options.blocked)throw Error('blocked');return store.get(k)??null;},setItem(k,v){if(options.blocked)throw Error('blocked');store.set(k,v);}},addEventListener(k,f){(events[k]??=[]).push(f);},dispatchEvent(event){for(const f of events[event.type]||[])f(event);}};
  class CustomEvent{constructor(type,init){this.type=type;Object.assign(this,init);}}
  const ctx={window,document,CustomEvent,console,Date};vm.createContext(ctx);vm.runInContext(translations,ctx);vm.runInContext(runtime,ctx);
  return {window,document,events,docEvents,root,input,meta,select,textNode,store,ctx,L:window.ELISABET_I18N};
}
const app=boot();assert.equal(app.L.language,'ru');assert.equal(app.root.attrs.lang,'ru');
for(const language of ['en','uk','be','ru']){
  app.L.setLanguage(language);
  assert.equal(app.root.attrs.lang,language);assert.equal(app.select.value,language);assert.equal(app.root.attrs['data-theme'],'dark');
  assert.equal(app.textNode.nodeValue,' '+app.L.t('Астрология')+' ');
  assert.equal(app.input.attrs.placeholder,app.L.t('Поиск по темам'));
  assert.equal(app.meta.attrs.content,app.L.t('ELISABET — на одной орбите с собой'));
}
assert.equal(app.textNode.nodeValue,' Астрология ','Switching back restores the original source, not a reverse translation');
for(const language of ['en','uk','be']){
  const state=boot({language});assert.equal(state.L.language,language);
  const dictionary=state.window.ELISABET_TRANSLATIONS[language];
  for(const key of corpus)assert.ok(typeof dictionary[key]==='string'&&dictionary[key].length,key);
  const html=state.L.markup('<option value="Овен">Овен</option><img alt="Натальная карта — тематическая символическая иллюстрация">');
  assert.ok(html.includes('value="Овен"'),'Canonical option values must not be translated');
  assert.ok(html.includes('>'+state.L.t('Овен')+'</option>'));
  assert.ok(html.includes('alt="'+state.L.t('Натальная карта — тематическая символическая иллюстрация')+'"'));
  assert.ok(state.L.t('Показано {shown} из {total}',{shown:12,total:66}).includes('12'));
  assert.ok(!state.L.t('Показано {shown} из {total}',{shown:12,total:66}).includes('{'));
  state.L.setLanguage('ru');state.select.listeners.change({target:{value:language}});assert.equal(state.store.get('elisabet-language'),language);
  assert.equal(boot({store:state.store}).L.language,language,'Language preference survives reload');
}
const english=boot({language:'en'});assert.equal(english.L.locale,'en-GB');
assert.ok(!/[А-Яа-яЁё]/.test(english.L.text('День · Маг')));
assert.ok(!/[А-Яа-яЁё]/.test(english.L.text('Показано 12 из 66')));
assert.equal(english.L.markup('<p>1 + 2 = 3</p>'),'<p>1 + 2 = 3</p>');
english.L.setLanguage('unknown');assert.equal(english.L.language,'en');
english.window.dispatchEvent({type:'storage',key:'elisabet-language',newValue:'be'});assert.equal(english.L.language,'be');
english.window.dispatchEvent({type:'storage',key:'elisabet-language',newValue:null});assert.equal(english.L.language,'ru');
const blocked=boot({blocked:true});blocked.L.setLanguage('uk');assert.equal(blocked.L.language,'uk');
const invalid=boot({language:'fr'});assert.equal(invalid.L.language,'ru');
const delayed=boot({language:'en',loading:true});delayed.docEvents.DOMContentLoaded();assert.equal(delayed.root.attrs.lang,'en');
for(const file of ['content.js','reading-data.js','readings.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'dist',file),'utf8'),english.ctx);
english.L.setLanguage('en');
const symbols=/[А-Яа-яЁё]/;
for(const topic of english.window.ELISABET_TOPICS){
  for(const text of [topic.title,topic.subtitle,topic.intro,...topic.sections.flatMap(s=>[s.title,s.text]),...topic.tags])assert.ok(!symbols.test(english.L.text(text)),topic.id+': '+text);
}
const R=english.window.ELISABET_READINGS;
for(const sign of ['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы']){
  for(const horizon of ['day','week','month','year']){
    const reading=R.forecast(sign,horizon,new Date(2027,0,1));
    for(const field of ['focus','text','prompt','practice'])assert.ok(!symbols.test(english.L.text(reading[field])),sign+' '+horizon+' '+field);
    assert.ok(!symbols.test(reading.period.label));
  }
}
for(let day=1;day<=66;day++)for(const context of ['day','love','situation']){
  const reading=R.draw(0,context,new Date(2027,0,day));
  for(const field of ['title','theme','text','prompt','practice'])assert.ok(!symbols.test(english.L.text(reading[field])),reading.title+' '+field);
}
console.log('PASS: complete translation coverage; four languages, stored preferences, static text/attributes/metadata, canonical control values, placeholders, reload/storage failures, all66articles,48forecasts and198reading variants. DOM facade checks only.');
