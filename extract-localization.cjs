const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strings=new Set();
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function add(value){const text=decode(String(value)).replace(/\s+/g,' ').trim();if(/[А-Яа-яЁё]/.test(text)&&text&&!/^\d{1,2} (?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) \d{4}/.test(text)&&!/^\d{4} год$/.test(text))strings.add(text);}
function collectMarkup(markup){
  for(const p of String(markup).split(/(<[^>]*>)/g))if(!p.startsWith('<'))add(p);
  for(const match of String(markup).matchAll(/(?:aria-label|title|placeholder|alt)="([^"]*)"/g))add(match[1]);
}
const ctx={window:{}};
for(const file of ['content.js','reading-data.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'dist',file),'utf8'),ctx);
function walk(value){if(typeof value==='string')add(value);else if(value&&typeof value==='object')Object.values(value).forEach(walk);}
walk(ctx.window);
let harness=fs.readFileSync(path.join(__dirname,'verify-site.cjs'),'utf8');
harness=harness.replace('set innerHTML(value){this._html=String(value);','set innerHTML(value){collectMarkup(String(value));this._html=String(value);');
new Function('require','__dirname','collectMarkup',harness)(require,__dirname,collectMarkup);
collectMarkup(fs.readFileSync(path.join(__dirname,'dist/index.html'),'utf8'));
for(const file of ['app.js','calculators.js','theme.js','readings.js']){
  const source=fs.readFileSync(path.join(__dirname,'dist',file),'utf8');
  for(const m of source.matchAll(/'((?:\\.|[^'\\\r\n])*)'/g)){
    let value;try{value=vm.runInNewContext("'"+m[1]+"'");}catch{continue;}
    if(!/[А-Яа-яЁё]/.test(value))continue;
    if(value.includes('<'))collectMarkup(value);else if(!value.includes('${'))add(value);
  }
}
for(const text of ['Язык сайта','Русский','Українська','Беларуская','English','Показано {shown} из {total}','{year} год','БИБЛИОТЕКА СМЫСЛОВ · {count} ТЕМ','Открыть карту {number}','Пять опор матрицы','авторская иллюстрация','тематическая символическая иллюстрация','символическая иллюстрация','по времени твоего устройства','Цифры дня, месяца и {year} года: {steps}','Натальная карта, арканы, совместимость…'])add(text);
const result=[...strings].sort((a,b)=>a.localeCompare(b,'ru'));
fs.writeFileSync(path.join(__dirname,'localization-source.json'),JSON.stringify(result,null,2),'utf8');
console.log('Translation corpus: '+result.length+' strings, '+JSON.stringify(result).length+' characters.');
