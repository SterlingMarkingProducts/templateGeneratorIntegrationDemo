/* Logo library selection (Phase 2D): customer logo wins, tier gating, product
   policies, the shared visual budget, variety, and performance. */
import { readFileSync, existsSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const RUNS = Number(process.argv[3] || 400);

const LOGOS  = JSON.parse(readFileSync(REPO + '/generator/assets/logo-asset-manifest.json', 'utf8'));
const STOCK  = JSON.parse(readFileSync(REPO + '/generator/assets/stock-photo-manifest.json', 'utf8'));
const ASSETS = JSON.parse(readFileSync(REPO + '/generator/assets/design-asset-manifest.json', 'utf8'));
globalThis.window = {};
globalThis.fetch = async (u) => {
  const s = String(u);
  if (s.includes('logo-asset-manifest.json'))   return { ok: true, json: async () => LOGOS };
  if (s.includes('stock-photo-manifest.json'))  return { ok: true, json: async () => STOCK };
  if (s.includes('design-asset-manifest.json')) return { ok: true, json: async () => ASSETS };
  return { ok: false, status: 404 };
};
const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { pickLogo, loadLogoLibrary, loadStockPhotoLibrary, loadAssetLibrary,'
  + ' renderLogoBlock, chooseCreativeDirection, recentLogos, LOGO_NONE,'
  + ' PHOTO_SAFE_ASSET_FAMILIES, HTML_PROMPT,'
  + ' get lastLogoReason() { return lastLogoReason; } };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
await P.loadLogoLibrary();
await P.loadStockPhotoLibrary();
await P.loadAssetLibrary();

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const SIGN = { templateType: 'Sign', widthIn: 36, heightIn: 24 };
const CARD = { templateType: 'Business Card', widthIn: 3.5, heightIn: 2 };
const STAMP = { templateType: 'Stamp', widthIn: 2.25, heightIn: 0.8 };
const BADGE = { templateType: 'Name Badge', widthIn: 3, heightIn: 1.5 };
let seq = 0;
const pick = (industryText, geom = SIGN, extra = {}) => P.pickLogo(Object.assign({
  industryText, memoryKey: 'lg' + (seq++), hasCustomerLogo: false }, geom, extra));

console.log('\n1  the library is present and tiered');
is(LOGOS.file_count === 30 && LOGOS.logos.length === 30, '30 marks in the manifest');
is(LOGOS.logos.every((l) => existsSync(REPO + '/generator/' + l.url)), 'every file exists on disk');
is(!JSON.stringify(LOGOS).includes('/tmp/'), 'no /tmp path in the committed manifest');
const A = LOGOS.logos.filter((l) => l.tier === 'A'), B = LOGOS.logos.filter((l) => l.tier === 'B');
is(A.length === 18 && B.length === 12, 'tiered 18 broad / 12 industry-literal', A.length + '/' + B.length);
is(B.every((l) => l.industries.length > 0), 'every Tier B mark declares its industries');

console.log('\n2  the customer logo always wins');
globalThis.window.SMPLogoMode = 'force';
let cust = 0;
for (let i = 0; i < 200; i++) if (pick('dentist', SIGN, { hasCustomerLogo: true })) cust++;
is(cust === 0, 'even Force never selects over a supplied logo');
pick('dentist', SIGN, { hasCustomerLogo: true });
is(P.lastLogoReason === 'the customer supplied their own logo', 'and says so', P.lastLogoReason);
is(/const hasCustomerLogo = !!\(\(svgContent \|\| ''\)\.trim\(\)\)/.test(ENGINE_SRC),
   'handleGenerate derives that gate from the supplied SVG');

console.log('\n3  tier gating — a literal mark only for its own trade');
const CASES = [
  ['dentist',            '22_dental_tooth.png'],
  ['dental clinic',      '22_dental_tooth.png'],
  ['chiropractor',       '21_chiropractic_spine.png'],
  ['law firm',           null],   // 23_legal_scales or 16_continuous_knot — both legal
  ['real estate agency', '25_real_estate_entry.png'],
  ['construction',       '26_construction_beams.png'],
  ['accounting',         '27_finance_growth.png'],
  ['restaurant',         '28_hospitality_cloche.png'],
  ['yoga studio',        '30_wellness_lotus.png'],
];
let tierOk = true;
CASES.forEach(([text, file]) => {
  for (let i = 0; i < 40; i++) {
    const r = pick(text);
    if (!r) { tierOk = false; console.log('     NONE ' + text + ' -> ' + P.lastLogoReason); break; }
    if (r.tier !== 'B') { tierOk = false; console.log('     A?? ' + text + ' -> ' + r.logo.filename); break; }
    if (file && r.logo.filename !== file
        && !r.logo.industries.some((sl) => r.matchedIndustries.indexOf(sl) !== -1)) {
      tierOk = false; console.log('     BAD ' + text + ' -> ' + r.logo.filename); break;
    }
  }
});
is(tierOk, 'every literal-mark trade receives its own mark');
let crossed = 0;
['dentist', 'law firm', 'construction'].forEach((t) => {
  for (let i = 0; i < 60; i++) {
    const r = pick(t);
    if (!r || r.tier !== 'B') continue;
    const okSets = { dentist: ['22_dental_tooth.png'],
      'law firm': ['23_legal_scales.png', '16_continuous_knot.png'],
      construction: ['26_construction_beams.png'] };
    if (okSets[t].indexOf(r.logo.filename) === -1) { crossed++; console.log('     CROSS ' + t + ' -> ' + r.logo.filename); }
  }
});
is(crossed === 0, 'a dentist never gets scales, a lawyer never gets a lotus, and so on');
let unmatchedTierB = 0;
for (let i = 0; i < 200; i++) {
  const r = pick('Quantum Widget Foundry');
  if (r && r.tier === 'B') unmatchedTierB++;
}
is(unmatchedTierB === 0, 'no industry match -> only neutral Tier A marks are drawn');

console.log('\n4  product policies');
let stampLogos = 0, badgeLogos = 0;
for (let i = 0; i < 100; i++) {
  if (pick('dentist', STAMP)) stampLogos++;
  if (pick('dentist', BADGE)) badgeLogos++;
}
is(stampLogos === 100 && badgeLogos === 100, 'Force finds a mark on stamps and name badges alike');
const stampCreative = P.chooseCreativeDirection('', 'dentist', 'Stamp', 'balanced', 'st1', false, 2.25, 0.8,
  null, pick('dentist', STAMP));
is(/SUPPLIED BRAND MARK/.test(stampCreative.text) && /PURE BLACK/.test(stampCreative.text),
   'a stamp carries the mark with the pure-black rule');
is(stampCreative.assets.length === 0, 'while stamps still take no design assets');
globalThis.window.SMPAssetMode = 'force';
const badgeCreative = P.chooseCreativeDirection('', 'dentist', 'Nameplate', 'balanced', 'np1', false, 8, 2,
  null, pick('dentist', BADGE));
is(badgeCreative.assets.length > 0, 'name badges and nameplates may carry design assets alongside the mark');
globalThis.window.SMPAssetMode = 'auto';

console.log('\n5  the visual budget is one system');
globalThis.window.SMPAssetMode = 'force';
let withLogoMax = 0;
for (let i = 0; i < RUNS; i++) {
  const c = P.chooseCreativeDirection('', 'florist', 'Sign', 'rich', 'vb' + (i % 20), true, 36, 24,
    null, { logo: LOGOS.logos[0], tier: 'A', matchedIndustries: [], mode: 'force' });
  withLogoMax = Math.max(withLogoMax, c.assets.length);
}
is(withLogoMax <= 2, 'a mark consumes a slot: never more than TWO assets beside it', 'max ' + withLogoMax);
let heroCombo = 0;
for (let i = 0; i < RUNS; i++) {
  const photoSel = { photo: STOCK.photos[0], industry: 'florist', matchedIndustries: [],
    briefIndustries: [], productClass: 'general', largeFormat: true, roles: [], mode: 'force' };
  const c = P.chooseCreativeDirection('', 'florist', 'Sign', 'rich', 'hc' + (i % 20), true, 36, 24,
    photoSel, { logo: LOGOS.logos[0], tier: 'A', matchedIndustries: [], mode: 'force' });
  heroCombo = Math.max(heroCombo, c.assets.length);
  c.assets.forEach((a) => { if (P.PHOTO_SAFE_ASSET_FAMILIES.indexOf(a.family) === -1) heroCombo = 99; });
}
is(heroCombo <= 1, 'photo hero + mark -> decoration collapses to at most one quiet piece', 'max ' + heroCombo);
globalThis.window.SMPAssetMode = 'auto';
const withMark = P.chooseCreativeDirection('', 'florist', 'Sign', 'balanced', 'pm1', true, 36, 24,
  null, { logo: LOGOS.logos[0], tier: 'A', matchedIndustries: [], mode: 'auto' });
is(/SUPPLIED BRAND MARK/.test(withMark.text) && /CONSUMES one signature/.test(withMark.text),
   'the prompt states the slot rule');
is(/mask:url\(/.test(withMark.text) && /Preserve its aspect ratio and transparency/.test(withMark.text),
   'and the recolour + no-distortion rules');
is(/SUPPLIED BRAND MARK — when the Style Direction supplies one/.test(P.HTML_PROMPT),
   'the HTML prompt carries the brand-mark rules');

console.log('\n6  frequency, variety, performance');
globalThis.window.SMPLogoMode = 'auto';
let hits = 0;
for (let i = 0; i < RUNS * 2; i++) if (pick('dentist', CARD)) hits++;
const rate = hits / (RUNS * 2);
is(rate > 0.35 && rate < 0.65, 'Auto uses a mark about half the time, never always',
   Math.round(rate * 100) + '%');
globalThis.window.SMPLogoMode = 'force';
P.recentLogos.clear();
let repeats = 0, pairs = 0;
for (let b = 0; b < 30; b++) {
  let prev = null;
  for (let i = 0; i < 5; i++) {
    const r = P.pickLogo({ industryText: 'consulting firm', memoryKey: 'var-' + b,
      hasCustomerLogo: false, ...SIGN });
    if (!r) continue;
    if (prev) { pairs++; if (prev === r.logo.filename) repeats++; }
    prev = r.logo.filename;
  }
}
is(repeats === 0, 'never the same mark twice in a row while alternatives exist', pairs + ' pairs');
const t0 = process.hrtime.bigint();
for (let i = 0; i < 20000; i++) pick('dentist');
const per = Number(process.hrtime.bigint() - t0) / 1e6 / 20000;
is(per < 1, 'selection is sub-millisecond', per.toFixed(4) + 'ms');
const block = P.renderLogoBlock({ logo: LOGOS.logos[0], tier: 'A' }, false);
is(!/base64|data:image/.test(block) && (block.match(/assets\/logo-library\//g) || []).length === 1,
   'one URL travels to the model — never the library, never base64');
globalThis.window.SMPLogoMode = 'auto';

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
