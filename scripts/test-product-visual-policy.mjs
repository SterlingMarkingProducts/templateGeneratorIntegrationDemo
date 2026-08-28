/* Product-family visual policy: seeded batch verification of the EFFECTIVE
 * probabilities from PRODUCT_VISUAL_POLICY through the real selectors.
 * Windows are generous enough for sampling noise at N=6000 but tight enough
 * that a policy regression (or a second rule cancelling the policy) fails. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const N = Number(process.argv[3] || 6000);

const STOCK  = JSON.parse(readFileSync(REPO + '/generator/assets/stock-photo-manifest.json', 'utf8'));
const ASSETS = JSON.parse(readFileSync(REPO + '/generator/assets/design-asset-manifest.json', 'utf8'));
const LOGOS  = JSON.parse(readFileSync(REPO + '/generator/assets/logo-asset-manifest.json', 'utf8'));
globalThis.window = {};
globalThis.fetch = async (u) => {
  const s = String(u);
  if (s.includes('stock-photo-manifest.json'))  return { ok: true, json: async () => STOCK };
  if (s.includes('design-asset-manifest.json')) return { ok: true, json: async () => ASSETS };
  if (s.includes('logo-asset-manifest.json'))   return { ok: true, json: async () => LOGOS };
  return { ok: false, status: 404 };
};
let src = readFileSync(REPO + '/generator/engine.js', 'utf8')
  .replace('window.handleGenerate = handleGenerate;',
    'globalThis.__p = { loadAssetLibrary, loadStockPhotoLibrary, loadLogoLibrary,'
    + ' pickStockPhoto, pickAssets, pickLogo, stockProductClass, PRODUCT_VISUAL_POLICY };')
  .replace('window.handleGenerateJson = handleGenerateJson;', '');
eval(src);
const P = globalThis.__p;
await P.loadStockPhotoLibrary(); await P.loadAssetLibrary(); await P.loadLogoLibrary();

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const inWin = (v, lo, hi) => v >= lo && v <= hi;

let seq = 0;
function rates(tt, w, h) {
  let stock = 0, logo = 0, asset = 0;
  for (let i = 0; i < N; i++) {
    const key = 'k' + (seq++);   // a fresh brief per run: independent draws
    const s = P.pickStockPhoto({ templateType: tt, widthIn: w, heightIn: h,
      industryText: 'dentist', explicitIndustry: 'dentist', memoryKey: key });
    if (s) stock++;
    const l = P.pickLogo({ templateType: tt, widthIn: w, heightIn: h,
      industryText: 'dentist', memoryKey: key });
    if (l) logo++;
    const a = P.pickAssets('modern-luxury', 'balanced', 'dentist', key, false, tt, w, h, !!s, !!l);
    if (a && a.length) asset++;
  }
  return { stock: 100 * stock / N, logo: 100 * logo / N, asset: 100 * asset / N };
}
const pct = (x) => x.toFixed(1) + '%';

console.log('promo family: postcards / signs / posters / banners → stock ≈ 80%');
for (const [tt, w, h] of [['Postcard', 6, 4], ['Sign', 36, 24], ['Poster', 24, 18], ['Banner', 72, 24]]) {
  const r = rates(tt, w, h);
  is(P.stockProductClass(tt, w, h) === 'general', tt + ' classifies as promo/general');
  is(inWin(r.stock, 76, 84), tt + ' stock ≈ 80%', pct(r.stock));
}

console.log('brochure → stock 100% when a compatible pool exists');
const br = rates('Brochure', 11, 8.5);
is(P.stockProductClass('Brochure', 11, 8.5) === 'brochure', 'Brochure is its own class');
is(br.stock === 100, 'brochure stock = 100%', pct(br.stock));

console.log('stamp → zero stock, zero assets, logos allowed');
const st = rates('Stamp', 2, 1);
is(st.stock === 0, 'stamp stock = 0%', pct(st.stock));
is(st.asset === 0, 'stamp assets = 0%', pct(st.asset));
is(inWin(st.logo, 40, 60), 'stamp logos still draw normally', pct(st.logo));

console.log('name badge + nameplate → independent 20% / 60% / 80–90%');
for (const [tt, w, h] of [['Name Badge', 3, 1.5], ['Nameplate', 8, 2]]) {
  const r = rates(tt, w, h);
  is(inWin(r.stock, 16, 24), tt + ' stock ≈ 20%', pct(r.stock));
  is(inWin(r.logo, 55, 65), tt + ' logo ≈ 60%', pct(r.logo));
  is(inWin(r.asset, 78, 92), tt + ' asset in the 80–90% window', pct(r.asset));
}

console.log('business card → unchanged ≈ 14%');
const bc = rates('Business Card', 3.5, 2);
is(inWin(bc.stock, 11, 17), 'card stock ≈ 14%', pct(bc.stock));

console.log('guards: never an unrelated photo, customer input always wins');
let miss = 0, cust = 0, brNoPool = 0;
for (let i = 0; i < 2000; i++) {
  if (P.pickStockPhoto({ templateType: 'Sign', widthIn: 36, heightIn: 24,
    industryText: 'volcano research submarine', explicitIndustry: 'volcano research submarine',
    memoryKey: 'x' + i })) miss++;
  if (P.pickStockPhoto({ templateType: 'Brochure', widthIn: 11, heightIn: 8.5,
    industryText: 'dentist', explicitIndustry: 'dentist', memoryKey: 'c' + i,
    hasCustomerPhoto: true })) cust++;
  if (P.pickStockPhoto({ templateType: 'Brochure', widthIn: 11, heightIn: 8.5,
    industryText: 'volcano research submarine', explicitIndustry: 'volcano research submarine',
    memoryKey: 'b' + i })) brNoPool++;
}
is(miss === 0, 'an incompatible industry NEVER receives a random photo', miss + ' picks');
is(cust === 0, 'a customer photo suppresses stock even at brochure 100%', cust + ' picks');
is(brNoPool === 0, 'brochure 100% does NOT force an unrelated photo when no pool exists', brNoPool + ' picks');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
