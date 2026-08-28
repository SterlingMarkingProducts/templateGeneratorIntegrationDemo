/* Uploaded "Photo for Design": the customer's photo must actually be USED —
   a mandatory, recognizable element — not merely suppress the stock library. */
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] || new URL('..', import.meta.url).pathname;
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
const calls = [];
const answer = (text) => ({ content: [{ type: 'text', text }] });
globalThis.anthropic = {
  messages: {
    create: async (req) => { calls.push(req); return answer('SPEC: canned'); },
    stream: (req) => { calls.push(req); return {
      on() { return this; },
      async finalMessage() { return answer('<html><body><div class="card">x</div></body></html>'); },
      [Symbol.asyncIterator]: async function* () {},
    }; },
  },
};
const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { handleGenerate, chooseCreativeDirection, loadStockPhotoLibrary,'
  + ' loadAssetLibrary, loadLogoLibrary, PHOTO_SAFE_ASSET_FAMILIES };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
await Promise.all([P.loadStockPhotoLibrary(), P.loadAssetLibrary(), P.loadLogoLibrary()]);

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const PHOTO_URL = 'https://smp-generated.local/uploaded-photo.jpg';

async function run(body) {
  calls.length = 0;
  await P.handleGenerate(Object.assign({
    templateType: 'Sign', width: 18, height: 12, unit: 'in',
    industry: 'chiropractor clinic', businessName: 'Meridian Spine',
    creativityLevel: 'balanced',
  }, body), () => {});
  return calls.map((c) => JSON.stringify(c.messages)).join('\n');
}

console.log('\n1  an uploaded photo is a MANDATORY design element');
const withPhoto = await run({ imageUrl: PHOTO_URL });
is(/CUSTOMER PHOTOGRAPH — the user uploaded this image to appear IN the design/.test(withPhoto),
   'the customer-photo authority block reaches the model');
is(/USING IT IS MANDATORY/.test(withPhoto) && /RECOGNIZABLY VISIBLE/.test(withPhoto),
   'stating outright that using it is not optional');
is(/side panel, a tall or wide inset, the hero image, a framed photo block/.test(withPhoto),
   'with the deliberate layout roles named');
is(/never stretch, squash or distort/.test(withPhoto) && /respect bleed and safety margins/.test(withPhoto),
   'and the no-distortion + print-fit rules');
is(withPhoto.includes(PHOTO_URL), 'the photo URL itself travels in the prompt');
is(/MUST appear, recognizably, in the design — on every product type/.test(withPhoto),
   'the EXTERNAL IMAGES rules now carry the global MUST, not just the card-side note');
is(!withPhoto.includes('assets/stock-photo-library/'),
   'stock photos stay suppressed when the customer supplied one');

console.log('\n2  decoration steps back for the customer photo');
globalThis.window.SMPAssetMode = 'force';
let maxAssets = 0, loud = 0;
for (let i = 0; i < 300; i++) {
  const c = P.chooseCreativeDirection('', 'florist', 'Sign', 'rich', 'cp' + (i % 20),
    true, 36, 24, null, null, true);
  maxAssets = Math.max(maxAssets, c.assets.length);
  c.assets.forEach((a) => { if (P.PHOTO_SAFE_ASSET_FAMILIES.indexOf(a.family) === -1) loud++; });
}
is(maxAssets <= 1 && loud === 0,
   'with a customer photo, at most one QUIET asset — the same rule a stock hero gets',
   'max ' + maxAssets + ', loud ' + loud);
globalThis.window.SMPAssetMode = 'auto';

console.log('\n3  reference + photo: the reference leads, the photo is inserted');
const both = await run({
  imageUrl: PHOTO_URL,
  referenceImage: { data: 'iVBORstub', mediaType: 'image/png' },
  referenceMode: 'recreate',
});
is(/REFERENCE DESIGN TO RECREATE/.test(both), 'the recreation directive is intact');
is(/Insert this photograph INTO that recreated layout/.test(both),
   'and the photo block tells the model to place the photo inside the recreated composition');
is(!/Give it a deliberate layout role: a side panel/.test(both),
   'using the recreation wording, not the free-layout wording');
is(!both.includes('assets/stock-photo-library/'), 'still no stock photo');

console.log('\n4  no-photo generation is unchanged');
const plain = await run({});
is(!/CUSTOMER PHOTOGRAPH/.test(plain), 'no customer block without an upload');
is(/DESIGN DENSITY — (RESTRAINED|BALANCED|RICH)/.test(plain),
   'the normal pipeline runs exactly as before');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
