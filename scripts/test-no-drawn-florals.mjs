/* HARD RULE: the Generator must never ask the AI to hand-draw floral/foliage
 * artwork. One global rule in SYSTEM_DESIGNER — the system prompt of BOTH
 * generation passes in every mode, reference recreation included. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
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
const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { SYSTEM_DESIGNER, HTML_PROMPT, SPEC_PROMPT, DIRECTION_BY_KEY, DEFAULT_DIRECTION_POOL,'
  + ' PRODUCT_VISUAL_POLICY, gatedFamilyAllowed, loadAssetLibrary, pickAssets };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
eval(src);
const P = globalThis.__p;
await P.loadAssetLibrary();

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const SD = P.SYSTEM_DESIGNER;

console.log('1  the hard rule is global — one block in the shared system prompt');
is(/HARD RULE — NEVER HAND-DRAW FLOWERS OR FOLIAGE/.test(SD), 'the rule block exists in SYSTEM_DESIGNER');
is((ENGINE_SRC.match(/system: SYSTEM_DESIGNER/g) || []).length === 2
   && !/system:\s*(?!SYSTEM_DESIGNER)[A-Z_]+,/.test(ENGINE_SRC),
   'SYSTEM_DESIGNER is the system prompt of BOTH generation passes (spec + html) — every mode inherits it');
is((SD.match(/HARD RULE — NEVER HAND-DRAW/g) || []).length === 1
   && (ENGINE_SRC.match(/NEVER HAND-DRAW FLOWERS/g) || []).length === 1,
   'stated once, not scattered');
for (const term of ['flowers', 'petals', 'foliage', 'vines', 'wreaths', 'botanical line art',
    'decorative plant silhouettes']) {
  is(SD.toLowerCase().includes(term), `forbidden subject named: ${term}`);
}
for (const tech of ['SVG paths', 'CSS shapes', 'clip-path', 'pseudo-elements', 'icon-like geometry']) {
  is(SD.includes(tech), `forbidden technique named: ${tech}`);
}
is(/HARD FAILS[\s\S]*floral or foliage/.test(SD), 'and it is listed under HARD FAILS');

console.log('2  reference recreation cannot override it');
is(/Reference recreation is NOT an exception/.test(SD), 'the rule says recreation is not an exception');
is(/fill that floral role with a supplied design-asset file — or simplify\/omit/.test(SD),
   'a botanical reference is told: supplied asset in that role, or simplify/omit');

console.log('3  customer-supplied floral artwork stays allowed');
is(/CUSTOMER-SUPPLIED artwork is exempt/.test(SD), 'the exemption is explicit');
is(P.HTML_PROMPT.includes('{{SVG_CONTENT}}'), 'the customer SVG (floral or not) still reaches the prompt');

console.log('4  existing floral library content stays allowed');
is(P.gatedFamilyAllowed('floral-cluster', 'florist wedding bouquets'),
   'the floral-cluster asset family still unlocks for floral briefs');
is((ASSETS.assets || []).some((a) => /floral|botanical/i.test(a.family + ' ' + (a.file || a.filename || ''))),
   'the design-asset library still carries botanical/floral files');
is(/use a floral\/botanical file from the SUPPLIED DESIGN ASSETS/.test(SD),
   'the rule points the model at the supplied assets first');

console.log('5  no active direction brief asks the model to draw plants');
const pool = P.DEFAULT_DIRECTION_POOL || [];
const briefs = Object.entries(P.DIRECTION_BY_KEY || {});
let offenders = [];
for (const [key, d] of briefs) {
  const b = (d && d.brief) || '';
  if (/(draw|illustrat\w*|line art)[^;]*\b(leaf|leaves|stem|flower|botanic|petal|vine)/i.test(b)
      || /\b(botanical|floral)\s+(vector\s+)?(illustration|line art)/i.test(b)) offenders.push(key);
}
is(offenders.length === 0, 'no direction brief instructs hand-drawn botanicals', offenders.join(', ') || 'none');
is(/never hand-drawn plant artwork/.test((P.DIRECTION_BY_KEY['organic-botanical'] || {}).brief || ''),
   'organic-botanical now leans on the supplied asset / biomorphic shape');

console.log('6  PRODUCT_VISUAL_POLICY unchanged');
const V = P.PRODUCT_VISUAL_POLICY;
is(V.stamp.stock === 0 && V.stamp.assetsForbidden === true
   && V.nameplate.stock === 0.20 && V.nameplate.logo === 0.60 && V.nameplate.assetCap === 0.85
   && V.card.stock === 0.14 && V.brochure.stock === 1.0 && V.promo.stock === 0.80,
   'every family probability is exactly as before');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
