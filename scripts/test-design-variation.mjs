/* Design-fingerprint variation harness.
   Measures how different two consecutive generations of the SAME brief are, and
   proves the fingerprint stays compatible with the direction it was drawn for. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const RUNS = Number(process.argv[3] || 400);

let src = readFileSync(REPO + '/generator/engine.js', 'utf8');
src = src.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { chooseCreativeDirection, FINGERPRINT_AXES, DIRECTION_PALETTES,'
  + ' DESIGN_DIRECTIONS, DENSITY_CONTRACTS, fingerprintOptions };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
globalThis.window = {};
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const gen = (style, key, dbl = true) =>
  P.chooseCreativeDirection(style, 'Consulting', 'Business Card', 'balanced', key, dbl);
const sig = (r) => r.fingerprint.map((f) => f.id).join('|');
const head = (r) => r.fingerprint.slice(0, 3).map((f) => f.id).join('|');

console.log('\n1  the fingerprint reaches the prompt');
{
  const r = gen('', 'k1');
  is(/DESIGN FINGERPRINT/.test(r.text), 'the block is in the Style Direction');
  is(r.fingerprint.length === 9, 'nine axes on a double-sided brief', String(r.fingerprint.length));
  is(gen('', 'k1b', false).fingerprint.length === 8, 'eight when the product is single-sided');
  const axes = r.fingerprint.map((f) => f.axis);
  console.log('     axes:', axes.join(', '));
  is(new Set(axes).size === axes.length, 'one option per axis, no duplicates');
}

console.log('\n2  consecutive generations of the SAME brief differ');
{
  let sameSig = 0, sameHead = 0, sameDir = 0;
  let prev = gen('', 'repeat');
  for (let i = 0; i < RUNS; i++) {
    const next = gen('', 'repeat');
    if (sig(next) === sig(prev)) sameSig++;
    if (head(next) === head(prev)) sameHead++;
    if (next.direction && next.direction === prev.direction) sameDir++;
    prev = next;
  }
  console.log(`     over ${RUNS} consecutive regenerations: identical fingerprint ${sameSig},`
    + ` identical top-3 axes ${sameHead}, same direction ${sameDir}`);
  is(sameSig === 0, 'never the identical fingerprint twice in a row');
  is(sameHead === 0, 'never the same composition/alignment/type voice twice in a row');
  is(sameDir === 0, 'never the same direction twice in a row');
}

console.log('\n3  the same brief spreads across the whole space');
{
  const seen = new Map();
  const perAxis = new Map();
  for (let i = 0; i < RUNS; i++) {
    const r = gen('', 'spread');
    seen.set(sig(r), (seen.get(sig(r)) || 0) + 1);
    r.fingerprint.forEach((f) => {
      if (!perAxis.has(f.axis)) perAxis.set(f.axis, new Set());
      perAxis.get(f.axis).add(f.id);
    });
  }
  const top = [...seen.values()].sort((a, b) => b - a)[0];
  console.log(`     ${seen.size} distinct fingerprints in ${RUNS} runs; most repeated ${top}x`);
  is(seen.size > RUNS * 0.9, 'nearly every run is a distinct arrangement', `${seen.size}/${RUNS}`);
  for (const [axis, ids] of perAxis) {
    is(ids.size >= 2, `${axis}: more than one option is actually used`, [...ids].join(','));
  }
}

console.log('\n4  choices stay compatible with the direction');
{
  let bad = [];
  for (let i = 0; i < RUNS * 2; i++) {
    const r = gen('', 'compat');
    const dir = P.DESIGN_DIRECTIONS.find((d) => d.key === r.direction);
    if (!dir) continue;
    for (const f of r.fingerprint) {
      const axis = P.FINGERPRINT_AXES.find((a) => a.axis === f.axis);
      const allowed = P.fingerprintOptions(axis, dir.key, dir.density).map((o) => o.id);
      if (!allowed.includes(f.id)) bad.push(`${dir.key}/${f.axis}/${f.id}`);
    }
  }
  is(bad.length === 0, 'every option drawn was legal for its direction and density',
     bad.slice(0, 3).join(' ') || 'clean');

  /* Spot checks on the two constraints most likely to produce nonsense. */
  const darkPalettes = new Set(), restrainedShapes = new Set();
  for (let i = 0; i < RUNS * 3; i++) {
    const r = gen('', 'spot');
    if (r.direction === 'dark-luxe') r.fingerprint.forEach((f) => {
      if (f.axis === 'Palette family') darkPalettes.add(f.id);
    });
    const d = P.DESIGN_DIRECTIONS.find((x) => x.key === r.direction);
    if (d && d.density === 'restrained') r.fingerprint.forEach((f) => {
      if (f.axis === 'Shape language') restrainedShapes.add(f.id);
    });
  }
  is(!darkPalettes.has('paper-light') && !darkPalettes.has('multi-bright'),
     'dark luxe never draws a paper-light or multi-bright palette', [...darkPalettes].join(','));
  is(!restrainedShapes.has('pattern') && !restrainedShapes.has('colour-block'),
     'restrained directions never draw a pattern field or colour-blocking',
     [...restrainedShapes].join(','));
}

console.log('\n5  an explicitly chosen style is honoured, and still varies');
{
  const a = gen('Japanese Minimalism', 'chip');
  const b = gen('Japanese Minimalism', 'chip');
  is(a.text.startsWith('Japanese Minimalism'), 'the chosen style still leads the direction');
  is(b.text.startsWith('Japanese Minimalism'), 'and is not re-rolled away on regenerate');
  is(sig(a) !== sig(b), 'but the fingerprint is fresh', sig(b).slice(0, 60));
}

console.log('\n6  stamps are untouched');
{
  const st = P.chooseCreativeDirection('', '', 'Self-Inking Stamp', 'balanced', 'stamp', false);
  is(!/DESIGN FINGERPRINT/.test(st.text), 'no fingerprint on a stamp');
  is(/monochromatic black ink on white ONLY/.test(st.text), 'stamp rules intact');
}

console.log('\n7  no asset library involvement');
{
  const r = gen('', 'assets');
  is(!/asset library|assetLibrary|clipart|stock (photo|image)/i.test(r.text),
     'the fingerprint asks for no assets — it is composition, type, colour and space only');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
