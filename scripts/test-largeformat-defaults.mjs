/* Large-format DEFAULT behaviour: bolder colour and more visible variety when
   the user chose no style and no colours — with business cards, explicit
   styles and user palettes untouched. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
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
  'globalThis.__p = { chooseCreativeDirection, rotateColorStance, intentKeysFor,'
  + ' LARGE_FORMAT_COLOR_STANCES, LARGE_FORMAT_EXTRA_DIRECTIONS, DESIGN_DIRECTIONS,'
  + ' DEFAULT_DIRECTION_POOL, DIRECTION_ASSET_FAMILIES,'
  + ' recentDirections, recentColorStances };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

console.log('\n1  colour stances exist, commit, and stay professional');
is(P.LARGE_FORMAT_COLOR_STANCES.length >= 5, 'a real pool of stances',
   P.LARGE_FORMAT_COLOR_STANCES.length);
is(P.LARGE_FORMAT_COLOR_STANCES.every((t) => /COLOUR STANCE/.test(t)),
   'each is an explicit stance directive');
is(P.LARGE_FORMAT_COLOR_STANCES.every((t) => !/neon everything|rainbow/i.test(t))
   && P.LARGE_FORMAT_COLOR_STANCES.some((t) => /Refined/i.test(t)),
   'none demands neon/rainbow, and a refined register is one of the moves');

console.log('\n2  stances rotate — consecutive defaults differ');
const seen = new Set();
let backToBack = 0, prev = null;
for (let i = 0; i < 60; i++) {
  const st = P.rotateColorStance('brief-A');
  seen.add(st);
  if (prev === st) backToBack++;
  prev = st;
}
is(seen.size === P.LARGE_FORMAT_COLOR_STANCES.length, 'every stance is reachable',
   seen.size + ' of ' + P.LARGE_FORMAT_COLOR_STANCES.length);
is(backToBack === 0, 'the same stance never lands twice in a row for one brief');

console.log('\n3  the stance is wired into the DEFAULT large-format path only');
is(/if \(!userSetColors && !hasChosenStyle && !willRecreate\s*&& isLargeFormatForAssets\(templateType, lfTrimWin, lfTrimHin\)\s*&& !\/stamp\/i\.test\(templateType \|\| ''\)\) \{/.test(ENGINE_SRC),
   'guarded on: no user colours, no chosen style, no reference recreation, large format, not a stamp');
is(/let effectiveColorScheme = colorSchemeFinal;/.test(ENGINE_SRC),
   'and the guarded value is what the prompts consume');
is(/effectiveColorScheme = 'STAMP MONOCHROMATIC/.test(ENGINE_SRC),
   'stamps still override to monochrome after it');

console.log('\n4  an industry-narrowed direction pool widens on large format');
const intentKeys = P.intentKeysFor('legal services');
is(intentKeys && intentKeys.length === 4, '"legal" narrows to four quiet directions', intentKeys.join(', '));
const collect = (w, h, n = 300) => {
  P.recentDirections.clear();
  const out = new Set();
  for (let i = 0; i < n; i++) {
    const c = P.chooseCreativeDirection('', 'legal services', 'Sign', 'balanced',
      'lf-' + (i % 25), false, w, h, null);
    if (c.direction) out.add(c.direction);
  }
  return out;
};
const onSign = collect(36, 24);
const onCard = (() => {
  P.recentDirections.clear();
  const out = new Set();
  for (let i = 0; i < 300; i++) {
    const c = P.chooseCreativeDirection('', 'legal services', 'Business Card', 'balanced',
      'sm-' + (i % 25), false, 3.5, 2, null);
    if (c.direction) out.add(c.direction);
  }
  return out;
})();
is(P.LARGE_FORMAT_EXTRA_DIRECTIONS.every((k) => onSign.has(k)),
   'a legal SIGN can now land on the bold complement too', [...onSign].join(', '));
is(intentKeys.every((k) => onSign.has(k)),
   'while the quiet intent directions remain in the pool — nothing is forced loud');
is([...onCard].every((k) => intentKeys.indexOf(k) !== -1),
   'a legal BUSINESS CARD still draws only from the quiet intent pool',
   [...onCard].join(', '));
is(onSign.size > onCard.size, 'so large format is measurably more varied than small',
   onSign.size + ' vs ' + onCard.size + ' distinct directions');

console.log('\n5  explicit choices stay untouched');
const chosen = P.chooseCreativeDirection('Japanese Minimalism', 'legal services', 'Sign',
  'balanced', 'x1', false, 36, 24, null);
is(chosen.direction === null && /[Jj]apanese/.test(chosen.text),
   'an explicitly chosen style is used as chosen, no rotation, no stance in the direction');
is(!/COLOUR STANCE/.test(chosen.text), 'and no stance text leaks into the style direction');
const stamp = P.chooseCreativeDirection('', 'legal services', 'Stamp', 'balanced', 'x2', false, 2, 1, null);
is(/monochromatic black ink/.test(stamp.text), 'stamp rules intact');

console.log('\n6  the distance-impact brief is still in force for large format');
const big = P.chooseCreativeDirection('', 'dentist', 'Sign', 'balanced', 'x3', false, 36, 24, null);
is(/DISTANCE IMPACT/.test(big.text) && /LARGER colour fields/.test(big.text),
   'large format carries the distance-impact directive');
const small = P.chooseCreativeDirection('', 'dentist', 'Business Card', 'balanced', 'x4', false, 3.5, 2, null);
is(!/DISTANCE IMPACT/.test(small.text), 'business cards do not');

console.log('\n7  the playful/cartoon language never appears unasked');
is(P.DEFAULT_DIRECTION_POOL.indexOf('playful-contemporary') === -1
   && P.DESIGN_DIRECTIONS.some((d) => d.key === 'playful-contemporary'),
   'playful-contemporary exists but is OUT of the Auto/default pool');
P.recentDirections.clear();
const drawn = new Set();
const BRIEFS = [['', ''], ['', 'dentist'], ['', 'daycare'], ['', 'florist'], ['', 'auto repair']];
for (const [style, ind] of BRIEFS) {
  for (const [type, w, h] of [['Sign', 36, 24], ['Poster', 24, 18], ['Business Card', 3.5, 2]]) {
    for (let i = 0; i < 120; i++) {
      const c = P.chooseCreativeDirection(style, ind, type, 'balanced',
        'np-' + ind + type + (i % 15), false, w, h, null);
      if (c.direction) drawn.add(c.direction);
    }
  }
}
is(!drawn.has('playful-contemporary'),
   'thousands of default draws across products and industries never land on it',
   drawn.size + ' distinct directions drawn');
is(drawn.size >= 10, 'while the default pool stays broad and varied', [...drawn].join(', '));
const explicit = P.chooseCreativeDirection('Playful', 'daycare', 'Sign', 'balanced', 'ex1', false, 36, 24, null);
is(/chunky rounded sans \(Fredoka/.test(explicit.text),
   'the explicit "Playful" style chip still gets the full playful language');
const typed = P.chooseCreativeDirection('fun and playful for kids', 'daycare', 'Sign', 'balanced', 'ex2', false, 36, 24, null);
is(/Fredoka|confetti|sticker|playful/i.test(typed.text),
   'and a typed playful/fun style still routes to it');
is(JSON.stringify(P.DIRECTION_ASSET_FAMILIES['colourful-expressive'])
     === JSON.stringify(['geometric-solid', 'brushstroke']),
   'default colour draws no blob or doodle assets',
   P.DIRECTION_ASSET_FAMILIES['colourful-expressive'].join(', '));
const ce = P.DESIGN_DIRECTIONS.find((d) => d.key === 'colourful-expressive').brief;
is(/no rounded cartoon type, no dots, squiggles, stars or blob shapes/.test(ce)
   && !/characterful display face/.test(ce),
   'and its brief forbids the cartoon ingredients outright');
is(P.DESIGN_DIRECTIONS.filter((d) => /confetti|sticker/i.test(d.brief)).length === 1
   && P.DESIGN_DIRECTIONS.filter((d) => /squiggles/i.test(d.brief) && !/no dots, squiggles/.test(d.brief)).length === 1,
   'playful-contemporary is the only direction that PRESCRIBES that vocabulary');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
