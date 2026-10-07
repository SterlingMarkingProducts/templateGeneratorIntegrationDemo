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
  + ' REFERENCE_RECREATE_PROMPT, pickReferenceBotanicals, referenceBotanicalBlock,'
  + ' pickReferenceLibraryMatches, referenceLibraryBlock, pickReferenceLogo, pickReferencePhoto,'
  + ' pickReferenceDesignAssets, loadStockPhotoLibrary, loadLogoLibrary };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
eval(src);
const P = globalThis.__p;
await P.loadAssetLibrary();
await P.loadStockPhotoLibrary();
await P.loadLogoLibrary();

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
is(/HARD FAILS[\s\S]*a flower or a leaf/.test(SD), 'and it is listed under HARD FAILS');

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

console.log('8  no PICTURE of anything is ever drawn — the rule, and what recreation supplies instead');
is(/HARD RULE — NEVER DRAW A PICTURE OF ANYTHING/.test(SD) && /spines, vertebrae/.test(SD) && /ABSTRACT GEOMETRY ONLY/.test(SD),
   'the system prompt forbids drawing people, anatomy, objects and icons, allowing abstract geometry only');
is(/never draw an icon, a figure or a pictorial mark yourself/.test(P.HTML_PROMPT), 'the icon-bank rule no longer invites hand-drawn marks');
const RP = P.REFERENCE_RECREATE_PROMPT;
is(/what the mark DEPICTS/.test(RP) && /Do NOT describe how to redraw it/.test(RP), 'the analysis describes the logo by subject, not as drawing instructions');
is(/PICTORIAL ELEMENTS\n/.test(RP) && /These are never redrawn/.test(RP), 'and lists every illustration/figure as a pictorial element to match');
const AN = (logo, photo, pict, tex) => 'COLORS\n[#1f3d33 ground]\n\nLOGO / ICONS\n[LOGO: ' + logo + '\nICONS: phone, mail, pin beside the contact lines]\n\nTEXTURE / EFFECTS\n[' + (tex || 'none') + ']\n\nPHOTO REGIONS\n[' + (photo || 'none') + ']\n\nPICTORIAL ELEMENTS\n[' + (pict || 'none') + ']\n\nDISTINCTIVE FEATURES\n[a bold rule]\n';
const G = { templateType: 'Brochure', widthIn: 11, heightIn: 8.5 };
const m1 = P.pickReferenceLibraryMatches(AN('a stylised spine in a circle, solid silhouette, #e8620c, top-left ~12% width', 'right panel, full height: a chiropractor adjusting a patient\'s back in a bright clinic', 'none'), 'chiropractic clinic', G);
is(m1 && m1.logo && m1.logo.logo.filename === '21_chiropractic_spine.png', 'a reference logo that depicts a spine gets the library spine mark', m1 && m1.logo && m1.logo.logo.filename);
is(m1 && m1.photo && (m1.photo.photo.depicts || []).includes('chiropractic'), 'a reference photo of a chiropractor gets a chiropractic library photograph', m1 && m1.photo && m1.photo.photo.file);
is(m1 && !m1.design, 'and no decoration file when the reference has no decoration');
const blk = P.referenceLibraryBlock(m1, false);
is(/THE REFERENCE'S LOGO MARK is described above/.test(blk) && /assets\/logo-library\/21_chiropractic_spine\.png/.test(blk) && /Never draw the reference's own mark/.test(blk),
   'the block supplies the mark and forbids drawing it');
is(/THE REFERENCE'S PHOTOGRAPH shows/.test(blk) && /assets\/stock-photo-library\//.test(blk), 'and the photograph with its file path');
is(/LEFT OUT of the recreation/.test(blk), 'and says unmatched pictorial elements are left out, never drawn');
const m2 = P.pickReferenceLibraryMatches(AN('letters only: an SB monogram in a serif', 'none', 'a loose watercolour wash behind the headline, blush pink; a torn kraft paper strip along the bottom edge', 'none'), 'florist', G);
is(m2 && !m2.logo, 'a letters-only mark gets no library mark (the model sets the type)', m2 && m2.logo && m2.logo.logo.filename);
is(m2 && m2.design && m2.design.assets.some((a) => a.family === 'watercolour-wash') && m2.design.assets.some((a) => a.family === 'torn-paper'),
   'a watercolour wash and a torn paper strip get files from those families', m2 && m2.design && m2.design.assets.map((a) => a.filename).join(', '));
is(m2 && m2.design.assets.find((a) => a.family === 'watercolour-wash').filename === '15_Blush_Pink_Watercolor_Wash.png', 'the blush pink wash, by colour', m2 && m2.design.assets[0].filename);
const m3 = P.pickReferenceLibraryMatches(AN('a tooth with a sparkle, line art', 'none', 'a cartoon mascot of a smiling tooth holding a toothbrush, flat illustration, bottom right ~25%', 'none'), 'dentist', G);
is(m3 && m3.logo && m3.logo.logo.filename === '22_dental_tooth.png', 'a tooth mark gets the dental library mark');
is(m3 && !m3.design, 'a cartoon mascot matches no library family — it is left out, not drawn');
is(P.pickReferenceLibraryMatches(AN('letters only: a wordmark', 'none', 'none', 'none'), 'law firm', G) === null, 'a purely typographic reference with no photo or artwork supplies nothing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
