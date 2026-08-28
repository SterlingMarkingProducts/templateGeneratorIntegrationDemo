/* Stock photo library selection (Phase 2C).
   Loads engine.js in Node with both manifests served from disk, then asks the
   real selector for thousands of decisions and checks the contract:
   customer photo wins, industry match is a hard gate, one photo maximum,
   orientation and text-safety gating, Force, variety, and asset suppression. */
import { readFileSync, existsSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const RUNS = Number(process.argv[3] || 600);

const STOCK  = JSON.parse(readFileSync(REPO + '/generator/assets/stock-photo-manifest.json', 'utf8'));
const ASSETS = JSON.parse(readFileSync(REPO + '/generator/assets/design-asset-manifest.json', 'utf8'));
globalThis.window = {};
globalThis.fetch = async (u) => {
  const s = String(u);
  if (s.includes('stock-photo-manifest.json'))  return { ok: true, json: async () => STOCK };
  if (s.includes('design-asset-manifest.json')) return { ok: true, json: async () => ASSETS };
  return { ok: false, status: 404 };
};

const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { chooseCreativeDirection, loadAssetLibrary, loadStockPhotoLibrary,'
  + ' pickStockPhoto, pickAssets, matchStockIndustries, stockOrientationFor,'
  + ' stockCompositionOk, renderStockPhotoBlock, recentStockPhotos,'
  + ' STOCK_NONE_LARGE_FORMAT, STOCK_NONE_SMALL_FORMAT, PHOTO_SAFE_ASSET_FAMILIES,'
  + ' STOCK_INDUSTRY_SYNONYMS, HTML_PROMPT, get lastStockReason() { return lastStockReason; } };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
await P.loadStockPhotoLibrary();
await P.loadAssetLibrary();

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

/* Business card 3.5x2 = small format; a 24x36 sign = large format. */
const CARD = { templateType: 'Business Card', widthIn: 3.5, heightIn: 2 };
const SIGN = { templateType: 'Sign', widthIn: 36, heightIn: 24 };
const BANNER_TALL = { templateType: 'Banner', widthIn: 24, heightIn: 72 };

let seq = 0;
const pick = (industryText, geom = SIGN, extra = {}) => P.pickStockPhoto(Object.assign({
  industryText, memoryKey: 'k' + (seq++), hasCustomerPhoto: false,
}, geom, extra));

console.log('\n1  the library is present, complete and served from this clone');
is(STOCK.file_count === 35 && STOCK.photos.length === 35, 'the manifest describes 35 photographs');
is(STOCK.photos.every((p) => p.url.startsWith('assets/stock-photo-library/')),
   'every photo has a served URL under the clone');
is(STOCK.photos.every((p) => existsSync(REPO + '/generator/' + p.url)),
   'every described file actually exists on disk');
is(!JSON.stringify(STOCK).includes('/tmp/'), 'no /tmp path survived into the committed manifest');
is(Object.keys(STOCK.industry_index).length >= 100, 'an industry index is present',
   Object.keys(STOCK.industry_index).length + ' slugs');
is(STOCK.photos.every((p) => p.regions && p.overlay_guidance),
   'every photo carries region grades and overlay guidance');

console.log('\n2  the three libraries stay separate');
const stockFiles = new Set(STOCK.photos.map((p) => p.file));
is(ASSETS.assets.every((a) => !stockFiles.has(a.filename)), 'no file appears in both libraries');
is(ASSETS.assets.every((a) => !a.url.includes('stock-photo-library'))
   && STOCK.photos.every((p) => !p.url.includes('design-library')),
   'neither manifest points into the other directory');
is(!ENGINE_SRC.includes('logo-library') && !ENGINE_SRC.includes('logo-manifest'),
   'the engine references no logo library at all');
is(/loadAssetLibrary[\s\S]{0,400}design-asset-manifest\.json/.test(ENGINE_SRC)
   && /loadStockPhotoLibrary[\s\S]{0,400}stock-photo-manifest\.json/.test(ENGINE_SRC),
   'each library has its own loader and its own manifest');

console.log('\n3  the customer\'s own photograph always wins');
let custAuto = 0, custForce = 0;
for (let i = 0; i < 200; i++) {
  if (pick('dentist', SIGN, { hasCustomerPhoto: true })) custAuto++;
  globalThis.window.SMPStockPhotoMode = 'force';
  if (pick('dentist', SIGN, { hasCustomerPhoto: true })) custForce++;
  globalThis.window.SMPStockPhotoMode = 'auto';
}
is(custAuto === 0, 'Auto never selects stock when the customer supplied a photo');
is(custForce === 0, 'Force Photo never selects stock when the customer supplied a photo');
pick('dentist', SIGN, { hasCustomerPhoto: true });
is(P.lastStockReason === 'the customer supplied their own photograph',
   'and it says so', P.lastStockReason);
is(/hasCustomerPhoto\s*=\s*!!\(\(imageUrl \|\| ''\)\.trim\(\)\)/.test(ENGINE_SRC),
   'handleGenerate derives that gate from the brief\'s own Image URL');

console.log('\n4  industry match is a HARD gate');
const NONSENSE = ['Quantum Widget Foundry', 'Zorbtronic Systems', 'Blivet Manufacturing',
  'Cryptocurrency Mining', 'Trucking and Logistics', 'Municipal Fire Service'];
let nonsenseHits = 0;
NONSENSE.forEach((n) => { for (let i = 0; i < 60; i++) if (pick(n)) nonsenseHits++; });
is(nonsenseHits === 0, 'no photo is ever returned for an unmatched industry',
   NONSENSE.length * 60 + ' attempts');
pick('Quantum Widget Foundry');
is(P.lastStockReason === 'no industry match in the stock library', 'and it says why',
   P.lastStockReason);
pick('');
is(P.lastStockReason === 'no industry given', 'an empty industry is reported as such',
   P.lastStockReason);

const CASES = [
  ['Dental',                'dental'],
  ['dentist office',        'dental'],
  ['Plumbing',              'plumbing'],
  ['plumber',               'plumbing'],
  ['Real Estate',           'real-estate'],
  ['realtor',               'real-estate'],
  ['Law Firm',              'legal'],
  ['Veterinary Clinic',     'veterinary'],
  ['Hair Salon',            'hair-salon'],
  ['Bakery',                'bakery'],
  ['bakeries',              'bakery'],
  ['Landscaping',           'landscaping'],
  ['Yoga Studio',           'yoga'],
  ['Auto Repair',           'auto-repair'],
  ['mechanic',              'auto-repair'],
  ['Accounting',            'accounting'],
  ['Daycare',               'daycare'],
  ['Florist',               'florist'],
  ['Coffee Shop',           'cafe'],
  ['Interior Design',       'interior-design'],
];
let matchedAll = true, relevantAll = true;
CASES.forEach(([text, slug]) => {
  const slugs = P.matchStockIndustries(text, { terms: STOCK_TERMS() });
  if (slugs.indexOf(slug) === -1) { matchedAll = false; console.log(`     MISS  "${text}" -> ${slugs.join(',') || 'none'}`); }
  globalThis.window.SMPStockPhotoMode = 'force';
  for (let i = 0; i < 25; i++) {
    const r = pick(text);
    /* A legitimate skip: the industry matched, but no photo of it fits this
       product's shape. That is the rule working, not a miss. */
    if (!r) { if (!/no (landscape|portrait|any) photo|composes safely/.test(P.lastStockReason)) {
        relevantAll = false; console.log(`     NONE  "${text}" -> ${P.lastStockReason}`); } break; }
    if (!r.photo.industries.some((s) => slugs.indexOf(s) !== -1)) {
      relevantAll = false; console.log(`     BAD   "${text}" -> ${r.photo.file}`);
    }
  }
  globalThis.window.SMPStockPhotoMode = 'auto';
});
function STOCK_TERMS() {
  /* the same term table the engine built, rebuilt here from the manifest */
  const out = [];
  Object.keys(STOCK.industry_index).forEach((slug) => {
    const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const terms = [norm(slug)];
    const ex = P.STOCK_INDUSTRY_SYNONYMS[slug];
    if (ex) ex.split('|').forEach((t) => terms.push(norm(t)));
    terms.filter(Boolean).forEach((t) => out.push([t, slug]));
  });
  out.sort((a, b) => b[0].length - a[0].length);
  return out;
}
is(matchedAll, 'every real-world industry phrase resolves to its slug', CASES.length + ' phrases');
is(relevantAll, 'and every photo returned for it claims a matched slug');

console.log('\n5  stamps and mode gates');
let stampHits = 0;
['auto', 'force'].forEach((m) => {
  globalThis.window.SMPStockPhotoMode = m;
  for (let i = 0; i < 100; i++) if (pick('dentist', { templateType: 'Stamp', widthIn: 2, heightIn: 1 })) stampHits++;
});
globalThis.window.SMPStockPhotoMode = 'auto';
is(stampHits === 0, 'stamps never use stock photography, in any mode');
globalThis.window.SMPStockPhotoMode = 'off';
let offHits = 0;
for (let i = 0; i < 100; i++) if (pick('dentist')) offHits++;
is(offHits === 0, 'No Photo selects nothing');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n6  orientation and text safety');
globalThis.window.SMPStockPhotoMode = 'force';
let landscapeOk = true, portraitOk = true;
for (let i = 0; i < 200; i++) {
  const l = pick('real estate', SIGN);
  if (l && l.photo.orientation !== 'landscape') landscapeOk = false;
  const p = pick('hair salon', BANNER_TALL);
  if (p && p.photo.orientation !== 'portrait') portraitOk = false;
}
is(landscapeOk, 'a landscape product only ever receives landscape photos');
is(portraitOk, 'a portrait product only ever receives portrait photos');
const noPortrait = pick('plumbing', BANNER_TALL);
is(noPortrait === null && /portrait/.test(P.lastStockReason),
   'an industry with no portrait photo is skipped, not substituted', P.lastStockReason);
let cardSafe = true;
for (let i = 0; i < 400; i++) {
  const r = pick('dentist', CARD);
  if (!r) continue;
  const g = ['top', 'middle', 'bottom'].map((b) => r.photo.regions[b].text_safety);
  if (g.every((x) => x === 'poor')) cardSafe = false;
}
is(cardSafe, 'a small format never receives a photo whose every band is poor');
is(STOCK.photos.filter((p) => ['top', 'middle', 'bottom']
     .every((b) => p.regions[b].text_safety === 'poor')).length > 0,
   'and such photos do exist in the library, so the gate is doing work',
   STOCK.photos.filter((p) => ['top', 'middle', 'bottom']
     .every((b) => p.regions[b].text_safety === 'poor')).length + ' of 35');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n7  Force Photo');
let forcedHits = 0;
globalThis.window.SMPStockPhotoMode = 'force';
for (let i = 0; i < 200; i++) if (pick('dentist', CARD)) forcedHits++;
is(forcedHits === 200, 'Force takes a matched photo every time, even on a business card',
   forcedHits + '/200');
const forcedMiss = pick('Trucking and Logistics', SIGN);
is(forcedMiss === null && P.lastStockReason === 'no industry match in the stock library',
   'Force reports no compatible photo rather than reaching for an unrelated one',
   P.lastStockReason);
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n8  how often Auto takes a photo');
const rate = (text, geom) => {
  let hit = 0;
  for (let i = 0; i < RUNS; i++) if (pick(text, geom)) hit++;
  return hit / RUNS;
};
const signRate = rate('dentist', SIGN);
const cardRate = rate('dentist', CARD);
console.log(`     large format ${Math.round(signRate * 100)}%   business card ${Math.round(cardRate * 100)}%`);
is(signRate > 0.70 && signRate < 0.90, 'large format strongly considers photography',
   Math.round(signRate * 100) + '%');
is(cardRate > 0.07 && cardRate < 0.25, 'business cards use it far more selectively',
   Math.round(cardRate * 100) + '%');
is(signRate > cardRate * 3, 'and the gap between them is real');

console.log('\n9  one photo per design, and variety without drift');
const one = pick('healthcare', SIGN);
is(one === null || (one.photo && !Array.isArray(one.photo)),
   'a selection is a single photograph, never a list');
globalThis.window.SMPStockPhotoMode = 'force';
P.recentStockPhotos.clear();
let repeats = 0, runsWithChoice = 0;
for (let brief = 0; brief < 40; brief++) {
  const key = 'variety-' + brief;
  let prev = null;
  for (let i = 0; i < 6; i++) {
    const r = P.pickStockPhoto({ industryText: 'healthcare clinic', memoryKey: key,
      hasCustomerPhoto: false, ...SIGN });
    if (!r) continue;
    /* how many valid alternatives existed at all */
    const alts = STOCK.photos.filter((p) => p.orientation === 'landscape'
      && p.industries.some((s) => r.briefIndustries.indexOf(s) !== -1)).length;
    if (alts > 1) { runsWithChoice++; if (prev && prev === r.photo.id) repeats++; }
    prev = r.photo.id;
  }
}
is(repeats === 0, 'a photo is never repeated back-to-back while another valid match exists',
   runsWithChoice + ' consecutive pairs checked');
const solo = STOCK.photos.filter((p) => p.industries.includes('funeral-memorial'));
is(solo.length === 1, 'an industry with exactly one match exists in the library');
P.recentStockPhotos.clear();
const a1 = P.pickStockPhoto({ industryText: 'funeral home', memoryKey: 'solo', hasCustomerPhoto: false, ...SIGN });
const a2 = P.pickStockPhoto({ industryText: 'funeral home', memoryKey: 'solo', hasCustomerPhoto: false, ...SIGN });
is(a1 && a2 && a1.photo.id === a2.photo.id,
   'and it is reused rather than swapped for something unrelated');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n10  a photo suppresses competing decoration');
globalThis.window.SMPStockPhotoMode = 'force';
globalThis.window.SMPAssetMode = 'force';
let maxAssets = 0, loud = 0, checked = 0;
for (let i = 0; i < RUNS; i++) {
  const stock = pick('florist', SIGN);
  const c = P.chooseCreativeDirection('', 'florist', 'Sign', 'balanced', 'sup-' + (i % 30),
    true, 36, 24, stock);
  if (!stock) continue;
  checked++;
  maxAssets = Math.max(maxAssets, c.assets.length);
  c.assets.forEach((a) => { if (P.PHOTO_SAFE_ASSET_FAMILIES.indexOf(a.family) === -1) loud++; });
}
is(maxAssets <= 1, 'at most ONE design asset joins a photograph', 'max ' + maxAssets + ' over ' + checked + ' runs');
is(loud === 0, 'and only from the quiet texture/frame families',
   P.PHOTO_SAFE_ASSET_FAMILIES.join(', '));
globalThis.window.SMPStockPhotoMode = 'off';
let withoutPhotoMax = 0;
for (let i = 0; i < RUNS; i++) {
  const c = P.chooseCreativeDirection('', 'florist', 'Sign', 'rich', 'nosup-' + (i % 30), true, 36, 24, null);
  withoutPhotoMax = Math.max(withoutPhotoMax, c.assets.length);
}
is(withoutPhotoMax > 1, 'with no photo, design-asset selection is untouched',
   'still reaches ' + withoutPhotoMax + ' assets');
globalThis.window.SMPStockPhotoMode = 'auto';
globalThis.window.SMPAssetMode = 'auto';

console.log('\n11  what reaches the model');
globalThis.window.SMPStockPhotoMode = 'force';
const sel = pick('dentist', SIGN);
const block = P.renderStockPhotoBlock(sel);
is(block.includes(sel.photo.url), 'the prompt carries the chosen photo\'s URL', sel.photo.url);
is(!/base64|data:image/i.test(block), 'and never base64 or a data: URI');
is((block.match(/assets\/stock-photo-library\//g) || []).length <= 2,
   'exactly one file is named — not a listing of the library');
STOCK.photos.forEach(() => {});
is(STOCK.photos.filter((p) => block.includes(p.file)).length === 1,
   'no other photograph is mentioned');
is(/scrim/i.test(block) && /band grades/i.test(block),
   'the scrim requirement and band grades travel with it');
const withPhoto = P.chooseCreativeDirection('', 'dentist', 'Sign', 'balanced', 'pk1', true, 36, 24, sel);
is(withPhoto.text.includes(sel.photo.url), 'and the direction text embeds that block');
const noPhoto = P.chooseCreativeDirection('', 'dentist', 'Sign', 'balanced', 'pk2', true, 36, 24, null);
is(!noPhoto.text.includes('SUPPLIED PHOTOGRAPH'),
   'a generation with no photo carries no photograph block at all');
is(/SUPPLIED PHOTOGRAPH — when the Style Direction supplies one/.test(P.HTML_PROMPT),
   'the HTML prompt states the photograph rules');
is(/<img> is allowed for a user-provided Image URL, for a supplied photograph/.test(P.HTML_PROMPT),
   'and permits the <img> that renders it');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n12  performance');
const t0 = process.hrtime.bigint();
const N = 20000;
for (let i = 0; i < N; i++) pick('dentist', SIGN);
const t1 = process.hrtime.bigint();
const per = Number(t1 - t0) / 1e6 / N;
console.log(`     ${N} selections in ${(Number(t1 - t0) / 1e6).toFixed(0)}ms — ${per.toFixed(4)}ms each`);
is(per < 1, 'selection is sub-millisecond', per.toFixed(4) + 'ms');
is(!/for[\s\S]{0,200}fetch\(/.test(ENGINE_SRC.split('function pickStockPhoto')[1].slice(0, 3000)),
   'selection opens no network connection of its own');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
