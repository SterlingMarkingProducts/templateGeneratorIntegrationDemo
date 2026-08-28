/* Semantic visual-library selection: the user's words control candidates.
 * Runs the REAL selectors (Node-eval harness) against the REAL manifests. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const load = (f) => JSON.parse(readFileSync(REPO + '/generator/assets/' + f, 'utf8'));
const STOCK = load('stock-photo-manifest.json'), ASSETS = load('design-asset-manifest.json'), LOGOS = load('logo-asset-manifest.json');
globalThis.window = {};
globalThis.fetch = async (u) => {
  const s = String(u);
  if (s.includes('stock-photo-manifest')) return { ok: true, json: async () => STOCK };
  if (s.includes('design-asset-manifest')) return { ok: true, json: async () => ASSETS };
  if (s.includes('logo-asset-manifest')) return { ok: true, json: async () => LOGOS };
  return { ok: false, status: 404 };
};
let src = readFileSync(REPO + '/generator/engine.js', 'utf8')
  .replace('window.handleGenerate = handleGenerate;',
    'globalThis.__p = { loadAssetLibrary, loadStockPhotoLibrary, loadLogoLibrary, pickAssets,'
    + ' pickStockPhoto, pickLogo, DIRECTION_STYLE_CHIPS, DIRECTION_BY_KEY, DEFAULT_DIRECTION_POOL,'
    + ' DIRECTION_ASSET_FAMILIES, PRODUCT_VISUAL_POLICY, expandConceptTerms };')
  .replace('window.handleGenerateJson = handleGenerateJson;', '');
eval(src);
const P = globalThis.__p;
await P.loadAssetLibrary(); await P.loadStockPhotoLibrary(); await P.loadLogoLibrary();

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
let seq = 0;
const pick = (instr, opts) => P.pickAssets(
  (opts && opts.direction) || 'modern-luxury', (opts && opts.density) || 'balanced',
  ['brief', (opts && opts.industry) || '', instr || ''].join(' '), 'k' + (seq++), false,
  (opts && opts.tt) || 'Business Card', (opts && opts.w) || 3.5, (opts && opts.h) || 2,
  !!(opts && opts.photo), false, instr || '', (opts && opts.industry) || '');

console.log('1  special instructions control asset selection (100 seeded runs each)');
const always = (instr, test, opts) => {
  for (let i = 0; i < 100; i++) {
    const got = pick(instr, opts);
    if (!got.length || !got.some(test)) return { ok: false, got: got.map((a) => a.filename).join(',') || 'none' };
  }
  return { ok: true };
};
let r = always('watercolor', (a) => a.family === 'watercolour-wash');
is(r.ok, '"watercolor" ALWAYS selects a watercolour-wash asset', r.got);
r = always('watercolour', (a) => a.family === 'watercolour-wash');
is(r.ok, '"watercolour" (UK spelling) too', r.got);
r = always('sparkle', (a) => /sparkle|starburst/i.test(a.filename));
is(r.ok, '"sparkle" selects a sparkle/star asset', r.got);
r = always('eye', (a) => /eye/i.test(a.filename));
is(r.ok, '"eye" selects the eye asset', r.got);
r = always('torn paper', (a) => a.family === 'torn-paper' || /torn/i.test(a.filename));
is(r.ok, '"torn paper" selects a torn-paper asset', r.got);
r = always('tape', (a) => a.family === 'tape');
is(r.ok, '"tape" selects a tape asset', r.got);
r = always('line art', (a) => /line_art|single/i.test(a.filename) || a.family === 'figurative');
is(r.ok, '"line art" selects a line-art asset', r.got);
const one = pick('watercolor');
is(one.length && /special-instruction match "(watercolour|watercolor|wash)"/.test(one[0].selectionReason || ''),
  'the DEV reason names the special-instruction match', one[0] && one[0].selectionReason);
// restrained density with no explicit request can still draw nothing
let none = 0;
for (let i = 0; i < 300; i++) { if (!pick('', { direction: 'clean-corporate', density: 'restrained' }).length) none++; }
is(none > 100, 'no explicit request → a restrained design may still use zero assets', none + '/300 drew none');

console.log('2  industry relevance beats generic decoration');
const whenDrawn = (instr, test, opts) => {
  let drawn = 0;
  for (let i = 0; i < 150; i++) {
    const got = pick(instr, opts);
    if (!got.length) continue;
    drawn++;
    if (!test(got[0])) return { ok: false, got: got[0].filename };
  }
  return { ok: drawn > 20, got: drawn + ' draws' };
};
r = whenDrawn('', (a) => /face|bust|eye/i.test(a.filename) || /salon|beauty/.test(String(a.use_cases)),
  { industry: 'hair salon' });
is(r.ok, 'hair salon: whenever assets ARE drawn, a beauty/face asset outranks generic decoration', r.got);
const salonPick = pick('', { industry: 'hair salon' });
is(!salonPick.length || /industry match/.test(salonPick[0].selectionReason || ''),
  'and the reason says industry match', salonPick[0] && salonPick[0].selectionReason);

console.log('3  hair-salon banner stock photography');
let hit = 0, relevant = 0, n = 3000;
for (let i = 0; i < n; i++) {
  const s = P.pickStockPhoto({ templateType: 'Banner', widthIn: 72, heightIn: 24,
    industryText: 'hair salon', explicitIndustry: 'hair salon', memoryKey: 'b' + (seq++) });
  if (s) { hit++; if ((s.photo.depicts || []).indexOf('hair-salon') !== -1) relevant++; }
}
is(hit / n > 0.76 && hit / n < 0.85, 'banner + "hair salon" → ~80% photo rate', (100 * hit / n).toFixed(1) + '%');
is(relevant === hit, 'every selected photo actually depicts the hair salon', relevant + '/' + hit);
const s1 = P.pickStockPhoto({ templateType: 'Banner', widthIn: 72, heightIn: 24,
  industryText: 'hair salon', explicitIndustry: 'hair salon', memoryKey: 'bb' });
if (s1) is(/industry match "hair-salon"/.test(s1.reason || ''), 'photo reason names the industry match', s1.reason);

console.log('4  style direction → asset families');
is(P.DIRECTION_STYLE_CHIPS['Watercolor'] === 'watercolor'
   && !!P.DIRECTION_BY_KEY['watercolor']
   && /watercolour|watercolor/i.test(P.DIRECTION_BY_KEY['watercolor'].brief),
   'Watercolor is a real Style Direction');
is(/never simulated|never drawn/.test(P.DIRECTION_BY_KEY['watercolor'].brief),
   'its brief forbids fake CSS/SVG watercolour and drawn botanicals');
is(P.DEFAULT_DIRECTION_POOL.indexOf('watercolor') === -1,
   'Watercolor is an explicit choice, not part of the Auto rotation');
is((P.DIRECTION_ASSET_FAMILIES['watercolor'] || [])[0] === 'watercolour-wash',
   'the direction prefers the watercolour-wash family');
r = whenDrawn('', (a) => a.family === 'watercolour-wash' || a.family === 'texture-neutral' || a.family === 'botanical-spray',
  { direction: 'watercolor', density: 'rich' });
is(r.ok, 'watercolor direction draws from its own families', r.got);
r = whenDrawn('', (a) => ['torn-paper', 'tape', 'brushstroke', 'texture-neutral', 'newsprint'].indexOf(a.family) !== -1,
  { direction: 'collage-editorial', density: 'rich' });
is(r.ok, 'collage-editorial draws collage-language families', r.got);
is((P.DIRECTION_ASSET_FAMILIES['organic-botanical'] || []).indexOf('botanical-spray') !== -1,
   'organic-botanical still reaches the existing botanical assets');

console.log('5  policy and priority rules unchanged');
const st = pick('watercolor', { tt: 'Stamp', w: 2, h: 1 });
is(st.length === 0, 'stamps stay at zero assets even with an explicit request');
let stStock = 0, cardHit = 0, brochureHit = 0, cust = 0;
for (let i = 0; i < 2000; i++) {
  if (P.pickStockPhoto({ templateType: 'Stamp', widthIn: 2, heightIn: 1,
    industryText: 'dentist', explicitIndustry: 'dentist', memoryKey: 's' + (seq++) })) stStock++;
  if (P.pickStockPhoto({ templateType: 'Business Card', widthIn: 3.5, heightIn: 2,
    industryText: 'dentist', explicitIndustry: 'dentist', memoryKey: 'c' + (seq++) })) cardHit++;
  if (P.pickStockPhoto({ templateType: 'Brochure', widthIn: 11, heightIn: 8.5,
    industryText: 'dentist', explicitIndustry: 'dentist', memoryKey: 'br' + (seq++) })) brochureHit++;
  if (P.pickStockPhoto({ templateType: 'Brochure', widthIn: 11, heightIn: 8.5,
    industryText: 'dentist', explicitIndustry: 'dentist', memoryKey: 'cu' + (seq++), hasCustomerPhoto: true })) cust++;
}
is(stStock === 0, 'stamp stock stays 0');
is(cardHit / 2000 > 0.11 && cardHit / 2000 < 0.17, 'business card stays ~14%', (100 * cardHit / 2000).toFixed(1) + '%');
is(brochureHit === 2000, 'brochure stays 100% with a pool', brochureHit + '/2000');
is(cust === 0, 'customer photo still wins');
const lg = P.pickLogo({ templateType: 'Sign', widthIn: 24, heightIn: 18,
  industryText: 'dentist', memoryKey: 'lg', hasCustomerLogo: true });
is(lg === null, 'customer logo still wins');
const V = P.PRODUCT_VISUAL_POLICY;
is(V.stamp.stock === 0 && V.nameplate.stock === 0.20 && V.nameplate.logo === 0.60
   && V.nameplate.assetCap === 0.85 && V.card.stock === 0.14 && V.brochure.stock === 1.0
   && V.promo.stock === 0.80, 'PRODUCT_VISUAL_POLICY is byte-identical');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
