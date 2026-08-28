/* Asset runtime + performance.
   Selection must be local, cached and fast; the format classification must be
   right for the products actually used on web03; and a failure must be
   reported rather than silently looking like "no asset". */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const MANIFEST = JSON.parse(readFileSync(REPO + '/generator/assets/design-asset-manifest.json', 'utf8'));

let fetches = [];
let manifestFails = 0;
globalThis.window = {};
globalThis.fetch = async (u) => {
  fetches.push(String(u));
  if (String(u).includes('design-asset-manifest.json')) {
    if (manifestFails > 0) { manifestFails--; throw new Error('Blocked by demo guard'); }
    return { ok: true, json: async () => MANIFEST };
  }
  return { ok: false, status: 404 };
};

let src = readFileSync(REPO + '/generator/engine.js', 'utf8');
src = src.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { chooseCreativeDirection, loadAssetLibrary, isLargeFormatForAssets,'
  + ' LARGE_FORMAT_MIN_INCHES, DESIGN_DIRECTIONS };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const BCDP = { w: 3.5, h: 2 };          // BCDP-CM, the approved default product
const SIGN = { w: 18, h: 12 };          // a real sign, as designCentral-dev describes one

console.log('\n1  the manifest loads once, and a failure is not cached');
await P.loadAssetLibrary();
const afterFirst = fetches.filter((u) => u.includes('design-asset-manifest.json')).length;
for (let i = 0; i < 50; i++) await P.loadAssetLibrary();
const afterMany = fetches.filter((u) => u.includes('design-asset-manifest.json')).length;
is(afterFirst === 1 && afterMany === 1, 'one fetch, then cached for the life of the page',
   afterMany + ' fetch(es) after 51 calls');
is(!fetches.some((u) => /\.png(\?|$)/i.test(u)),
   'NO png is fetched to choose an asset', fetches.filter((u) => /\.png/i.test(u)).length + ' png fetches');

console.log('\n2  a blocked manifest is reported, not silently "no asset"');
{
  /* Fresh module instance with the first fetch failing, as the demo guard did. */
  let localFetches = [];
  globalThis.window = {};
  let fails = 1;
  globalThis.fetch = async (u) => {
    localFetches.push(String(u));
    if (String(u).includes('design-asset-manifest.json')) {
      if (fails-- > 0) throw new Error('Blocked by demo guard: production domains are unreachable');
      return { ok: true, json: async () => MANIFEST };
    }
    return { ok: false, status: 404 };
  };
  let s2 = readFileSync(REPO + '/generator/engine.js', 'utf8')
    .replace('window.handleGenerate = handleGenerate;',
      'globalThis.__q = { chooseCreativeDirection, loadAssetLibrary };')
    .replace('window.handleGenerateJson = handleGenerateJson;', '');
  // eslint-disable-next-line no-eval
  eval(s2);
  const Q = globalThis.__q;
  await Q.loadAssetLibrary();
  const blocked = Q.chooseCreativeDirection('', '', 'Business Card', 'balanced', 'b1', true, BCDP.w, BCDP.h);
  console.log('     reason:', JSON.stringify(blocked.assetReason));
  is(blocked.assets.length === 0, 'no asset while the manifest is unavailable');
  is(/did not load/.test(blocked.assetReason) && /Blocked by demo guard/.test(blocked.assetReason),
     'and the real reason is exposed', blocked.assetReason);
  await Q.loadAssetLibrary();   // the retry the old code never made
  let recovered = 0;
  for (let i = 0; i < 60; i++) {
    if (Q.chooseCreativeDirection('', '', 'Business Card', 'balanced', 'r' + i, true, BCDP.w, BCDP.h)
        .assets.length) recovered++;
  }
  is(recovered > 0, 'and the next attempt recovers instead of staying disabled for the session',
     recovered + '/60 used an asset after the retry');
}

console.log('\n3  product classification');
is(P.isLargeFormatForAssets('Business Card', BCDP.w, BCDP.h) === false,
   'BCDP-CM (3.5x2in, Business Card) = SMALL format');
is(P.isLargeFormatForAssets('Business Card', SIGN.w, SIGN.h) === true,
   'a real sign (18x12in) = LARGE format even when the Template Type still says Business Card',
   'this is the web03 case: the live catalogue carries no productFamily');
is(P.isLargeFormatForAssets('Sign', 18, 12) === true && P.isLargeFormatForAssets('Poster', 24, 36) === true
   && P.isLargeFormatForAssets('Banner', 96, 24) === true, 'Sign / Poster / Banner types = LARGE format');
is(P.isLargeFormatForAssets('Name Badge', 3, 1) === false, 'a small badge stays SMALL format');
is(P.LARGE_FORMAT_MIN_INCHES === 8, 'the geometry threshold is 8 inches on the long edge');

console.log('\n4  rates hold for the products actually used');
{
  const rate = (product, dim, mode, runs = 1200) => {
    globalThis.window.SMPAssetMode = mode;
    let used = 0;
    for (let i = 0; i < runs; i++) {
      if (P.chooseCreativeDirection('', '', product, 'balanced', 'rate-' + (i % 40),
        true, dim.w, dim.h).assets.length) used++;
    }
    globalThis.window.SMPAssetMode = 'auto';
    return used / runs;
  };
  const card = rate('Business Card', BCDP, 'auto');
  const sign = rate('Business Card', SIGN, 'auto');
  console.log(`     BCDP-CM ${Math.round(card * 100)}%  ·  real sign ${Math.round(sign * 100)}%`);
  is(card >= 0.62 && card <= 0.80, 'business cards ~73%', Math.round(card * 100) + '%');
  is(sign >= 0.88, 'a real sign 90-100%', Math.round(sign * 100) + '%');
}

console.log('\n5  Force Asset / No Asset');
{
  globalThis.window.SMPAssetMode = 'force';
  let forced = 0, forcedMax = 0, t0 = performance.now();
  for (let i = 0; i < 1200; i++) {
    const r = P.chooseCreativeDirection('', '', 'Business Card', 'balanced', 'force-' + (i % 40),
      true, BCDP.w, BCDP.h);
    if (r.assets.length) forced++;
    forcedMax = Math.max(forcedMax, r.assets.length);
  }
  const forceMs = (performance.now() - t0) / 1200;
  is(forced === 1200, 'Force Asset always selects one when a compatible family exists',
     forced + '/1200');
  is(forcedMax <= 3, 'and never exceeds the maximum count', 'max ' + forcedMax);

  globalThis.window.SMPAssetMode = 'off';
  let off = 0, offReason = '';
  for (let i = 0; i < 200; i++) {
    const r = P.chooseCreativeDirection('', '', 'Business Card', 'balanced', 'off-' + i, true, BCDP.w, BCDP.h);
    if (r.assets.length) off++;
    offReason = r.assetReason;
  }
  is(off === 0, 'No Asset selects nothing', off + ' selected');
  is(/No Asset/i.test(offReason), 'and says so', offReason);
  globalThis.window.SMPAssetMode = 'auto';

  console.log('\n6  selection cost');
  const time = (mode) => {
    globalThis.window.SMPAssetMode = mode;
    const N = 4000; const t = performance.now();
    for (let i = 0; i < N; i++) {
      P.chooseCreativeDirection('', '', 'Business Card', 'balanced', 'perf-' + (i % 40), true, BCDP.w, BCDP.h);
    }
    const ms = (performance.now() - t) / N;
    globalThis.window.SMPAssetMode = 'auto';
    return ms;
  };
  const auto = time('auto'), forceT = time('force'), offT = time('off');
  console.log(`     per generation — auto ${auto.toFixed(3)}ms · force ${forceT.toFixed(3)}ms · off ${offT.toFixed(3)}ms`);
  is(auto < 2, 'auto selection costs well under 2ms', auto.toFixed(3) + 'ms');
  is(forceT < 2, 'Force Asset uses the same fast path', forceT.toFixed(3) + 'ms');
  is(Math.abs(forceT - offT) < 1.5, 'forcing an asset costs no meaningful extra time',
     'force ' + forceT.toFixed(3) + 'ms vs off ' + offT.toFixed(3) + 'ms');
  is(!fetches.some((u) => /\.png/i.test(u)), 'and still no image was fetched during selection');
}

console.log('\n7  only the selected asset reaches the prompt');
{
  globalThis.window.SMPAssetMode = 'force';
  const r = P.chooseCreativeDirection('', '', 'Business Card', 'balanced', 'prompt', true, BCDP.w, BCDP.h);
  const named = MANIFEST.assets.filter((a) => r.text.includes(a.filename)).length;
  is(named === r.assets.length && named <= 3, 'the prompt names only the chosen file(s)',
     named + ' named, ' + r.assets.length + ' chosen');
  is(!/base64|data:image/i.test(r.text), 'nothing is base64-encoded into the prompt');
  is(r.text.length < 12000, 'the direction block stays small', r.text.length + ' chars');
  globalThis.window.SMPAssetMode = 'auto';
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
