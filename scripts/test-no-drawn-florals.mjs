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
  + ' PRODUCT_VISUAL_POLICY, gatedFamilyAllowed, loadAssetLibrary, pickAssets,'
  + ' REFERENCE_RECREATE_PROMPT, pickReferenceBotanicals, referenceBotanicalBlock };');
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

console.log('7  a recreated reference with plant artwork gets the closest library files, never a drawing');
is(/BOTANICAL MOTIFS\n\[Every flower, leaf, sprig/.test(P.REFERENCE_RECREATE_PROMPT),
   'the reference analysis reports plant artwork in its own section');
is(/PLANT ARTWORK IS THE ONE EXCEPTION/.test(ENGINE_SRC)
   && /EXCEPT the HARD RULE on botanical artwork, which nothing overrides/.test(ENGINE_SRC),
   'the recreate note no longer claims to override the hard rule');
const analysis = (motifs) => 'COLORS\n[#f6e4e1 background; #4a4a4a text]\n\nBOTANICAL MOTIFS\n' + motifs
  + '\n\nDISTINCTIVE FEATURES\n[script name]\n';
const pick = (m) => P.pickReferenceBotanicals(analysis(m));
/* the reported Olivia Wilson card: thin charcoal leaf sprigs in two corners */
const olivia = pick('thin leafy sprig, line art, #4a4a4a, top-left corner, ~18% width, pointing down-right\n'
  + 'thin leafy sprig, line art, #4a4a4a, bottom-right corner, ~18% width, mirrored');
is(olivia && olivia.assets.length === 1 && olivia.assets[0].filename === '02_Soft_Green_Foliage_Spray.png',
   'line-art leaf sprigs match the foliage spray', olivia && olivia.assets.map((a) => a.filename).join(','));
is(olivia && olivia.monochrome === true, 'and are recognised as a one-colour motif to recolour');
const block = P.referenceBotanicalBlock(olivia);
is(/assets\/design-library\/02_Soft_Green_Foliage_Spray\.png/.test(block) && /-webkit-mask:url\(\[src\]\)/.test(block)
   && /scaleX\(-1\)/.test(block) && /Never write SVG paths/.test(block),
   'the block hands over the file, the mask recolour, mirroring, and the ban on drawing');
is(pick('peony cluster, watercolour, pink, top-right')?.assets[0].filename === '01_Pink_Peony_Floral_Cluster.png',
   'a pink peony cluster matches the peony file');
is(pick('blue hydrangea bloom, watercolour, left edge')?.assets[0].filename === '11_Blue_Hydrangea_Cluster.png',
   'a blue hydrangea matches the hydrangea file');
is(pick('dried pampas grass, cream, right side')?.assets[0].filename === '12_Neutral_Pampas_Grass_Spray.png',
   'pampas grass matches the pampas file');
const both = pick('rose bouquet with eucalyptus leaves, watercolour, bottom-left');
is(both && both.assets.length === 2 && new Set(both.assets.map((a) => a.family)).size === 2,
   'flowers AND foliage may take one of each family', both && both.assets.map((a) => a.filename).join(','));
is(pick('none') === null, 'a reference with no plant artwork gets nothing');
is(P.pickReferenceBotanicals('COLORS\n[#000]\n\nBOTANICAL MOTIFS\n[none]\n\nDISTINCTIVE FEATURES\n[a bold rule]') === null,
   'including the bracketed "none" form');
is(P.referenceBotanicalBlock(null) === '', 'and no block is added then');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
