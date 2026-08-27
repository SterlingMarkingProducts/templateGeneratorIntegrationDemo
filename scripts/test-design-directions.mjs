/* Creative-direction harness. Loads generator/engine.js in Node with a window
   shim, samples resolveCreativeDirection() and classifies what comes out.

   It measures the DIRECTIVE the model is actually given — not the code that
   builds it — so a change is proved by the distribution, not asserted.

   node direction-harness.mjs [path-to-repo] [runs] */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const RUNS = Number(process.argv[3] || 600);

let src = readFileSync(join(REPO, 'generator/engine.js'), 'utf8');
src = src.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__probe = { resolveCreativeDirection, GENERIC_STYLE,'
  + ' DIRECTIONS: (typeof DESIGN_DIRECTIONS !== "undefined" ? DESIGN_DIRECTIONS : null),'
  + ' DIVERSE: (typeof DIVERSE_STYLES !== "undefined" ? DIVERSE_STYLES : null),'
  + ' BOLD: (typeof BOLD_ARCHETYPES !== "undefined" ? BOLD_ARCHETYPES : null) };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
globalThis.window = {};
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__probe;

/* The signature the audit measured: dark grounds, technical/condensed type,
   glow/chrome, schematic motifs, amber/gold metallics. Deliberately unchanged
   between the before and after run so the two numbers are comparable. */
const DARK_TECHNICAL = new RegExp('\\b(' + [
  'near-black', 'deep black', 'dark grey', 'charcoal', 'oxblood',
  'midnight', 'navy', 'neon', 'glow', 'chrome', 'orbitron', 'rajdhani', 'exo 2',
  'space mono', 'bebas', 'condensed', 'stencil', 'circuit', 'grid', 'amber',
  'gold', 'brass', 'metallic', 'dashboard', 'sparkline', 'metric', 'halftone',
  'brutal',
].join('|') + ')\\b', 'i');
/* WORD BOUNDARIES MATTER. The audit's first pass ran these as bare substrings,
   so "metric" matched inside "geometric" and "asymmetric" — every direction
   that mentioned geometry counted as dark/technical. Both the before and the
   after figure below are measured with this corrected classifier. */

/* The direction a run actually landed on, when the pool exposes keys. This is
   the exact answer to "is one family dominating" — the vocabulary regex above
   is only a proxy and flags legitimate words like "grid" or "metallic". */
function keyOf(d) {
  if (!P.DIRECTIONS) return null;
  const hit = P.DIRECTIONS.find((x) => d.startsWith(x.brief.slice(0, 40)));
  return hit ? hit.key : null;
}
const DARK_KEYS = ['dark-luxe', 'retro-futurist'];

function sample(style, n) {
  let hits = 0, darkDir = 0, keyed = 0;
  const names = new Map();
  for (let i = 0; i < n; i++) {
    const d = P.resolveCreativeDirection(style, '', 'Business Card', 'balanced');
    if (DARK_TECHNICAL.test(d)) hits++;
    const k = keyOf(d);
    if (k) { keyed++; if (DARK_KEYS.includes(k)) darkDir++; }
    const first = d.split('\n')[0].split('—')[0].trim().slice(0, 46);
    names.set(first, (names.get(first) || 0) + 1);
  }
  return { hits, pct: Math.round((hits / n) * 100), names,
           darkDirPct: keyed ? Math.round((darkDir / n) * 100) : null };
}

console.log(`repo: ${REPO}`);
console.log(`pool: ${P.DIRECTIONS ? P.DIRECTIONS.length + ' DESIGN_DIRECTIONS'
  : (P.DIVERSE ? P.DIVERSE.length + ' DIVERSE_STYLES x ' + P.BOLD.length + ' BOLD_ARCHETYPES' : 'unknown')}`);

const empty = sample('', RUNS);
console.log(`\nNO STYLE DIRECTION (${RUNS} runs)`);
console.log(`  dark/technical vocabulary: ${empty.hits}/${RUNS}  (${empty.pct}%)`);
const top = [...empty.names.entries()].sort((a, b) => b[1] - a[1]);
console.log(`  distinct directions drawn: ${top.length}`);
console.log(`  most frequent: ${top.slice(0, 5).map(([k, v]) => `${k} ${Math.round(v / RUNS * 100)}%`).join(' | ')}`);
console.log(`  max share of any one direction: ${Math.round(top[0][1] / RUNS * 100)}%`);

/* The audit regex is broad on purpose (it flags "grid", "navy", "gold"), which
   keeps the before/after numbers comparable but overstates a legitimately dark
   or geometric direction. The direction key is the exact answer to "is one
   family dominating", so report both. */
if (P.DIRECTIONS) {
  const byKey = new Map();
  const density = new Map();
  for (let i = 0; i < RUNS; i++) {
    const d = P.resolveCreativeDirection('', '', 'Business Card', 'balanced');
    const hit = P.DIRECTIONS.find((x) => d.startsWith(x.brief.slice(0, 40)));
    byKey.set(hit ? hit.key : '?', (byKey.get(hit ? hit.key : '?') || 0) + 1);
    if (hit) density.set(hit.density, (density.get(hit.density) || 0) + 1);
  }
  const rows = [...byKey.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\n  by direction (share of runs):');
  rows.forEach(([k, v]) => console.log(`    ${k.padEnd(22)} ${String(Math.round(v / RUNS * 100)).padStart(3)}%`));
  const loud = ['retro-futurist', 'dark-luxe'].reduce((s2, k) => s2 + (byKey.get(k) || 0), 0);
  console.log(`  dark-luxe + retro-futurist combined: ${Math.round(loud / RUNS * 100)}%`);
  console.log('  by density: ' + [...density.entries()]
    .map(([k, v]) => `${k} ${Math.round(v / RUNS * 100)}%`).join(', '));
}

console.log('\nGENERIC STYLE WORDS (200 runs each) — what the user typed vs what is produced');
for (const word of ['professional', 'clean', 'modern', 'minimal', 'elegant', 'classic', 'corporate']) {
  const r = sample(word, 200);
  const t = [...r.names.entries()].sort((a, b) => b[1] - a[1]);
  const dd = r.darkDirPct === null ? '' : `  dark/technical DIRECTION ${String(r.darkDirPct).padStart(3)}%`;
  console.log(`  ${word.padEnd(13)} vocab ${String(r.pct).padStart(3)}%${dd}  ->  ${t.slice(0, 3).map(([k]) => k).join(' / ')}`);
}
