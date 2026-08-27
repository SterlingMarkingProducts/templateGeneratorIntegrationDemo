/* Design asset library selection (Phase 2A).
   Loads engine.js in Node with the manifest served from disk, then asks the
   real selector for thousands of decisions and checks the contract. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const RUNS = Number(process.argv[3] || 600);

const MANIFEST = JSON.parse(readFileSync(REPO + '/generator/assets/design-asset-manifest.json', 'utf8'));
globalThis.window = {};
globalThis.fetch = async (u) => (String(u).includes('design-asset-manifest.json')
  ? { ok: true, json: async () => MANIFEST }
  : { ok: false, status: 404 });

let src = readFileSync(REPO + '/generator/engine.js', 'utf8');
src = src.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { chooseCreativeDirection, loadAssetLibrary, pickAssets,'
  + ' DIRECTION_ASSET_FAMILIES, ASSET_BUDGET, GATED_FAMILY_TRIGGERS, DESIGN_DIRECTIONS,'
  + ' recentAssetFamilies, HTML_PROMPT, SPEC_PROMPT };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
await P.loadAssetLibrary();

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const byName = Object.fromEntries(MANIFEST.assets.map((a) => [a.filename, a]));
const gen = (style, key, industry = '', dbl = true) =>
  P.chooseCreativeDirection(style, industry, 'Business Card', 'balanced', key, dbl);

console.log('\n1  the library is present and described');
is(MANIFEST.file_count === 80 && MANIFEST.assets.length === 80, 'the manifest describes 80 assets');
is(MANIFEST.assets.every((a) => a.url.startsWith('assets/design-library/')), 'every asset has a served URL');
is(Object.keys(MANIFEST.families).length >= 15, 'grouped into families',
   Object.keys(MANIFEST.families).length + ' families');
is(MANIFEST.assets.every((a) => (a.card_background_safe
    ? typeof a.behind_text_max_opacity === 'number' : a.behind_text_max_opacity === null)),
   'only text-safe assets carry an opacity ceiling');

console.log('\n2  how often an asset is used at all');
const stats = new Map();
for (let i = 0; i < RUNS * 4; i++) {
  const r = gen('', 'rate-' + (i % 40));
  const k = r.direction || 'user-chosen';
  const s = stats.get(k) || { runs: 0, none: 0, one: 0, two: 0, three: 0, fams: new Set(), files: new Set() };
  s.runs++;
  s[['none', 'one', 'two', 'three'][r.assets.length]]++;
  r.assets.forEach((a) => { s.fams.add(a.family); s.files.add(a.filename); });
  stats.set(k, s);
}
const rows = [...stats.entries()].sort();
rows.forEach(([k, s]) => console.log(
  `     ${k.padEnd(22)} none ${String(Math.round(s.none / s.runs * 100)).padStart(3)}%`
  + `  1 ${String(Math.round(s.one / s.runs * 100)).padStart(3)}%`
  + `  2 ${String(Math.round(s.two / s.runs * 100)).padStart(3)}%`
  + `  3 ${String(Math.round(s.three / s.runs * 100)).padStart(3)}%`
  + `   families: ${[...s.fams].join(',') || '—'}`));
const total = rows.reduce((a, [, s]) => a + s.runs, 0);
const noneAll = rows.reduce((a, [, s]) => a + s.none, 0);
is(noneAll / total > 0.3, 'a large share of all generations use NO asset',
   Math.round(noneAll / total * 100) + '% asset-free overall');

console.log('\n3  restrained directions can be completely asset-free');
for (const key of ['clean-corporate', 'editorial-minimal', 'elegant-serif', 'modern-luxury', 'soft-sophisticated']) {
  const s = stats.get(key);
  const d = P.DESIGN_DIRECTIONS.find((x) => x.key === key);
  is(s.none > 0, `${key}: asset-free generations happen`, Math.round(s.none / s.runs * 100) + '%');
  if (d.density === 'restrained') {
    is(s.two === 0 && s.three === 0, `${key} (restrained): never more than one asset`);
  }
}
is(stats.get('clean-corporate').none / stats.get('clean-corporate').runs > 0.8,
   'clean corporate is asset-free the large majority of the time',
   Math.round(stats.get('clean-corporate').none / stats.get('clean-corporate').runs * 100) + '%');

console.log('\n4  counts never exceed the density contract');
{
  let bad = [];
  for (let i = 0; i < RUNS * 4; i++) {
    const r = gen('', 'cap-' + (i % 30));
    const d = P.DESIGN_DIRECTIONS.find((x) => x.key === r.direction);
    if (!d) continue;
    const max = P.ASSET_BUDGET[d.density].max;
    if (r.assets.length > max) bad.push(`${d.key}/${d.density}:${r.assets.length}>${max}`);
  }
  is(bad.length === 0, 'restrained ≤1, balanced ≤2, rich ≤3', bad.slice(0, 3).join(' ') || 'clean');
}

console.log('\n5  families match the direction');
{
  let wrong = [];
  for (const [key, s] of stats) {
    if (key === 'user-chosen') continue;
    const allowed = new Set((P.DIRECTION_ASSET_FAMILIES[key] || []).concat(Object.keys(P.GATED_FAMILY_TRIGGERS)));
    [...s.fams].forEach((f) => { if (!allowed.has(f)) wrong.push(key + '/' + f); });
  }
  is(wrong.length === 0, 'no direction drew a family it is not allowed', wrong.join(',') || 'clean');
  const lux = stats.get('modern-luxury').fams;
  is(![...lux].some((f) => ['flat-blob', 'doodle', 'glossy-3d', 'promo'].includes(f)),
     'modern luxury never draws blobs, doodles, 3D or promo', [...lux].join(','));
  const bold = stats.get('bold-modernist').fams;
  is(![...bold].some((f) => ['watercolour-wash', 'floral-cluster', 'gold-frame'].includes(f)),
     'bold modernist never draws washes, florals or gold frames', [...bold].join(','));
}

console.log('\n6  gated families need the brief to ask');
{
  const seen = new Set();
  for (let i = 0; i < RUNS * 4; i++) gen('', 'gate-' + (i % 30)).assets.forEach((a) => seen.add(a.family));
  const gated = Object.keys(P.GATED_FAMILY_TRIGGERS);
  is(!gated.some((g) => seen.has(g)), 'no figurative / promo / postal / newsprint / floral-cluster on a plain brief',
     [...seen].filter((f) => gated.includes(f)).join(',') || 'none of them');
  let floral = false, promo = false;
  for (let i = 0; i < RUNS; i++) {
    gen('', 'f-' + i, 'Wedding florist').assets.forEach((a) => { if (a.family === 'floral-cluster') floral = true; });
    gen('', 'p-' + i, 'Clearance sale promo').assets.forEach((a) => { if (a.family === 'promo') promo = true; });
  }
  is(floral, 'a florist / wedding brief CAN reach the floral clusters');
  is(promo, 'a promo brief CAN reach the promo burst');
}

console.log('\n7  behind-text safety');
{
  let unsafeBehind = [];
  for (let i = 0; i < RUNS * 4; i++) {
    const r = gen('', 'safe-' + (i % 30));
    for (const a of r.assets) {
      const meta = byName[a.filename];
      const block = r.text;
      if (!meta.card_background_safe && new RegExp(a.filename.replace(/\./g, '\\.') + '[\\s\\S]{0,400}MAY sit behind text').test(block)) {
        unsafeBehind.push(a.filename);
      }
    }
  }
  is(unsafeBehind.length === 0, 'an asset not cleared for text is never offered as a background',
     [...new Set(unsafeBehind)].slice(0, 3).join(',') || 'clean');
  const withSafe = (() => {
    for (let i = 0; i < RUNS * 4; i++) {
      const r = gen('', 'op-' + (i % 30));
      if (r.assets.some((a) => byName[a.filename].card_background_safe)) return r.text;
    }
    return '';
  })();
  is(/at no more than \d+% opacity/.test(withSafe), 'a text-safe asset carries an explicit opacity ceiling');
  is(/must NOT sit behind text/.test(
       (() => { for (let i = 0; i < RUNS * 4; i++) { const r = gen('', 'ns-' + (i % 30));
         if (r.assets.some((a) => !byName[a.filename].card_background_safe)) return r.text; } return ''; })()),
     'a non-safe asset is explicitly kept out from behind text');
}

console.log('\n8  the asset replaces a drawn element and is optional');
{
  const withAsset = (() => { for (let i = 0; i < RUNS * 4; i++) {
    const r = gen('', 'opt-' + (i % 30)); if (r.assets.length) return r.text; } return ''; })();
  is(/REPLACES one|REPLACE \d+ of the/.test(withAsset), 'the prompt says it replaces a drawn element');
  is(/INCLUDING the supplied file/.test(withAsset), 'and that the density budget includes it');
  is(/OPTIONAL/.test(withAsset), 'and that using it is optional');
  is(/Do not force/.test(withAsset), 'and that it must not be forced in');
}

console.log('\n9  only the chosen assets reach the model');
{
  let worst = 0;
  for (let i = 0; i < RUNS; i++) {
    const t = gen('', 'leak-' + (i % 20)).text;
    const named = MANIFEST.assets.filter((a) => t.includes(a.filename)).length;
    worst = Math.max(worst, named);
  }
  is(worst <= 3, 'never more than three filenames in a prompt', 'max seen ' + worst);
}

console.log('\n10  family repetition is avoided on repeat generations');
{
  let backToBack = 0, runs = 0, prev = null;
  for (let i = 0; i < RUNS * 2; i++) {
    const r = gen('', 'repeat-fam');
    const fams = r.assets.map((a) => a.family).sort().join('+');
    if (fams && prev) { runs++; if (fams === prev) backToBack++; }
    if (fams) prev = fams;
  }
  const rate = runs ? backToBack / runs : 0;
  console.log(`     ${runs} consecutive asset-using pairs, identical family set ${backToBack}`
    + ` (${(rate * 100).toFixed(1)}%)`);
  /* Not "never": a direction whose allowed list is one family — clean corporate
     has only texture-neutral — has nothing else to move to, and forcing a wrong
     family to avoid a repeat would be worse than the repeat. The memory keeps it
     to a fraction of a percent. */
  is(rate < 0.01, 'back-to-back family repeats are rare (<1%)', (rate * 100).toFixed(1) + '%');
}

console.log('\n11  stamps and missing libraries');
{
  const st = P.chooseCreativeDirection('', '', 'Self-Inking Stamp', 'balanced', 'stamp', false);
  is(st.assets.length === 0 && !/SUPPLIED DESIGN ASSET/.test(st.text), 'stamps never receive an asset');
  is(/monochromatic black ink on white ONLY/.test(st.text), 'stamp rules intact');
  is(/SUPPLIED DESIGN ASSETS — when the Style Direction lists one/.test(P.HTML_PROMPT),
     'the HTML prompt explains how to use a supplied asset');
  is(/<img> is allowed for a user-provided Image URL and for any supplied design asset/.test(P.HTML_PROMPT),
     'and permits <img> for it without opening up external images generally');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
