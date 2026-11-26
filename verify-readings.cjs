'use strict';
// Calendar boundaries and content rotation are checked with real local-date semantics.
process.env.TZ = 'Europe/Berlin';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { window: {}, Date, Intl, Math, Number, String, Object, Error, TypeError, RangeError };
vm.createContext(context);
for (const name of ['reading-data.js', 'readings.js']) {
  const file = path.join(__dirname, 'dist', name);
  if (!fs.existsSync(file)) throw new Error('Reading engine is not ready: dist/' + name);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: name });
}
const api = context.window.ELISABET_READINGS;
assert.ok(api, 'ELISABET_READINGS must be loaded');
const local = (year, month, day, hour = 12, minute = 0, second = 0) => new Date(year, month - 1, day, hour, minute, second);
const plusDays = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const serialize = value => JSON.stringify(value);
const forecastCore = result => serialize([result.focus, result.text, result.prompt, result.practice]);
const drawCore = result => serialize([result.number, result.title, result.theme, result.text, result.prompt, result.practice]);
const signs = ['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы'];
const periods = ['day','week','month','year'];
let passed = 0;
function test(name, run) {
  try { run(); passed += 1; }
  catch (error) { process.exitCode = 1; console.error('FAIL: ' + name + '\n' + error.stack); }
}
function assertPeriod(type, now, start, end) {
  const p = api.periodInfo(type, now);
  assert.equal(p.type, type);
  assert.equal(p.startKey, start);
  assert.equal(p.endKey, end);
  assert.ok(typeof p.key === 'string' && p.key.length > 0);
  assert.ok(typeof p.label === 'string' && p.label.length > 0);
  assert.ok(Number.isInteger(p.ordinal));
  return p;
}
function assertReadingText(result) {
  for (const key of ['text','prompt','practice']) assert.ok(typeof result[key] === 'string' && result[key].length > 8, key + ' must contain authored text');
}

test('Local civil-day keys preserve the visitor date, not UTC', () => {
  assert.equal(api.dayKey(local(2026, 11, 23, 0, 5)), '2026-11-23');
  assert.equal(api.dayKey(local(2026, 11, 23, 23, 59)), '2026-11-23');
  assertPeriod('day', local(2026, 11, 23), '2026-11-23', '2026-11-23');
  assert.equal(api.periodInfo('day', local(2026, 11, 23, 0)).key, api.periodInfo('day', local(2026, 11, 23, 23)).key);
});

test('Monday-to-Sunday weeks remain stable across New Year and months', () => {
  const p = assertPeriod('week', local(2026, 1, 1), '2025-12-29', '2026-01-04');
  assert.equal(p.key, api.periodInfo('week', local(2025, 12, 29)).key);
  assert.equal(p.key, api.periodInfo('week', local(2026, 1, 4, 23, 59)).key);
  assert.notEqual(p.key, api.periodInfo('week', local(2026, 1, 5, 0)).key);
  assertPeriod('week', local(2027, 1, 1), '2026-12-28', '2027-01-03');
  assertPeriod('week', local(2024, 2, 29), '2024-02-26', '2024-03-03');
  assert.equal(forecastCore(api.forecast('Овен','week',local(2025,12,29))), forecastCore(api.forecast('Овен','week',local(2026,1,4))));
});

test('Months and years use real inclusive calendar boundaries', () => {
  assertPeriod('month', local(2024,2,11), '2024-02-01', '2024-02-29');
  assertPeriod('month', local(2026,2,11), '2026-02-01', '2026-02-28');
  assertPeriod('month', local(2026,4,30), '2026-04-01', '2026-04-30');
  assertPeriod('year', local(2026,11,23), '2026-01-01', '2026-12-31');
  assert.equal(forecastCore(api.forecast('Рыбы','month',local(2024,2,1))), forecastCore(api.forecast('Рыбы','month',local(2024,2,29,23))));
  assert.equal(forecastCore(api.forecast('Весы','year',local(2026,1,1))), forecastCore(api.forecast('Весы','year',local(2026,12,31))));
});

test('Russian labels identify the actual selected period', () => {
  const day = api.periodInfo('day', local(2026,11,23)).label;
  assert.match(day, /23/); assert.match(day, /ноябр/i); assert.match(day, /2026/);
  const month = api.periodInfo('month', local(2024,2,29)).label;
  assert.match(month, /феврал/i); assert.match(month, /2024/);
  assert.match(api.periodInfo('year', local(2026,11,23)).label, /2026/);
  const crossYear = api.periodInfo('week', local(2026,1,1)).label;
  assert.match(crossYear, /2025/); assert.match(crossYear, /2026/);
});

test('DST uses the next local midnight, including 23-hour and 25-hour days', () => {
  const spring = local(2026,3,29,0), autumn = local(2026,10,25,0);
  assert.equal((api.nextMidnight(spring) - spring) / 3600000, 23);
  assert.equal((api.nextMidnight(autumn) - autumn) / 3600000, 25);
  assert.equal(api.dayKey(api.nextMidnight(spring)), '2026-03-30');
  assert.equal(api.dayKey(api.nextMidnight(autumn)), '2026-10-26');
  assertPeriod('week', spring, '2026-03-23', '2026-03-29');
  assertPeriod('week', autumn, '2026-10-19', '2026-10-25');
  const atLastSecond = local(2026,11,23,23,59,59);
  assert.equal(api.nextMidnight(atLastSecond) - atLastSecond, 1000);
});

test('Every sign and period has complete, stable and distinct forecast content', () => {
  const date = local(2026,11,23);
  for (const type of periods) {
    const unique = new Set();
    for (const sign of signs) {
      const result = api.forecast(sign,type,date);
      assertReadingText(result);
      assert.ok(typeof result.focus === 'string' && result.focus.length > 1);
      assert.equal(result.period.key, api.periodInfo(type,date).key);
      assert.equal(forecastCore(result), forecastCore(api.forecast(sign,type,new Date(date))));
      unique.add(forecastCore(result));
    }
    assert.equal(unique.size, 12, type + ' should differ by zodiac sign');
  }
});

test('Adjacent calendar periods rotate substantive content, not just dates', () => {
  const pairs = [
    ['day', local(2026,11,23), local(2026,11,24)],
    ['week', local(2026,11,23), local(2026,11,30)],
    ['month', local(2026,11,23), local(2026,12,1)],
    ['year', local(2026,11,23), local(2027,1,1)]
  ];
  for (const [type,a,b] of pairs) {
    assert.notEqual(api.periodInfo(type,a).key, api.periodInfo(type,b).key);
    for (const sign of signs) assert.notEqual(forecastCore(api.forecast(sign,type,a)), forecastCore(api.forecast(sign,type,b)), sign + ': ' + type);
  }
});

test('Three cards are unique per spread and stable throughout the local day', () => {
  const date = local(2026,11,23);
  for (const contextName of ['day','love','situation']) {
    const cards = [0,1,2].map(slot => api.draw(slot,contextName,date));
    assert.equal(new Set(cards.map(c => c.number)).size, 3);
    for (const [slot,card] of cards.entries()) {
      assert.ok(Number.isInteger(card.number) && card.number >= 1 && card.number <= 22);
      assert.ok(card.title && card.theme);
      assertReadingText(card);
      assert.equal(card.period.key, api.periodInfo('day',date).key);
      assert.equal(drawCore(card), drawCore(api.draw(slot,contextName,local(2026,11,23,23,59))));
    }
  }
});

test('All 22 major arcana appear over time, with rotating interpretations', () => {
  const date = local(2026,11,23), allCards = new Set();
  for (let day = 0; day < 22; day++) {
    const cards = [0,1,2].map(slot => api.draw(slot,'day',plusDays(date,day)));
    assert.equal(new Set(cards.map(c => c.number)).size, 3);
    cards.forEach(card => allCards.add(card.number));
  }
  assert.equal(allCards.size,22);
  const first = api.draw(0,'day',date), nextCycle = api.draw(0,'day',plusDays(date,22));
  assert.equal(first.number,nextCycle.number,'22-day card cycle repeats the arcana');
  assert.notEqual(first.text,nextCycle.text,'The same arcana should receive a different authored interpretation next cycle');
});

test('Day, love and situation contexts vary the reading', () => {
  const date = local(2026,11,23);
  const results = ['day','love','situation'].map(contextName => api.draw(0,contextName,date));
  assert.equal(new Set(results.map(drawCore)).size, 3);
});

test('Unsupported periods, signs, slots and contexts are rejected', () => {
  const date = local(2026,11,23);
  for (const type of ['hour','',null]) assert.throws(() => api.periodInfo(type,date));
  assert.throws(() => api.forecast('Змееносец','day',date));
  assert.throws(() => api.forecast('Овен','hour',date));
  for (const slot of [-1,3,0.5,'0',null]) assert.throws(() => api.draw(slot,'day',date));
  for (const contextName of ['money','',null]) assert.throws(() => api.draw(0,contextName,date));
});

test('New spreads shuffle all22arcana within the same day without duplicates in a spread',()=>{
  const date=local(2028,4,10),seen=new Set();let seed=12345;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let first;
  for(let round=0;round<16;round++){
    const cards=api.deal('day',date,random);assert.equal(cards.length,3);assert.equal(new Set(cards.map(card=>card.number)).size,3);
    cards.forEach(card=>{assert.ok(card.number>=1&&card.number<=22);seen.add(card.number);});
    if(round===0)first=cards.map(card=>card.number).join(',');
    if(round===1)assert.notEqual(cards.map(card=>card.number).join(','),first);
    if(round===7)assert.equal(seen.size,22,'All22 cards participate within eight new spreads');
  }
});
if (!process.exitCode) console.log('PASS: ' + passed + ' reading-engine groups — local calendar/DST, week/month/year boundaries, stable zodiac forecasts, substantive rotation, distinct cards, 22 arcana and context/input validation.');
