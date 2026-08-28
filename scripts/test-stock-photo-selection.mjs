/* Stock photo library selection (Phase 2C).
   Loads engine.js in Node with both manifests served from disk, then asks the
   real selector for thousands of decisions and checks the contract:
   customer photo wins, industry match is a hard gate, one photo maximum,
   orientation and text-safety gating, Force, variety, and asset suppression. */
import { readFileSync, existsSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
const RUNS = Number(process.argv[3] || 600);

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
  'globalThis.__p = { chooseCreativeDirection, loadAssetLibrary, loadStockPhotoLibrary,'
  + ' pickStockPhoto, pickAssets, matchStockIndustries,'
  + ' stockCompositionOk, renderStockPhotoBlock, recentStockPhotos, stockRolesFor,'
  + ' stockProductClass, STOCK_PRODUCT_POLICY, BROAD_STOCK_SLUGS, stockSlugTier,'
  + ' PHOTO_SAFE_ASSET_FAMILIES,'
  + ' STOCK_INDUSTRY_SYNONYMS, HTML_PROMPT, get lastStockReason() { return lastStockReason; } };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
await P.loadStockPhotoLibrary();
await P.loadAssetLibrary();

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

/* Business card 3.5x2 = small format; a 24x36 sign = large format. */
const CARD = { templateType: 'Business Card', widthIn: 3.5, heightIn: 2 };
const SIGN = { templateType: 'Sign', widthIn: 36, heightIn: 24 };
const BANNER_TALL = { templateType: 'Banner', widthIn: 24, heightIn: 72 };
const POSTER = { templateType: 'Poster', widthIn: 24, heightIn: 18 };
const FLYER  = { templateType: 'Flyer', widthIn: 11, heightIn: 8.5 };
const BROCHURE = { templateType: 'Brochure', widthIn: 11, heightIn: 8.5 };
const NAMEPLATE = { templateType: 'Nameplate', widthIn: 8, heightIn: 2 };
const BADGE = { templateType: 'Name Badge', widthIn: 3, heightIn: 1.5 };
const STAMP = { templateType: 'Stamp', widthIn: 2, heightIn: 1 };

let seq = 0;
/* pick() types the text into the Industry FIELD (explicit). pickBlank() leaves
   the field blank and supplies the text as the rest of the brief — business
   name and special instructions — which is the inference path. */
const pick = (industryText, geom = SIGN, extra = {}) => P.pickStockPhoto(Object.assign({
  industryText, explicitIndustry: industryText, memoryKey: 'k' + (seq++), hasCustomerPhoto: false,
}, geom, extra));
const pickBlank = (briefText, geom = SIGN, extra = {}) => P.pickStockPhoto(Object.assign({
  industryText: briefText, explicitIndustry: '', memoryKey: 'b' + (seq++), hasCustomerPhoto: false,
}, geom, extra));

console.log('\n1  the library is present, complete and served from this clone');
is(STOCK.file_count === 45 && STOCK.photos.length === 45,
   'the manifest describes the 45 v2 photographs');
is(STOCK.version && STOCK.version.indexOf('v2') !== -1, 'and is the v2 library', STOCK.version);
is(!STOCK.photos.some((p) => /^(01-florist-bouquet|35-peaceful-coastal-landscape|04-dentist-with-patient)\.png$/.test(p.file)),
   'no v1 filename survives in the manifest');
is(STOCK.photos.every((p) => Array.isArray(p.suitable_roles) && p.suitable_roles.length),
   'every photo declares its suitable composition roles');
is(STOCK.photos.every((p) => p.url.startsWith('assets/stock-photo-library/')),
   'every photo has a served URL under the clone');
is(STOCK.photos.every((p) => existsSync(REPO + '/generator/' + p.url)),
   'every described file actually exists on disk');
is(!JSON.stringify(STOCK).includes('/tmp/'), 'no /tmp path survived into the committed manifest');
is(Object.keys(STOCK.industry_index).length >= 80, 'an industry index is present',
   Object.keys(STOCK.industry_index).length + ' slugs, all built from depicts[]');
is(Object.entries(STOCK.industry_index).every(([slug, ids]) =>
     ids.every((id) => STOCK.photos.find((p) => p.id === id).depicts.includes(slug))),
   'and the index agrees with depicts[] on every entry');
is(STOCK.photos.every((p) => p.regions && p.overlay_guidance),
   'every photo carries region grades and overlay guidance');
is(STOCK.photos.every((p) => Array.isArray(p.depicts) && p.depicts.length),
   'every photo declares what it DEPICTS');
is(STOCK.photos.every((p) => Array.isArray(p.audit_associations)),
   'and keeps the audit\'s looser associations separately, for provenance');
is(!/\bp\.industries\b|\.industries \|\| \[\]/.test(ENGINE_SRC),
   'the engine never reads the loose associations');

console.log('\n2  the three libraries stay separate');
const stockFiles = new Set(STOCK.photos.map((p) => p.file));
is(ASSETS.assets.every((a) => !stockFiles.has(a.filename)), 'no file appears in both libraries');
is(ASSETS.assets.every((a) => !a.url.includes('stock-photo-library'))
   && STOCK.photos.every((p) => !p.url.includes('design-library')),
   'neither manifest points into the other directory');
is(!ENGINE_SRC.includes('logo-library') && !ENGINE_SRC.includes('logo-manifest'),
   'the engine references no logo library at all');
is(/loadAssetLibrary[\s\S]{0,400}design-asset-manifest\.json/.test(ENGINE_SRC)
   && /loadStockPhotoLibrary[\s\S]{0,400}stock-photo-manifest\.json/.test(ENGINE_SRC),
   'each library has its own loader and its own manifest');

console.log('\n3  the customer\'s own photograph always wins');
let custAuto = 0, custForce = 0;
for (let i = 0; i < 200; i++) {
  if (pick('dentist', SIGN, { hasCustomerPhoto: true })) custAuto++;
  globalThis.window.SMPStockPhotoMode = 'force';
  if (pick('dentist', SIGN, { hasCustomerPhoto: true })) custForce++;
  globalThis.window.SMPStockPhotoMode = 'auto';
}
is(custAuto === 0, 'Auto never selects stock when the customer supplied a photo');
is(custForce === 0, 'Force Photo never selects stock when the customer supplied a photo');
pick('dentist', SIGN, { hasCustomerPhoto: true });
is(P.lastStockReason === 'the customer supplied their own photograph',
   'and it says so', P.lastStockReason);
is(/hasCustomerPhoto\s*=\s*!!\(\(imageUrl \|\| ''\)\.trim\(\)\)/.test(ENGINE_SRC),
   'handleGenerate derives that gate from the brief\'s own Image URL');

console.log('\n4  industry match is a HARD gate');
const NONSENSE = ['Quantum Widget Foundry', 'Zorbtronic Systems', 'Blivet Manufacturing',
  'Cryptocurrency Mining', 'Trucking and Logistics', 'Municipal Fire Service'];
let nonsenseHits = 0;
NONSENSE.forEach((n) => { for (let i = 0; i < 60; i++) if (pick(n)) nonsenseHits++; });
is(nonsenseHits === 0, 'no photo is ever returned for an unmatched industry',
   NONSENSE.length * 60 + ' attempts');
pick('Quantum Widget Foundry');
is(P.lastStockReason === 'no industry match in the stock library', 'and it says why',
   P.lastStockReason);
/* A blank Industry FIELD no longer refuses outright — that is section 13.
   An explicitly TYPED industry that matches nothing still refuses. */
pick('Quantum Widget Foundry');
is(P.lastStockReason === 'no industry match in the stock library',
   'a typed industry that matches nothing still refuses — the user said what the business is',
   P.lastStockReason);

const CASES = [
  ['Dental',                'dental'],
  ['orthodontist',          'orthodontics'],
  ['dentist office',        'dental'],
  ['Plumbing',              'plumbing'],
  ['plumber',               'plumbing'],
  ['Real Estate',           'real-estate'],
  ['realtor',               'real-estate'],
  ['Law Firm',              'legal'],
  ['Veterinary Clinic',     'veterinary'],
  ['Hair Salon',            'hair-salon'],
  ['Bakery',                'bakery'],
  ['bakeries',              'bakery'],
  ['Landscaping',           'landscaping'],
  ['Yoga Studio',           'yoga'],
  ['Auto Repair',           'auto-repair'],
  ['mechanic',              'auto-repair'],
  ['Accounting',            'accounting'],
  ['Daycare',               'daycare'],
  ['Florist',               'florist'],
  ['Coffee Shop',           'cafe'],
  ['Interior Design',       'interior-design'],
];
let matchedAll = true, relevantAll = true;
CASES.forEach(([text, slug]) => {
  const slugs = P.matchStockIndustries(text, { terms: STOCK_TERMS() });
  if (slugs.indexOf(slug) === -1) { matchedAll = false; console.log(`     MISS  "${text}" -> ${slugs.join(',') || 'none'}`); }
  globalThis.window.SMPStockPhotoMode = 'force';
  for (let i = 0; i < 25; i++) {
    const r = pick(text);
    /* A legitimate skip: the industry matched, but no photo of it fits this
       product's shape. That is the rule working, not a miss. */
    if (!r) { if (!/no (landscape|portrait|any) photo|composes safely/.test(P.lastStockReason)) {
        relevantAll = false; console.log(`     NONE  "${text}" -> ${P.lastStockReason}`); } break; }
    if (!r.photo.depicts.some((s) => slugs.indexOf(s) !== -1)) {
      relevantAll = false; console.log(`     BAD   "${text}" -> ${r.photo.file}`);
    }
  }
  globalThis.window.SMPStockPhotoMode = 'auto';
});
function STOCK_TERMS() {
  /* the same term table the engine built, rebuilt here from the manifest */
  const out = [];
  Object.keys(STOCK.industry_index).forEach((slug) => {
    const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const terms = [norm(slug)];
    const ex = P.STOCK_INDUSTRY_SYNONYMS[slug];
    if (ex) ex.split('|').forEach((t) => terms.push(norm(t)));
    terms.filter(Boolean).forEach((t) => out.push([t, slug]));
  });
  out.sort((a, b) => b[0].length - a[0].length);
  return out;
}
is(matchedAll, 'every real-world industry phrase resolves to its slug', CASES.length + ' phrases');
is(relevantAll, 'and every photo returned for it claims a matched slug');

console.log('\n4b  a specific trade never gets a broad or lifestyle photo');
/* The live failure this fixes: "Dentist" returned a photo of two people
   walking in a park, because the audit had tagged that photo "dental". */
const DENTAL_FILES = STOCK.photos.filter((p) => p.depicts.includes('dental')).map((p) => p.file);
is(DENTAL_FILES.length === 1 && DENTAL_FILES[0] === '04-vertical-dentist-with-patient.png',
   'exactly one photograph depicts dentistry', DENTAL_FILES.join(', '));
is(!STOCK.photos.some((p) => /family-outdoors|senior-couple/.test(p.id) && p.depicts.includes('dental')),
   'the family-in-a-park and senior-couple photos still do not claim dentistry');
globalThis.window.SMPStockPhotoMode = 'force';
const DENTAL_BRIEFS = ['Dentist', 'dental clinic', 'dental office', 'family dentistry',
  'orthodontist', 'Dr Chen Dental Care', 'dental hygiene clinic'];
let dentalWrong = 0, dentalRuns = 0;
DENTAL_BRIEFS.forEach((b) => {
  for (let i = 0; i < 50; i++) {
    const r = pick(b, SIGN);
    if (!r) continue;
    dentalRuns++;
    if (r.photo.file !== '04-vertical-dentist-with-patient.png') {
      dentalWrong++;
      if (dentalWrong < 3) console.log(`     BAD   "${b}" -> ${r.photo.file}`);
    }
  }
});
is(dentalRuns > 0 && dentalWrong === 0,
   'every dental brief receives the dental photograph and nothing else',
   dentalRuns + ' selections across ' + DENTAL_BRIEFS.length + ' briefs');
/* Specific beats broad in general, not just for dentistry. */
const TIERED = [
  ['dental clinic',     ['04-vertical-dentist-with-patient.png']],
  ['veterinary clinic', ['23-vertical-veterinarian-with-dog.png']],
  ['yoga wellness studio', ['21-vertical-yoga-wellness.png']],
  ['chiropractor', STOCK.photos.filter((p) => p.depicts.includes('chiropractic')).map((p) => p.file)],
];
let tieredOk = true;
TIERED.forEach(([brief, allowed]) => {
  for (let i = 0; i < 40; i++) {
    const r = pick(brief, SIGN);
    if (r && allowed.indexOf(r.photo.file) === -1) {
      tieredOk = false; console.log(`     BAD   "${brief}" -> ${r.photo.file}`);
    }
  }
});
is(tieredOk, 'a specific trade is never widened to its broad parent category');
/* And the broad category still works when the brief is genuinely broad. */
const broadHits = new Set();
for (let i = 0; i < 200; i++) { const r = pick('medical clinic', SIGN); if (r) broadHits.add(r.photo.file); }
is(broadHits.size > 0 && !broadHits.has('04-vertical-dentist-with-patient.png'),
   'a genuinely broad brief still reaches its own photos', [...broadHits].join(', '));
/* Trades with no depicting photograph get nothing at all. */
const ORPHANS = ['roofing', 'pharmacy', 'massage therapy', 'pet grooming', 'funeral home',
  'hearing clinic', 'mortgage broker', 'HVAC'];
is(STOCK.photos.filter((p) => p.depicts.includes('chiropractic')).length === 10,
   'the new chiropractic series is depicted, ten photographs strong');
let orphanHits = 0;
ORPHANS.forEach((o) => { for (let i = 0; i < 40; i++) if (pick(o, SIGN)) orphanHits++; });
is(orphanHits === 0, 'a trade with no depicting photograph gets none',
   ORPHANS.length * 40 + ' attempts');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n5  stamps and mode gates');
let stampHits = 0;
['auto', 'force'].forEach((m) => {
  globalThis.window.SMPStockPhotoMode = m;
  for (let i = 0; i < 100; i++) if (pick('dentist', STAMP)) stampHits++;
});
globalThis.window.SMPStockPhotoMode = 'auto';
is(stampHits === 0, 'stamps never use stock photography, in any mode');
globalThis.window.SMPStockPhotoMode = 'off';
let offHits = 0;
for (let i = 0; i < 100; i++) if (pick('dentist')) offHits++;
is(offHits === 0, 'No Photo selects nothing');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n6  orientation is a composition instruction, not a gate');
globalThis.window.SMPStockPhotoMode = 'force';
const onLandscape = pick('real estate', SIGN);
is(onLandscape && onLandscape.photo.orientation === 'portrait',
   'a HORIZONTAL sign happily receives a portrait photograph',
   onLandscape && onLandscape.photo.file);
is(onLandscape && onLandscape.roles.indexOf('vertical-side-panel') !== -1,
   'carrying its vertical-panel roles', onLandscape && onLandscape.roles.join(', '));
const onTall = pick('hair salon', BANNER_TALL);
is(onTall && onTall.photo.orientation === 'portrait',
   'a vertical banner receives one too — the file decides the photo area either way');
const blk = P.renderStockPhotoBlock(onLandscape);
is(/PHOTO AREA:/.test(blk) && /VERTICAL photo area/.test(blk),
   'the prompt orders a VERTICAL photo area built for the portrait file');
is(/side panel|tall inset|vertical hero/.test(blk),
   'naming side panel, tall inset and vertical hero');
is(/Do NOT stretch/.test(blk), 'and forbids stretching it to the canvas');
is(/works as: /.test(blk), 'the manifest roles travel into the prompt');
is(P.stockRolesFor({ orientation: 'landscape' }).indexOf('horizontal-band') !== -1,
   'a landscape file would get horizontal-band roles the same way');
is(/a portrait file gets a vertical side panel[\s\S]{0,200}landscape file gets a horizontal band/.test(P.HTML_PROMPT),
   'and the HTML prompt states the build-the-area-around-the-file rule');
const quietest = (p) => Math.min(...['top', 'middle', 'bottom'].map((b) => p.regions[b].busyness));
const CHAOTIC = STOCK.photos.filter((p) => quietest(p) > 0.25);
let cardSafe = true, cardSeen = 0;
['dentist', 'cafe', 'personal trainer', 'veterinary clinic', 'plumbing', 'bakery']
  .forEach((t) => {
    for (let i = 0; i < 200; i++) {
      const r = pick(t, CARD);
      if (!r) continue;
      cardSeen++;
      if (quietest(r.photo) > 0.25) cardSafe = false;
    }
  });
is(cardSafe && cardSeen > 0, 'a small format never receives a visually chaotic photo',
   cardSeen + ' card selections checked');
is(CHAOTIC.length > 0, 'and such photos do exist in the library, so the gate is doing work',
   CHAOTIC.map((p) => p.id).join(', '));
let chaoticOnCard = 0;
CHAOTIC.forEach((p) => {
  const slug = p.depicts[0];
  for (let i = 0; i < 100; i++) {
    const r = pick(slug.replace(/-/g, ' '), CARD);
    if (r && r.photo.file === p.file) chaoticOnCard++;
  }
});
is(chaoticOnCard === 0,
   'a chaotic file is never the one placed on a card — a quieter photo of the same trade is');
let chaoticOnSign = 0;
CHAOTIC.forEach((p) => {
  const slug = p.depicts[0];
  for (let i = 0; i < 100; i++) if (pick(slug.replace(/-/g, ' '), SIGN)) chaoticOnSign++;
});
is(chaoticOnSign > 0, 'while large format, which has room for them, still can');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n7  Force Photo');
let forcedHits = 0;
globalThis.window.SMPStockPhotoMode = 'force';
for (let i = 0; i < 200; i++) if (pick('dentist', CARD)) forcedHits++;
is(forcedHits === 200, 'Force takes a matched photo every time, even on a business card',
   forcedHits + '/200');
const forcedMiss = pick('Trucking and Logistics', SIGN);
is(forcedMiss === null && P.lastStockReason === 'no industry match in the stock library',
   'Force reports no compatible photo rather than reaching for an unrelated one',
   P.lastStockReason);
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n8  the product policy');
is(P.stockProductClass('Stamp', 2, 1) === 'stamp'
   && P.stockProductClass('Self-Inking Stamp', 2, 1) === 'stamp', 'stamps classify as stamps');
is(P.stockProductClass('Nameplate', 8, 2) === 'nameplate'
   && P.stockProductClass('Name Badge', 3, 1.5) === 'nameplate'
   && P.stockProductClass('Name Tag', 3, 1.5) === 'nameplate',
   'name badges, name tags and nameplates classify together');
is(P.stockProductClass('Business Card', 3.5, 2) === 'card', 'a business card is its own class');
is(P.stockProductClass('Business Card', 18, 12) === 'general',
   'but an 18x12 piece still typed "Business Card" is general printed material '
   + '(web03 supplies no productFamily)');
['Sign', 'Poster', 'Banner', 'Flyer', 'Brochure', 'Rack Card'].forEach((t) => {
  is(P.stockProductClass(t, 11, 8.5) === 'general', `${t} is general printed material`);
});
is(P.STOCK_PRODUCT_POLICY.stamp.none === 1 && P.STOCK_PRODUCT_POLICY.nameplate.none === 1,
   'stamps and nameplates are policy zero, not a low probability');

const RATE_RUNS = RUNS * 4;
const rate = (text, geom) => {
  let hit = 0;
  for (let i = 0; i < RATE_RUNS; i++) if (pick(text, geom)) hit++;
  return hit / RATE_RUNS;
};
const cardRate = rate('dentist', CARD);
const generalRates = {
  Sign: rate('dentist', SIGN), Poster: rate('dentist', POSTER),
  Flyer: rate('dentist', FLYER), Brochure: rate('dentist', BROCHURE),
};
console.log(`     business card ${(cardRate * 100).toFixed(1)}%`);
Object.entries(generalRates).forEach(([k, v]) =>
  console.log(`     ${k.padEnd(14)}${(v * 100).toFixed(1)}%`));
is(cardRate > 0.115 && cardRate < 0.165, 'business cards stay at approximately 14%',
   (cardRate * 100).toFixed(1) + '%');
Object.entries(generalRates).forEach(([k, v]) =>
  is(v > 0.76 && v < 0.85, `${k} runs at approximately 80–81%`, (v * 100).toFixed(1) + '%'));
let zeroHits = 0;
for (let i = 0; i < RUNS; i++) {
  if (pick('dentist', NAMEPLATE)) zeroHits++;
  if (pick('dentist', BADGE)) zeroHits++;
  if (pick('dentist', STAMP)) zeroHits++;
}
is(zeroHits === 0, 'stamps, name badges and nameplates take none, ever',
   RUNS * 3 + ' attempts');
pick('dentist', NAMEPLATE);
is(P.lastStockReason === 'name badges and nameplates never use photography',
   'and say so', P.lastStockReason);

console.log('\n8b  design assets under the same policy');
globalThis.window.SMPAssetMode = 'force';
let stampAssets = 0, badgeAssets = 0;
for (let i = 0; i < RUNS; i++) {
  stampAssets += P.chooseCreativeDirection('', 'dentist', 'Stamp', 'balanced', 'sa' + i, false, 2, 1).assets.length;
  badgeAssets += P.chooseCreativeDirection('', 'dentist', 'Nameplate', 'balanced', 'ba' + i, false, 8, 2).assets.length;
}
is(stampAssets === 0, 'stamps use no design assets either', RUNS + ' runs');
is(badgeAssets > 0, 'name badges and nameplates still may', badgeAssets + ' over ' + RUNS + ' runs');
globalThis.window.SMPAssetMode = 'auto';

console.log('\n8c  large-format visual impact');
const bigText = P.chooseCreativeDirection('', 'dentist', 'Sign', 'balanced', 'imp1', false, 36, 24, null).text;
const cardText = P.chooseCreativeDirection('', 'dentist', 'Business Card', 'balanced', 'imp2', false, 3.5, 2, null).text;
is(/DISTANCE IMPACT/.test(bigText), 'signs carry a distance-impact directive');
is(/LARGER colour fields/.test(bigText) && /contrast/.test(bigText),
   'naming larger colour fields and harder contrast');
is(/Do NOT default to neon/.test(bigText) && /rainbow/.test(bigText),
   'while ruling out neon and rainbow palettes');
is(/refined/.test(bigText), 'and leaving refined directions refined');
is(!/DISTANCE IMPACT/.test(cardText), 'business-card styling is untouched');
const bannerText = P.chooseCreativeDirection('', 'dentist', 'Banner', 'balanced', 'imp3', false, 24, 72, null).text;
is(/DISTANCE IMPACT/.test(bannerText), 'banners get it too');

console.log('\n9  one photo per design, and variety without drift');
const one = pick('healthcare', SIGN);
is(one === null || (one.photo && !Array.isArray(one.photo)),
   'a selection is a single photograph, never a list');
globalThis.window.SMPStockPhotoMode = 'force';
P.recentStockPhotos.clear();
let repeats = 0, runsWithChoice = 0;
for (let brief = 0; brief < 40; brief++) {
  const key = 'variety-' + brief;
  let prev = null;
  for (let i = 0; i < 6; i++) {
    const r = P.pickStockPhoto({ industryText: 'healthcare clinic', memoryKey: key,
      hasCustomerPhoto: false, ...SIGN });
    if (!r) continue;
    /* how many valid alternatives existed at all */
    const alts = STOCK.photos.filter((p) =>
      p.depicts.some((s) => r.briefIndustries.indexOf(s) !== -1)).length;
    if (alts > 1) { runsWithChoice++; if (prev && prev === r.photo.id) repeats++; }
    prev = r.photo.id;
  }
}
is(repeats === 0, 'a photo is never repeated back-to-back while another valid match exists',
   runsWithChoice + ' consecutive pairs checked');
const solo = STOCK.photos.filter((p) => p.depicts.includes('dental'));
is(solo.length === 1, 'an industry with exactly one depicting photo exists in the library');
P.recentStockPhotos.clear();
const a1 = P.pickStockPhoto({ industryText: 'dentist', memoryKey: 'solo', hasCustomerPhoto: false, ...SIGN });
const a2 = P.pickStockPhoto({ industryText: 'dentist', memoryKey: 'solo', hasCustomerPhoto: false, ...SIGN });
is(a1 && a2 && a1.photo.id === a2.photo.id,
   'and it is reused rather than swapped for something unrelated');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n10  a photo suppresses competing decoration');
globalThis.window.SMPStockPhotoMode = 'force';
globalThis.window.SMPAssetMode = 'force';
let maxAssets = 0, loud = 0, checked = 0;
for (let i = 0; i < RUNS; i++) {
  const stock = pick('florist', SIGN);
  const c = P.chooseCreativeDirection('', 'florist', 'Sign', 'balanced', 'sup-' + (i % 30),
    true, 36, 24, stock);
  if (!stock) continue;
  checked++;
  maxAssets = Math.max(maxAssets, c.assets.length);
  c.assets.forEach((a) => { if (P.PHOTO_SAFE_ASSET_FAMILIES.indexOf(a.family) === -1) loud++; });
}
is(maxAssets <= 1, 'at most ONE design asset joins a photograph', 'max ' + maxAssets + ' over ' + checked + ' runs');
is(loud === 0, 'and only from the quiet texture/frame families',
   P.PHOTO_SAFE_ASSET_FAMILIES.join(', '));
globalThis.window.SMPStockPhotoMode = 'off';
let withoutPhotoMax = 0;
for (let i = 0; i < RUNS; i++) {
  const c = P.chooseCreativeDirection('', 'florist', 'Sign', 'rich', 'nosup-' + (i % 30), true, 36, 24, null);
  withoutPhotoMax = Math.max(withoutPhotoMax, c.assets.length);
}
is(withoutPhotoMax > 1, 'with no photo, design-asset selection is untouched',
   'still reaches ' + withoutPhotoMax + ' assets');
globalThis.window.SMPStockPhotoMode = 'auto';
globalThis.window.SMPAssetMode = 'auto';

console.log('\n11  what reaches the model');
globalThis.window.SMPStockPhotoMode = 'force';
const sel = pick('dentist', SIGN);
const block = P.renderStockPhotoBlock(sel);
is(block.includes(sel.photo.url), 'the prompt carries the chosen photo\'s URL', sel.photo.url);
is(!/base64|data:image/i.test(block), 'and never base64 or a data: URI');
is((block.match(/assets\/stock-photo-library\//g) || []).length <= 2,
   'exactly one file is named — not a listing of the library');
STOCK.photos.forEach(() => {});
is(STOCK.photos.filter((p) => block.includes(p.file)).length === 1,
   'no other photograph is mentioned');
is(/scrim/i.test(block) && /band grades/i.test(block),
   'the scrim requirement and band grades travel with it');
const withPhoto = P.chooseCreativeDirection('', 'dentist', 'Sign', 'balanced', 'pk1', true, 36, 24, sel);
is(withPhoto.text.includes(sel.photo.url), 'and the direction text embeds that block');
const noPhoto = P.chooseCreativeDirection('', 'dentist', 'Sign', 'balanced', 'pk2', true, 36, 24, null);
is(!noPhoto.text.includes('SUPPLIED PHOTOGRAPH'),
   'a generation with no photo carries no photograph block at all');
is(/SUPPLIED PHOTOGRAPH — when the Style Direction supplies one/.test(P.HTML_PROMPT),
   'the HTML prompt states the photograph rules');
is(/<img> is allowed for a user-provided Image URL, for a supplied photograph/.test(P.HTML_PROMPT),
   'and permits the <img> that renders it');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n13  blank industry: inference first, then the general-purpose pool');
const GENERAL_IDS = STOCK.photos.filter((p) => p.general_purpose === true).map((p) => p.id);
is(GENERAL_IDS.length >= 8 && GENERAL_IDS.length <= 15,
   'the manifest flags a real general-purpose pool', GENERAL_IDS.length + ' photos');
is(STOCK.photos.filter((p) => p.general_purpose).every((p) =>
     /headshot|business-professionals|technology-team|city-buildings|living-room|mountain|coastal|cafe|family-outdoors|senior-couple/.test(p.id)),
   'and only genuinely neutral files carry the flag', GENERAL_IDS.join(', '));

globalThis.window.SMPStockPhotoMode = 'force';
/* 1. Inference: the field is blank, the business name says the trade. */
const INFER = [
  ['Chen Family Dental', 'dental', '04-vertical-dentist-with-patient.png'],
  ['Riverside Chiropractor', 'chiropractic', null],
  ['Bloom Florist Studio', 'florist', '01-vertical-florist-bouquet.png'],
  ['Apex Plumbing Ltd', 'plumbing', '17-vertical-plumber-kitchen-repair.png'],
];
INFER.forEach(([name, slug, file]) => {
  const r = pickBlank(name);
  is(!!r && r.industry === slug && (!file || r.photo.file === file) && !r.generalPurpose,
     `blank field + business name "${name}" -> the ${slug} pool`,
     r ? r.photo.file + ' (' + r.industry + ')' : P.lastStockReason);
});
const viaInstructions = pickBlank('modern look please, we are a veterinary clinic');
is(!!viaInstructions && viaInstructions.industry === 'veterinary',
   'special instructions infer the trade the same way',
   viaInstructions ? viaInstructions.photo.file : P.lastStockReason);

/* 2. A determined trade the library cannot serve gets NOTHING — not general. */
let inferredOrphan = 0;
for (let i = 0; i < 120; i++) if (pickBlank('Lakeside Roofing Ltd')) inferredOrphan++;
is(inferredOrphan === 0,
   'an inferred trade with no depicting photo gets none — the general pool is NOT a fallback for it',
   P.lastStockReason);

/* 3. Nothing determinable: only the general-purpose pool, in Force and Auto. */
let generalOnly = true, generalHits = 0;
for (let i = 0; i < 300; i++) {
  const r = pickBlank('Quantum Widget Foundry');
  if (!r) { generalOnly = false; break; }
  generalHits++;
  if (!r.generalPurpose || GENERAL_IDS.indexOf(r.photo.id) === -1) generalOnly = false;
  if (r.industry !== 'general-purpose') generalOnly = false;
}
is(generalOnly && generalHits === 300,
   'Force with nothing determinable always finds a general-purpose photo, labelled as such');
const genVariety = new Set();
for (let i = 0; i < 200; i++) {
  const r = pickBlank('');
  if (r) genVariety.add(r.photo.id);
}
is(genVariety.size >= 5, 'and the pool actually rotates', genVariety.size + ' distinct files');
is([...genVariety].every((id) => GENERAL_IDS.indexOf(id) !== -1),
   'never reaching outside the flagged general set');

globalThis.window.SMPStockPhotoMode = 'auto';
/* 4. Auto uses the same hierarchy at the same product rates. */
let blankSign = 0, blankCard = 0;
for (let i = 0; i < RATE_RUNS; i++) {
  if (pickBlank('', SIGN)) blankSign++;
  if (pickBlank('', CARD)) blankCard++;
}
const bs = blankSign / RATE_RUNS, bc = blankCard / RATE_RUNS;
console.log(`     blank industry: sign ${(bs * 100).toFixed(1)}%   business card ${(bc * 100).toFixed(1)}%`);
is(bs > 0.76 && bs < 0.85, 'blank-industry large format still runs at approximately 80–81%',
   (bs * 100).toFixed(1) + '%');
is(bc > 0.115 && bc < 0.165, 'blank-industry business cards still at approximately 14%',
   (bc * 100).toFixed(1) + '%');
let blankZero = 0;
for (let i = 0; i < RUNS; i++) {
  if (pickBlank('', STAMP)) blankZero++;
  if (pickBlank('', NAMEPLATE)) blankZero++;
}
is(blankZero === 0, 'stamps and nameplates stay at zero with a blank industry too');
globalThis.window.SMPStockPhotoMode = 'force';
let blankCustomer = 0;
for (let i = 0; i < 100; i++) if (pickBlank('', SIGN, { hasCustomerPhoto: true })) blankCustomer++;
is(blankCustomer === 0, 'and the customer\'s own photograph still wins over the general pool');
globalThis.window.SMPStockPhotoMode = 'auto';

console.log('\n12  performance');
const t0 = process.hrtime.bigint();
const N = 20000;
for (let i = 0; i < N; i++) pick('dentist', SIGN);
const t1 = process.hrtime.bigint();
const per = Number(t1 - t0) / 1e6 / N;
console.log(`     ${N} selections in ${(Number(t1 - t0) / 1e6).toFixed(0)}ms — ${per.toFixed(4)}ms each`);
is(per < 1, 'selection is sub-millisecond', per.toFixed(4) + 'ms');
is(!/for[\s\S]{0,200}fetch\(/.test(ENGINE_SRC.split('function pickStockPhoto')[1].slice(0, 3000)),
   'selection opens no network connection of its own');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
