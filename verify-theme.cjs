'use strict';
// Exercises the production theme script with browser API facades, without a browser dependency.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'dist/theme.js'), 'utf8');
new vm.Script(source);
const KEY = 'elisabet-theme';

function boot(options = {}) {
  const saved = options.storage || new Map(options.saved == null ? [] : [[KEY, options.saved]]);
  const docListeners = new Map(), winListeners = new Map();
  const node = () => ({
    attrs: {}, listeners: new Map(),
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name] ?? null; },
    addEventListener(name, callback) { this.listeners.set(name, callback); }
  });
  const root = node(), meta = node(), button = node();
  let available = options.readyState !== 'loading';
  let mediaCallback = null;
  const media = { matches: !!options.systemDark };
  if (options.legacyMedia) media.addListener = callback => { mediaCallback = callback; };
  else media.addEventListener = (event, callback) => { assert.equal(event, 'change'); mediaCallback = callback; };
  const storage = {
    getItem(key) { if (options.readThrows) throw new Error('Storage unavailable'); return saved.get(key) ?? null; },
    setItem(key, value) { if (options.writeThrows) throw new Error('Storage full'); saved.set(key, value); }
  };
  const window = {
    localStorage: storage,
    matchMedia(query) { assert.equal(query, '(prefers-color-scheme: dark)'); if (options.mediaThrows) throw new Error('No media API'); return media; },
    addEventListener(name, callback) { winListeners.set(name, callback); }
  };
  if (options.storageGetterThrows) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Access denied'); } });
  const document = {
    documentElement: root,
    readyState: options.readyState || 'complete',
    querySelector(selector) { assert.equal(selector, 'meta[name="theme-color"]'); return options.noMeta ? null : meta; },
    querySelectorAll(selector) { assert.equal(selector, '.theme-toggle'); return available ? [button] : []; },
    addEventListener(event, callback, flags) { assert.equal(event, 'DOMContentLoaded'); assert.equal(flags.once, true); docListeners.set(event, callback); }
  };
  vm.runInNewContext(source, { window, document });
  return {
    root, meta, button, saved,
    theme: () => root.attrs['data-theme'],
    preference: () => root.attrs['data-theme-preference'],
    click() { assert.ok(button.listeners.has('click'), 'Theme switch is bound'); button.listeners.get('click')(); },
    changeSystem(dark) { media.matches = dark; assert.ok(mediaCallback); mediaCallback({ matches: dark }); },
    storageEvent(key, newValue) { winListeners.get('storage')({ key, newValue }); },
    domReady() { available = true; document.readyState = 'interactive'; const callback = docListeners.get('DOMContentLoaded'); assert.ok(callback); callback(); }
  };
}
function assertState(page, theme, preference) {
  assert.equal(page.theme(), theme);
  assert.equal(page.preference(), preference);
  assert.equal(page.button.attrs['aria-pressed'], String(theme === 'dark'));
  const expected = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  assert.equal(page.button.attrs['aria-label'], expected);
  assert.equal(page.button.attrs.title, expected);
  assert.equal(page.meta.attrs.content, theme === 'dark' ? '#10241e' : '#f8f8f2');
}

assertState(boot(), 'light', 'system');
assertState(boot({ systemDark: true }), 'dark', 'system');
assertState(boot({ saved: 'light', systemDark: true }), 'light', 'user');
assertState(boot({ saved: 'dark', systemDark: false }), 'dark', 'user');
for (const saved of ['sepia', '', 'LIGHT', 'undefined']) assertState(boot({ saved, systemDark: true }), 'dark', 'system');

const user = boot();
user.click(); assertState(user, 'dark', 'user'); assert.equal(user.saved.get(KEY), 'dark');
assertState(boot({ storage: user.saved }), 'dark', 'user');
user.changeSystem(false); assertState(user, 'dark', 'user');
user.click(); assertState(user, 'light', 'user'); assert.equal(user.saved.get(KEY), 'light');
assertState(boot({ storage: user.saved, systemDark: true }), 'light', 'user');

for (const legacyMedia of [false, true]) {
  const system = boot({ legacyMedia });
  system.changeSystem(true); assertState(system, 'dark', 'system');
  system.changeSystem(false); assertState(system, 'light', 'system');
  system.click(); system.changeSystem(false); assertState(system, 'dark', 'user');
}
for (const flags of [{ readThrows: true }, { writeThrows: true }, { storageGetterThrows: true }]) {
  const constrained = boot(flags);
  assertState(constrained, 'light', 'system');
  constrained.click(); assertState(constrained, 'dark', 'user');
  constrained.click(); assertState(constrained, 'light', 'user');
}
assertState(boot({ mediaThrows: true }), 'light', 'system');
const noMeta = boot({ noMeta: true }); noMeta.click(); assert.equal(noMeta.theme(), 'dark');

const crossTab = boot({ systemDark: true });
crossTab.storageEvent(KEY, 'light'); assertState(crossTab, 'light', 'user');
crossTab.storageEvent('unrelated', 'dark'); assertState(crossTab, 'light', 'user');
crossTab.storageEvent(KEY, 'dark'); assertState(crossTab, 'dark', 'user');
crossTab.storageEvent(KEY, null); assertState(crossTab, 'dark', 'system');
crossTab.storageEvent(KEY, 'light'); crossTab.storageEvent(null, null); assertState(crossTab, 'dark', 'system');
crossTab.storageEvent(KEY, 'not-a-theme'); assertState(crossTab, 'dark', 'system');

const loading = boot({ readyState: 'loading', saved: 'dark' });
assert.equal(loading.theme(), 'dark', 'Saved theme is applied before DOMContentLoaded');
assert.equal(loading.button.listeners.has('click'), false);
loading.domReady(); assertState(loading, 'dark', 'user');
loading.click(); assertState(loading, 'light', 'user');

console.log('PASS: early theme application, system/saved/invalid preferences, toggle persistence and reload, accessible labels and meta color, modern/legacy media changes, blocked storage, storage synchronization/reset, and DOMContentLoaded binding. Browser API facade tests only.');
