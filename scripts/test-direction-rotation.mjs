/* Direction rotation on the DEFAULT path.
   A direction is a whole coherent concept; rotation happens at that level and
   nowhere else. This checks the rotation, and checks that an explicitly chosen
   style is never rotated away from. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const RUNS = Number(process.argv[3] || 400);

let src = readFileSync(REPO + '/generator/engine.js', 'utf8');
src = src.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { resolveCreativeDirection, DESIGN_DIRECTIONS, RECENT_LIMIT, GENERIC_INTENT };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
globalThis.window = {};
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const gen = (style, key) => P.resolveCreativeDirection(style, 'Consulting', 'Business Card', 'balanced', key);
const dirOf = (text) => {
  const hit = P.DESIGN_DIRECTIONS.find((d) => text.startsWith(d.brief.slice(0, 40)));
  return hit ? hit.key : null;
};

console.log('\n1  consecutive default generations rotate concepts');
{
  const seq = [];
  for (let i = 0; i < RUNS; i++) seq.push(dirOf(gen('', 'repeat')));
  is(seq.every(Boolean), 'every run resolved to a known direction');
  let backToBack = 0, within2 = 0, within3 = 0;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) backToBack++;
    if (i >= 2 && seq.slice(i - 2, i).includes(seq[i])) within2++;
    if (i >= 3 && seq.slice(i - 3, i).includes(seq[i])) within3++;
  }
  console.log(`     ${RUNS} clicks: repeats back-to-back ${backToBack}, within last 2 ${within2}, within last 3 ${within3}`);
  is(backToBack === 0, 'never the same direction twice in a row');
  is(within2 === 0, 'never one of the last 2 directions');
  is(within3 === 0, 'never one of the last 3 directions (12 options available)');
  is(new Set(seq).size === P.DESIGN_DIRECTIONS.length,
     'all 12 concepts are reached', `${new Set(seq).size}/${P.DESIGN_DIRECTIONS.length}`);
  const counts = [...new Set(seq)].map((k) => seq.filter((x) => x === k).length);
  const spread = Math.max(...counts) / Math.min(...counts);
  is(spread < 1.6, 'and they are reached at roughly even rates', 'max/min ' + spread.toFixed(2));
}

console.log('\n2  each concept stays whole — nothing inside it is randomised');
{
  const byKey = new Map();
  for (let i = 0; i < RUNS; i++) {
    const t = gen('', 'coherent');
    const k = dirOf(t);
    const brief = t.split('\n\n')[0];
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k).add(brief);
  }
  const varied = [...byKey.entries()].filter(([, briefs]) => briefs.size !== 1).map(([k]) => k);
  is(varied.length === 0, 'a given direction always arrives with its own single brief',
     varied.join(',') || 'all 12 stable');
  is(!/FINGERPRINT/i.test(gen('', 'nofp')), 'no per-axis fingerprint block is generated');
}

console.log('\n3  a narrow intent set still rotates');
{
  for (const word of ['elegant', 'corporate', 'minimal']) {
    const seq = [];
    for (let i = 0; i < 60; i++) seq.push(dirOf(gen(word, 'intent-' + word)));
    let bb = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) bb++;
    is(bb === 0 && new Set(seq).size >= 3,
       `"${word}" rotates inside its own intent group`,
       [...new Set(seq)].join(', '));
  }
}

console.log('\n4  an explicit style is respected, never rotated');
{
  for (const chip of ['Japanese Minimalism', 'Dark Tech', 'Playful', 'Gilded Emerald']) {
    const outs = [];
    for (let i = 0; i < 40; i++) outs.push(gen(chip, 'chip-' + chip).split('\n\n')[0]);
    const distinct = new Set(outs);
    is(distinct.size === 1, `"${chip}" always produces its own style, every time`,
       [...distinct][0].slice(0, 48) + '…');
    is(!P.DESIGN_DIRECTIONS.some((d) => [...distinct][0].startsWith(d.brief.slice(0, 40))),
       `"${chip}" is never replaced by a default-pool direction`);
  }
}

console.log('\n5  different briefs keep their own rotation');
{
  const a = [], b = [];
  for (let i = 0; i < 40; i++) { a.push(dirOf(gen('', 'briefA'))); b.push(dirOf(gen('', 'briefB'))); }
  let bbA = 0, bbB = 0;
  for (let i = 1; i < a.length; i++) { if (a[i] === a[i - 1]) bbA++; if (b[i] === b[i - 1]) bbB++; }
  is(bbA === 0 && bbB === 0, 'two different briefs each rotate independently');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
