/* Stock photo runtime + performance.
   The manifest loads once, a blocked manifest is reported rather than silently
   looking like "no photo", no PNG is opened to make a choice, and the DEV
   report carries the reason. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const STOCK  = JSON.parse(readFileSync(REPO + '/generator/assets/stock-photo-manifest.json', 'utf8'));
const ASSETS = JSON.parse(readFileSync(REPO + '/generator/assets/design-asset-manifest.json', 'utf8'));

let fetches = [];
let manifestFails = 0;
globalThis.window = {};
globalThis.fetch = async (u) => {
  const s = String(u);
  fetches.push(s);
  if (s.includes('stock-photo-manifest.json')) {
    if (manifestFails > 0) { manifestFails--; throw new Error('Blocked by demo guard'); }
    return { ok: true, json: async () => STOCK };
  }
  if (s.includes('design-asset-manifest.json')) return { ok: true, json: async () => ASSETS };
  return { ok: false, status: 404 };
};

const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { loadStockPhotoLibrary, pickStockPhoto, stockPhotoMode,'
  + ' get lastStockReason() { return lastStockReason; },'
  + ' get stockLibraryError() { return stockLibraryError; } };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const SIGN = { templateType: 'Sign', widthIn: 36, heightIn: 24 };
let seq = 0;
const pick = (industryText, geom = SIGN) => P.pickStockPhoto(Object.assign({
  industryText, memoryKey: 'r' + (seq++), hasCustomerPhoto: false }, geom));

console.log('\n1  the manifest loads once');
await P.loadStockPhotoLibrary();
const first = fetches.filter((u) => u.includes('stock-photo-manifest.json')).length;
for (let i = 0; i < 50; i++) await P.loadStockPhotoLibrary();
const many = fetches.filter((u) => u.includes('stock-photo-manifest.json')).length;
is(first === 1 && many === 1, 'one fetch, then cached for the life of the page',
   many + ' fetch(es) for 51 calls');
is(fetches.every((u) => !/\.png(\?|$)/i.test(u)),
   'no PNG is fetched to load the library');

console.log('\n2  selection touches the network never');
fetches = [];
globalThis.window.SMPStockPhotoMode = 'force';
for (let i = 0; i < 2000; i++) pick('dentist');
is(fetches.length === 0, 'two thousand selections, zero requests');
const PICK_BODY = ENGINE_SRC.split('function pickStockPhoto')[1]
  .split('/* Only the chosen photograph')[0]
  .replace(/\/\*[\s\S]*?\*\//g, '');
is(!/base64|toDataURL|FileReader|fetch\(|XMLHttpRequest|new Image/.test(PICK_BODY),
   'and nothing is encoded, hashed, fetched or inlined to make a choice');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n3  a blocked manifest is reported, not cached');
/* A fresh engine instance, with the first manifest request failing. */
let f2 = [];
let fails = 1;
globalThis.window = {};
globalThis.fetch = async (u) => {
  const s = String(u); f2.push(s);
  if (s.includes('stock-photo-manifest.json')) {
    if (fails > 0) { fails--; throw new Error('Blocked by demo guard'); }
    return { ok: true, json: async () => STOCK };
  }
  if (s.includes('design-asset-manifest.json')) return { ok: true, json: async () => ASSETS };
  return { ok: false, status: 404 };
};
let src2 = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__q = { loadStockPhotoLibrary, pickStockPhoto,'
  + ' get lastStockReason() { return lastStockReason; },'
  + ' get stockLibraryError() { return stockLibraryError; } };');
src2 = src2.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src2);
const Q = globalThis.__q;
await Q.loadStockPhotoLibrary();
const blocked = Q.pickStockPhoto({ industryText: 'dentist', memoryKey: 'b1',
  hasCustomerPhoto: false, ...SIGN });
is(blocked === null, 'a blocked manifest yields no photo');
is(/library did not load/.test(Q.lastStockReason),
   'and the DEV reason names the failure, not a design decision', Q.lastStockReason);
await Q.loadStockPhotoLibrary();
const recovered = Q.pickStockPhoto({ industryText: 'dentist', memoryKey: 'b2',
  hasCustomerPhoto: false, ...SIGN });
is(recovered !== null || /drew none/.test(Q.lastStockReason),
   'the next generation retries — the failure was not cached');
is(f2.filter((u) => u.includes('stock-photo-manifest.json')).length === 2,
   'which took exactly one more request');

console.log('\n4  the library is warmed at page load, alongside the asset library');
is(/if \(typeof window !== 'undefined'\) \{\s*try \{ loadStockPhotoLibrary\(\); \}/.test(ENGINE_SRC),
   'loadStockPhotoLibrary\(\) runs as the script parses');
is(/await Promise\.all\(\[loadAssetLibrary\(\), loadStockPhotoLibrary\(\)\]\)/.test(ENGINE_SRC),
   'and handleGenerate awaits both in parallel, never in series');

console.log('\n5  the DEV report');
is(/window\.SMPLastStockPhoto = /.test(ENGINE_SRC), 'the selection is published for the indicator');
is(/smp:stock-photo-selected/.test(ENGINE_SRC), 'on its own event, separate from the assets');
const APP = readFileSync(REPO + '/generator/app.js', 'utf8');
is(/Photo: None \\u00b7 Reason: /.test(APP), 'the indicator renders "Photo: None · Reason: …"');
is(/'Photo: ' \+ sel\.file \+ ' \\u00b7 Industry: ' \+ sel\.industry/.test(APP),
   'and "Photo: <file> · Industry: <slug>"');
is(/\['auto', 'Auto'\], \['force', 'Force Photo'\], \['off', 'No Photo'\]/.test(APP),
   'the Stock Photo Mode control offers Auto | Force Photo | No Photo');
is(/'devStockPhotoMode', 'Stock Photo Mode'/.test(APP), 'labelled Stock Photo Mode');
is(/actions\.insertBefore\(photo\.wrap, generate\)/.test(APP),
   'and sits in the left sidebar above Generate Design');
is(/if \(!\(window\.SMPWeb03Dev && window\.SMPWeb03Dev\.active\)\) return;/.test(APP),
   'the whole indicator is DEV-clone only');

console.log('\n6  the guard serves this clone its own photo library');
const GUARD = readFileSync(REPO + '/demo-guard.js', 'utf8');
is(/rest === 'generator\/assets\/stock-photo-manifest\.json'/.test(GUARD),
   'the manifest is allowed through');
is(/\^generator\\\/assets\\\/stock-photo-library\\\/\[A-Za-z0-9\._-\]\+\\\.png\$/.test(GUARD),
   'so are the PNGs beside it');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
