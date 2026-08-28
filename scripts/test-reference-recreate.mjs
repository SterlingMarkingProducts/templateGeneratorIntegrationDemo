/* Reference Design recreation: with a reference in recreate mode, the
   reference is the visual authority — no rotated direction, no stock photo,
   no library mark, no design assets, no colour stance compete with it — and
   a generation WITHOUT a reference is byte-for-byte the normal pipeline. */
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

/* Mock Anthropic: records every prompt, answers with canned text. */
const calls = [];
const answer = (text) => ({ content: [{ type: 'text', text }] });
/* A distinctive bold-geometry fixture — long enough (~3 KB) to prove the
   analysis travels untruncated into BOTH generation passes. */
const ANALYSIS = [
  'SIDES', 'Single design.',
  'BRAND', 'HART & CO — bold black caps.',
  'TEXT CONTENT — verbatim', 'HART & CO', 'DESIGN OFFICE', 'hello@hart.co',
  'COLORS',
  'Background white/cream #f7f4ec; cobalt blue #1a3fd4 (rectangular field and giant circle); bright yellow #ffd400 field; red/orange #e8451f vertical block; black #111111 type and rules.',
  'LOGO / ICONS', 'None — the typography is the mark.',
  'TYPOGRAPHY',
  'Oversized bold black SANS-SERIF, tight tracking, all caps; the name spans ~70% of the width, roughly 1/4 of the height. No serifs anywhere.',
  'GEOMETRY — every major region',
  '- cobalt circle #1a3fd4, ~42% canvas width, centred at ~78% x / 45% y',
  '- cobalt rectangle #1a3fd4, left edge, ~22% width x 60% height',
  '- yellow field #ffd400, bottom band, full width x ~18% height',
  '- red/orange vertical block #e8451f, ~8% width x full height at ~60% x',
  '- two black horizontal rules, 3px, upper third',
  'SCALE & HIERARCHY', 'The name dominates; the circle is second; contact text is small.',
  'WHITESPACE', 'Upper right quadrant largely empty (~25% of canvas).',
  'TEXTURE / EFFECTS', 'None — flat, hard-edged.',
  'PHOTO REGIONS', 'none',
  'DISTINCTIVE FEATURES', 'Giant cobalt circle; extreme scale contrast; hard modernist blocks.',
  'FIDELITY MANDATE', 'Reproduce faithfully, adapting only to the product dimensions.',
].join('\n') + '\nPAD ' + 'x'.repeat(1200);
let analysisFailures = 0;   // how many analysis calls should reject before succeeding
globalThis.anthropic = {
  messages: {
    create: async (req) => {
      calls.push(req);
      const isVision = Array.isArray(req.messages[0].content)
        && req.messages[0].content.some((c) => c.type === 'image')
        && req.max_tokens <= 2600;
      if (isVision && JSON.stringify(req.messages).includes('Transcribe and describe it COMPLETELY')) {
        if (analysisFailures > 0) { analysisFailures--; throw new Error('HTTP 502 from aiProxy'); }
        return answer(ANALYSIS);
      }
      if (isVision) return answer(ANALYSIS);
      return answer('SPEC: canned');
    },
    stream: (req) => {
      calls.push(req);
      return {
        on() { return this; },
        async finalMessage() { return answer('<html><body><div class="card">x</div></body></html>'); },
        [Symbol.asyncIterator]: async function* () {},
      };
    },
  },
};
const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { handleGenerate, loadStockPhotoLibrary, loadAssetLibrary, loadLogoLibrary };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
await Promise.all([P.loadStockPhotoLibrary(), P.loadAssetLibrary(), P.loadLogoLibrary()]);

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const PNG1 = 'iVBORw0KGgoAAAANSUhEUg';   // any base64-ish stub — never decoded by the mock

async function run(body) {
  calls.length = 0;
  const events = [];
  await P.handleGenerate(Object.assign({
    templateType: 'Business Card', width: 3.5, height: 2, unit: 'in',
    industry: 'chiropractor clinic', businessName: 'Meridian Spine',
    creativityLevel: 'balanced',
  }, body), (e) => events.push(e));
  /* every text prompt that reached the model, joined */
  const prompts = calls.map((c) => JSON.stringify(c.messages)).join('\n');
  return { prompts, events, calls: calls.length };
}

console.log('\n1  recreate mode: the reference is the authority');
globalThis.window.SMPStockPhotoMode = 'force';
globalThis.window.SMPAssetMode = 'force';
globalThis.window.SMPLogoMode = 'force';
const rec = await run({
  referenceImage: { data: PNG1, mediaType: 'image/png' },
  referenceMode: 'recreate',
});
is(/REFERENCE DESIGN TO RECREATE/.test(rec.prompts), 'the recreate directive reaches the model');
is(/PRIMARY VISUAL AUTHORITY/.test(rec.prompts) && /curved or arc-following text, oversized concentric arcs/.test(rec.prompts),
   'demanding composition, shapes, hierarchy, typography personality, texture and arc effects');
is(rec.prompts.includes('cobalt blue #1a3fd4 (rectangular field and giant circle)'),
   'with the reference analysis embedded');
/* the analysis must reach BOTH generation passes IN FULL — no truncation */
const genCalls = calls.filter((c) => !JSON.stringify(c.messages).includes('Transcribe and describe it COMPLETELY'));
is(genCalls.length === 2
   && genCalls.every((c) => JSON.stringify(c.messages).includes('cobalt circle #1a3fd4, ~42% canvas width')
        && JSON.stringify(c.messages).includes('DISTINCTIVE FEATURES')),
   'the FULL structured analysis (palette, geometry, hierarchy) reaches the SPEC and the HTML calls untruncated');
is(/BINDING DATA, not inspiration/.test(rec.prompts)
   && /Never substitute serif for sans/.test(rec.prompts),
   'both generation prompts declare the analysis sections BINDING');
is((globalThis.window.SMPLastReference || {}).active === true
   && /cobalt|1a3fd4/i.test((globalThis.window.SMPLastReference || {}).summary || ''),
   'the DEV reference diagnostic shows what the vision pass actually saw',
   (globalThis.window.SMPLastReference || {}).summary);
/* the static prompt RULES legitimately mention these sections; what must be
   absent is any actual SELECTION — a named file from any library. */
is(!/SUPPLIED PHOTOGRAPH — one real image file/.test(rec.prompts)
   && !rec.prompts.includes('assets/stock-photo-library/'),
   'NO stock photo is selected or named — even under Force Photo');
is(!/SUPPLIED BRAND MARK — one logo file/.test(rec.prompts)
   && !rec.prompts.includes('assets/logo-library/'),
   'NO library mark is selected or named — even under Force Logo');
is(!rec.prompts.includes('assets/design-library/'),
   'NO design asset is selected or named — even under Force Asset');
is(!/DESIGN DENSITY — (RESTRAINED|BALANCED|RICH)/.test(rec.prompts)
   && !/INSPIRATION DIRECTION/.test(rec.prompts)
   && !/COLOUR STANCE —/.test(rec.prompts),
   'no density contract, rotated direction, or colour stance competes with it');
is(/Use the EXACT colours from the REFERENCE DESIGN/.test(rec.prompts),
   'and the palette defers to the reference');
is((globalThis.window.SMPLastStockPhoto || {}).reason === 'a reference design is being recreated'
   && /reference design is being recreated/.test((globalThis.window.SMPLastLogoSelection || {}).reason),
   'the DEV indicators say WHY nothing was selected');

console.log('\n2  the user\'s explicit choices still modify a recreation');
const recStyle = await run({
  referenceImage: { data: PNG1, mediaType: 'image/png' },
  referenceMode: 'recreate',
  styleDirection: 'Dark Luxe',
  colors: { primary: '#101820' },
});
is(/USER STYLE MODIFIER/.test(recStyle.prompts) && /Dark Luxe/.test(recStyle.prompts),
   'a typed/chip style rides along as a modifier');
is(/USER-SELECTED PALETTE, MANDATORY/.test(recStyle.prompts),
   'explicit colours still win over the reference palette');

console.log('\n3  inspire mode and no-reference generation are unchanged');
const insp = await run({
  referenceImage: { data: PNG1, mediaType: 'image/png' },
  referenceMode: 'inspire',
});
is(/STYLE REFERENCE INSPIRATION/.test(insp.prompts)
   && !/REFERENCE DESIGN TO RECREATE — the user uploaded/.test(insp.prompts),
   'inspire mode keeps its channel-the-energy framing');
is(/DESIGN DENSITY — (RESTRAINED|BALANCED|RICH)/.test(insp.prompts)
   && insp.prompts.includes('assets/stock-photo-library/'),
   'and the normal creative pipeline still runs there');
const plain = await run({});
is(/DESIGN DENSITY — (RESTRAINED|BALANCED|RICH)/.test(plain.prompts)
   && plain.prompts.includes('assets/stock-photo-library/')
   && plain.prompts.includes('assets/logo-library/'),
   'no reference -> the full normal pipeline (forced photo, mark, density) is untouched');
is(!/REFERENCE DESIGN TO RECREATE — the user uploaded|USER STYLE MODIFIER/.test(plain.prompts),
   'and carries no recreation language');
globalThis.window.SMPStockPhotoMode = 'auto';
globalThis.window.SMPAssetMode = 'auto';
globalThis.window.SMPLogoMode = 'auto';

console.log('\n3b  an analysis failure can no longer become an unrelated design');
analysisFailures = 1;
const retried = await run({ referenceImage: { data: PNG1, mediaType: 'image/png' }, referenceMode: 'recreate' });
is(/REFERENCE DESIGN TO RECREATE/.test(retried.prompts),
   'one proxy hiccup -> a silent retry succeeds and the recreation proceeds');
analysisFailures = 2;
const dead = await run({ referenceImage: { data: PNG1, mediaType: 'image/png' }, referenceMode: 'recreate' });
const deadError = dead.events.find((e) => e.error);
is(!!deadError && /could not be analysed/.test(deadError.error)
   && /NOT generated/.test(deadError.error),
   'two failures -> the generation STOPS with a clear error instead of inventing a design');
is(!dead.prompts.includes('SPEC') || dead.calls <= 2,
   'and no spec/HTML generation ran without the reference', dead.calls + ' calls');
is(!!(globalThis.window.SMPLastReference || {}).error
   && (globalThis.window.SMPLastReference || {}).summary === '',
   'with the DEV diagnostic reporting the failure',
   (globalThis.window.SMPLastReference || {}).error);
analysisFailures = 0;
is(/GEOMETRY — every major region/.test(ENGINE_SRC) && /SCALE & HIERARCHY/.test(ENGINE_SRC)
   && /PHOTO REGIONS/.test(ENGINE_SRC) && /DISTINCTIVE FEATURES/.test(ENGINE_SRC),
   'the analysis prompt demands the structured sections (geometry, scale, whitespace, texture, photo regions)');

console.log('\n4  the reference image itself travels to both generation passes');
is(rec.calls >= 3, 'analysis + spec + html all ran', rec.calls + ' calls');
const withImage = calls.length;   // from `plain`, reset per run — recount on a fresh recreate
calls.length = 0;
await run({ referenceImage: { data: PNG1, mediaType: 'image/png' }, referenceMode: 'recreate' });
const imageCalls = calls.filter((c) => JSON.stringify(c.messages).includes(PNG1)).length;
is(imageCalls >= 3, 'the reference pixels are attached to analysis, spec and HTML calls', imageCalls + '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
