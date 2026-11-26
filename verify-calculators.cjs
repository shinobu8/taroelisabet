'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { window: {}, Date, Number, String, Math, Error, Object };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'dist/calculators.js'), 'utf8'), context);
const c = context.window.ELISABET_CALC;
assert.equal(c.lifePath('1990-01-01').number, 3);
assert.equal(c.lifePath('2000-02-29').number, 6);
assert.equal(c.lifePath('2000-09-09').number, 2); // 20 → 2
assert.equal(c.lifePath('2000-01-08').number, 11);
assert.equal(c.lifePath('2000-09-29').number, 22);
assert.equal(c.lifePath('1999-01-22').number, 33);
assert.equal(c.lifePath('1999-01-23').number, 7); // 34 → 7
assert.throws(() => c.lifePath('1900-02-29'));
assert.throws(() => c.lifePath('2001-02-29'));
assert.throws(() => c.lifePath('2020-04-31'));
assert.throws(() => c.lifePath('1899-12-31'));
assert.throws(() => c.lifePath('2020-00-01'));
assert.throws(() => c.lifePath('2020-01-00'));
assert.throws(() => c.lifePath('01.01.2000'));
assert.throws(() => c.lifePath(null));
assert.throws(() => c.lifePath((new Date().getFullYear() + 1) + '-01-01'));
assert.equal(c.personalYear('1990-01-01', 2026).number, 3);
assert.equal(c.personalYear('1990-01-01', 2025).number, 2); // 11 → 2, masters not preserved
assert.throws(() => c.personalYear('1990-01-01', 2201));
assert.throws(() => c.personalYear('1990-01-01', 2026.5));
const matrix = c.matrix('1990-01-31');
assert.equal(Array.from(matrix.positions, p => p.number).join(','), '4,1,19,6,3'); // 24 → 6, not modulo 22
assert.match(matrix.method, /Учебная схема/);
assert.equal(c.zodiac('2000-01-01').name, 'Козерог');
assert.equal(c.zodiac('2000-12-31').name, 'Козерог');
assert.equal(c.zodiac('2000-03-21').name, 'Овен');
assert.equal(c.zodiac('2000-02-29').name, 'Рыбы');
assert.equal(c.card('2026-11-23').title, c.card('2026-11-23').title);
const seen = new Set();
for (let i = 0; i < 500; i++) { const card = c.card(i); assert.ok(card.number >= 1 && card.number <= 22); assert.ok(card.prompt); seen.add(card.number); }
assert.equal(seen.size, 22);
console.log('PASS: calendar validation, leap years, birth dates, life path/master numbers, personal year, matrix digit-sum reduction, zodiac boundaries and all 22 deterministic cards.');
