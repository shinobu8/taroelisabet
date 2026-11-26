'use strict';
// Static integrity + route/interaction smoke test; does not replace visual browser QA.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const root = path.join(__dirname, 'dist');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const calculators = fs.readFileSync(path.join(root, 'calculators.js'), 'utf8');
const readingData = fs.readFileSync(path.join(root, 'reading-data.js'), 'utf8');
const readingEngine = fs.readFileSync(path.join(root, 'readings.js'), 'utf8');
const icons = fs.readFileSync(path.join(root, 'icons.js'), 'utf8');
const languageRuntime=fs.readFileSync(path.join(root,'i18n.js'),'utf8');
const translations=fs.existsSync(path.join(root,'translations.js'))?fs.readFileSync(path.join(root,'translations.js'),'utf8'):'window.ELISABET_TRANSLATIONS={};';
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const f of ['content.js','calculators.js','reading-data.js','readings.js','icons.js','app.js']) cp.execFileSync(process.execPath, ['--check', path.join(root, f)], {stdio:'pipe'});
const topicContext = {window:{}};
vm.createContext(topicContext); vm.runInContext(content, topicContext);
const topics = topicContext.window.ELISABET_TOPICS;
assert.equal(topics.length,66);
assert.equal(new Set(topics.map(t=>t.id)).size,66);
const categories = ['astrology','numerology','matrix','tarot'];
for(const t of topics) {
  assert.match(t.id,/^[a-z0-9-]+$/);
  assert.ok(categories.includes(t.category));
  for(const key of ['title','subtitle','intro']) assert.ok(typeof t[key]==='string' && t[key].length>1, `${t.id}.${key}`);
  assert.ok(Array.isArray(t.sections) && t.sections.length>=2,t.id+' sections');
  t.sections.forEach(s=>assert.ok(s.title && s.text.length>30,t.id+' section content'));
  assert.ok(t.tags.length>0,t.id+' tags');
  assert.ok(fs.existsSync(path.join(root,'assets',t.category+'.svg')));
}
for(const asset of ['hero.svg','astrology.svg','numerology.svg','matrix.svg','tarot.svg','favicon.svg']) {
  const source=fs.readFileSync(path.join(root,'assets',asset),'utf8');
  assert.match(source,/<svg[\s>]/);assert.match(source,/<\/svg>/);
}
assert.ok(html.includes('https://t.me/taroelisabet'));
assert.ok(app.includes("const telegram = 'https://t.me/taroelisabet'"));
assert.ok(!/https:\/\/t\.me\/(?!taroelisabet)[a-zA-Z0-9_]+/.test(html+app));
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) if(!/^https?:/.test(m[1])) assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);

// Small DOM facade supports this app's rendering/event calls and keeps route tests dependency-free.
let document;
class Element {
  constructor(tag,attrs={}) {this.tagName=tag;this.attrs={...attrs};this.id=attrs.id;this.className=attrs.class||'';this.dataset={};for(const [k,v] of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.value=attrs.value||'';this.hidden='hidden' in attrs;this.disabled=false;this.listeners={};this.children=[];this._html='';this.textContent='';this.classList={add:()=>{},remove:()=>{},toggle:()=>{}};}
  set innerHTML(value){this._html=String(value);this.children=parseElements(this._html);this.textContent=this._html.replace(/<[^>]*>/g,'');}
  get innerHTML(){return this._html;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k]??null;}
  hasAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k);}
  get childNodes(){return this.children;}
  click(){if(this.listeners.click)this.listeners.click({target:this});}
  checkValidity(){return true;}
  dispatchEvent(event){if(this.listeners[event.type])this.listeners[event.type](event);return !event.defaultPrevented;}
  removeAttribute(k){delete this.attrs[k];}
  querySelector(selector){if(selector==='h1'){const m=this._html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);if(!m)return null;const e=new Element('h1');e.innerHTML=m[1];return e;}return this.children.find(e=>matches(e,selector))||null;}
  querySelectorAll(selector){return this.children.filter(e=>matches(e,selector));}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){this.focused=true;}
  scrollIntoView(){}
  getBoundingClientRect(){return {left:0,right:1000,top:0,bottom:1000};}
}
function parseElements(source) {const out=[];for(const m of source.matchAll(/<([a-z][\w-]*)(\s[^>]*?)?\/?>/gi)){const attrs={};for(const a of (m[2]||'').matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g))attrs[a[1]]=a[2]??a[3]??a[4]??'';out.push(new Element(m[1],attrs));}return out;}
function matches(e,s){if(s.includes(','))return s.split(',').some(part=>matches(e,part.trim()));if(s.startsWith('.'))return e.className.split(/\s+/).includes(s.slice(1));if(s.startsWith('['))return s.slice(1,-1) in e.attrs;return e.tagName===s;}
const staticElements=parseElements(html);
function allElements(){const walk=arr=>arr.flatMap(e=>[e,...walk(e.children)]);return walk(staticElements);}
const docEvents={};
document={getElementById:id=>allElements().find(e=>e.id===id)||null,querySelector:s=>allElements().find(e=>matches(e,s))||null,querySelectorAll:s=>s.includes(' ')?[]:allElements().filter(e=>matches(e,s)),addEventListener:(n,f)=>docEvents[n]=f,documentElement:{setAttribute(){},classList:{add(){},remove(){}},style:{setProperty(){}}},title:''};
const winEvents={};
const location={hash:'#/'};
const timers=new Map();let timerId=0,clockOverride=null;
class SiteDate extends Date {
  constructor(...args){if(args.length)super(...args);else super(clockOverride===null?Date.now():clockOverride);}
  static now(){return clockOverride===null?Date.now():clockOverride;}
}
const storage=new Map();
const window={addEventListener:(name,fn)=>winEvents[name]=fn,dispatchEvent:event=>{if(winEvents[event.type])winEvents[event.type](event);},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},scrollTo(){},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
const mediaListeners={};
class SiteEvent{constructor(type,options={}){this.type=type;Object.assign(this,options);this.defaultPrevented=false;}preventDefault(){this.defaultPrevented=true;}}
const context={window,document,location,Date:SiteDate,Number,String,Math,Error,Object,console,CustomEvent:SiteEvent,Event:SiteEvent,matchMedia:query=>({matches:true,addEventListener:(name,fn)=>{mediaListeners[query]=fn;}}),requestAnimationFrame:fn=>fn()};
vm.createContext(context);
vm.runInContext(content,context);
vm.runInContext(calculators,context);
vm.runInContext(readingData,context);
vm.runInContext(readingEngine,context);
vm.runInContext(icons,context);
vm.runInContext(translations,context);
vm.runInContext(languageRuntime,context);
vm.runInContext(app,context);
const main=document.getElementById('main');
const assertDrawnSymbols=markup=>assert.ok(!/[\u2648-\u2653\u263e\u2600\u2726\u2727\u273a\u25c7\u2166\u2315\u2715\u2197]/u.test(markup.replace(/<[^>]*>/g,'')),'Decorative symbols must be SVG paths, not emoji-capable text');
const visit=hash=>{location.hash=hash;winEvents.hashchange();assert.ok(main.innerHTML.length>100,hash);assertDrawnSymbols(main.innerHTML);};
assert.ok(main.innerHTML.includes('Всё начинается'));
assertDrawnSymbols(main.innerHTML);assertDrawnSymbols(html);
for(const c of categories) {visit('#/category/'+c);assert.ok(!main.innerHTML.includes('пока не найдена'));}
for(const t of topics) {visit('#/topic/'+t.id);assert.ok(main.innerHTML.includes(t.title.replace(/&/g,'&amp;')),t.id);}
for(const route of ['#/explore','#/daily','#/matrix','#/numbers','#/horoscopes'])visit(route);
visit('#/unknown');assert.ok(main.innerHTML.includes('пока не найдена'));
visit('#/numbers');document.getElementById('birth-date').value='1990-01-01';document.getElementById('number-method').value='life';document.getElementById('birth-form').listeners.submit({preventDefault(){}});assert.ok(document.getElementById('calc-result').innerHTML.includes('Инициатива')===false);assert.ok(document.getElementById('calc-result').innerHTML.includes('Самовыражение'));
document.getElementById('number-method').value='year';document.getElementById('target-year').value='2026';document.getElementById('birth-form').listeners.submit({preventDefault(){}});assert.ok(document.getElementById('calc-result').innerHTML.includes('ЛИЧНЫЙ ГОД'));
document.getElementById('birth-date').value='2020-02-30';document.getElementById('birth-form').listeners.submit({preventDefault(){}});assert.ok(document.getElementById('form-error').textContent.length>10);
visit('#/matrix');document.getElementById('birth-date').value='1990-01-31';document.getElementById('birth-form').listeners.submit({preventDefault(){}});assert.ok(document.getElementById('calc-result').innerHTML.includes('matrix-chart'));assert.ok(document.getElementById('calc-result').innerHTML.includes('Учебная схема'));
visit('#/daily');const draw=document.querySelectorAll('[data-draw]')[0];draw.listeners.click();assert.equal(document.getElementById('card-reading').hidden,false);assert.ok(document.getElementById('card-reading').innerHTML.includes('Символическая практика'));
visit('#/horoscopes');assert.ok(main.innerHTML.includes('data-icon="aries"'));assert.ok(main.innerHTML.includes('data-icon="pisces"'));document.getElementById('zodiac-select').listeners.change({target:{value:'Рыбы'}});assert.ok(document.getElementById('forecast-result').innerHTML.includes('Рыбы'));assert.ok(document.getElementById('forecast-result').innerHTML.includes('data-icon="pisces"'));assertDrawnSymbols(document.getElementById('forecast-result').innerHTML);document.getElementById('period-select').listeners.change({target:{value:'year'}});assert.ok(document.getElementById('forecast-result').innerHTML.includes('На год'));
visit('#/');document.getElementById('library-search').listeners.input({target:{value:'Ба-Цзы'}});assert.ok(document.getElementById('library-list').innerHTML.includes('bazi'));document.getElementById('library-search').listeners.input({target:{value:'несуществующая тема 123'}});assert.ok(document.getElementById('library-list').innerHTML.includes('Такой темы пока нет'));
const menuButton=document.querySelector('.menu-toggle'),mobileMenu=document.querySelector('.mobile-nav');
assert.equal(menuButton.attrs['aria-controls'],'mobile-menu');
const menuIsOpen=()=>mobileMenu.attrs['data-open']==='true';
assert.equal(menuIsOpen(),false);assert.equal(mobileMenu.inert,true);assert.equal(mobileMenu.hidden,false,'Closed menu remains mounted for animation');
menuButton.listeners.click();assert.equal(menuIsOpen(),true);assert.equal(main.inert,true);assert.equal(mobileMenu.inert,false);assert.equal(menuButton.attrs['aria-expanded'],'true');assert.equal(menuButton.attrs['aria-label'],'Закрыть меню');
mobileMenu.listeners.click({target:{closest:()=>({tagName:'a'})}});assert.equal(menuIsOpen(),false,'Clicking an already-active link closes the mobile menu');assert.equal(main.inert,false);assert.equal(mobileMenu.attrs['aria-hidden'],'true');
menuButton.listeners.click();docEvents.keydown({key:'Escape'});assert.equal(menuIsOpen(),false);assert.equal(menuButton.focused,true,'Escape restores menu-button focus');
menuButton.listeners.click();mediaListeners['(min-width: 1281px)']({matches:true});assert.equal(menuIsOpen(),false,'Entering desktop layout resets the mobile disclosure');
menuButton.listeners.click();visit('#/matrix');assert.equal(menuIsOpen(),false,'Route navigation resets mobile menu');
menuButton.listeners.click();document.querySelector('.menu-backdrop').listeners.click();assert.equal(menuIsOpen(),false,'Backdrop closes menu');
for(let i=0;i<20;i++)menuButton.listeners.click();assert.equal(menuIsOpen(),false,'Rapid repeated taps resolve immediately without pending hide timers');
menuButton.listeners.click();document.querySelector('.search-open').listeners.click();assert.equal(menuIsOpen(),false,'Opening search closes navigation and releases background');assert.equal(main.inert,false);
document.querySelector('.search-open').listeners.click();document.getElementById('global-search').value='Генные';document.getElementById('global-search').listeners.input();assert.ok(document.getElementById('search-results').innerHTML.includes('gene-keys'));
// A page left open over midnight updates only dated widgets, retaining the user's choices.
clockOverride=new Date(2026,11,31,23,59).getTime();winEvents.pageshow();
visit('#/horoscopes/week');document.getElementById('zodiac-select').listeners.change({target:{value:'Рыбы'}});
const weekBefore=document.getElementById('forecast-result').innerHTML;
clockOverride=new Date(2027,0,1,0,1).getTime();winEvents.pageshow();
assert.equal(document.getElementById('forecast-result').innerHTML,weekBefore,'A week spanning New Year keeps its forecast');
visit('#/horoscopes/month');assert.ok(document.getElementById('forecast-result').innerHTML.includes('январь 2027'));
clockOverride=new Date(2027,1,1,0,1).getTime();winEvents.pageshow();
assert.ok(document.getElementById('forecast-result').innerHTML.includes('февраль 2027'));
assert.ok(document.getElementById('forecast-result').innerHTML.includes('Рыбы'),'Sign is preserved when a new month begins');
visit('#/daily');const readingContext=document.getElementById('reading-context');readingContext.value='love';readingContext.listeners.change({target:readingContext});document.querySelectorAll('[data-draw]')[0].listeners.click();assert.equal(document.getElementById('card-reading').hidden,false);
clockOverride=new Date(2027,1,2,0,1).getTime();document.visibilityState='visible';docEvents.visibilitychange();
assert.equal(document.getElementById('card-reading').hidden,true,'Old day reading resets after calendar rollover');
assert.equal(readingContext.value,'love','Reading topic is retained');
assert.ok(document.getElementById('reading-period').textContent.includes('2 февраля 2027'));
for(let i=0;i<10;i++)winEvents.pageshow();assert.equal(timers.size,1,'Only one midnight timer survives repeated page resumes');
if(window.ELISABET_TRANSLATIONS.en){
  const L=window.ELISABET_I18N;
  for(const language of ['en','uk','be','ru']){
    L.setLanguage(language);
    for(const route of ['#/','#/category/astrology','#/topic/natal-chart','#/daily','#/matrix','#/numbers','#/horoscopes/week'])visit(route);
  }
  L.setLanguage('en');visit('#/');document.getElementById('library-search').listeners.input({target:{value:'natal'}});assert.ok(document.getElementById('library-list').innerHTML.includes('natal-chart'),'Search uses translated content');
  visit('#/horoscopes/week');document.getElementById('period-select').listeners.change({target:{value:'month'}});document.getElementById('zodiac-select').listeners.change({target:{value:'Рыбы'}});L.setLanguage('uk');assert.equal(document.getElementById('period-select').value,'month');assert.ok(document.getElementById('forecast-result').innerHTML.includes(L.t('Рыбы')));
  visit('#/numbers');document.getElementById('birth-date').value='1990-01-01';document.getElementById('number-method').value='life';document.getElementById('birth-form').listeners.submit({preventDefault(){}});L.setLanguage('be');assert.equal(document.getElementById('birth-date').value,'1990-01-01');assert.ok(document.getElementById('calc-result').innerHTML.includes(L.t('Самовыражение')));
  visit('#/daily');document.querySelectorAll('[data-draw]')[1].listeners.click();const chosenNumber=document.getElementById('card-reading').innerHTML.match(/<h3>(\d+)\./)[1];L.setLanguage('en');assert.equal(document.getElementById('card-reading').hidden,false,'Chosen card survives language changes');assert.equal(document.getElementById('card-reading').innerHTML.match(/<h3>(\d+)\./)[1],chosenNumber,'Language changes never draw another card');assert.ok(document.getElementById('card-reading').innerHTML.includes('practice')||!/[А-Яа-яЁё]/.test(document.getElementById('card-reading').innerHTML.replace(/<[^>]*>/g,'')));
  document.getElementById('card-reading').querySelector('button').listeners.click();assert.equal(document.getElementById('card-reading').hidden,true);document.querySelectorAll('[data-draw]')[0].listeners.click();assert.notEqual(document.getElementById('card-reading').innerHTML.match(/<h3>(\d+)\./)[1],chosenNumber,'New spread takes fresh cards from the22arcana deck');
  L.setLanguage('ru');
}
console.log('PASS: 66 unique topic schemas, 4 categories, required local assets, Telegram links, script syntax, home/category/all-topic routes, numerology/year/matrix form submissions, invalid dates, tarot draw, zodiac/period controls, library and modal search. Mock DOM smoke test only; visual/browser QA is separate.');
