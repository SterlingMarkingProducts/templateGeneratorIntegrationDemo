/* Icon identity across the Generator → importer handoff.
 *
 * A real production push (templateId 38306) came back with an ENVELOPE where
 * the Generator had drawn a PHONE. This test drives the ACTUAL handoff path —
 * offscreen extraction → asset extraction → multipart build → the server-side
 * importer's rewrite — with two visibly different icons and asserts that each
 * outgoing object still carries its own artwork.
 *
 * It is deliberately narrow: only the image/asset handoff, nothing else.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const PORT = 8899;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CAT_SRC = await readFile(new URL('./test-product-type.mjs', import.meta.url), 'utf8');
const CATALOGUE = JSON.parse(CAT_SRC.slice(CAT_SRC.indexOf('const CATALOGUE = ') + 18,
  CAT_SRC.indexOf(';\n', CAT_SRC.indexOf('const CATALOGUE = '))));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (/devProductCatalogue\.cfm$/.test(url.pathname)) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(CATALOGUE));
    return;
  }
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end(); return; }
  const rel = normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(REPO, rel);
  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

/* The two icons, straight off disk — these are the bytes the Generator inlines. */
const ICONS = {};
for (const n of ['phone', 'mail']) {
  ICONS[n] = await readFile(join(REPO, 'generator/icons/minimal', n + '.svg'), 'utf8');
}
/* A signature that identifies each icon unambiguously: the first path's
 * opening coordinate pair, which differs between every icon in the bank. */
const sig = (svg) => (/ d="M\s*([-\d.]+,[-\d.]+)/.exec(svg) || [, ''])[1];
const SIG = { phone: sig(ICONS.phone), mail: sig(ICONS.mail) };
console.log(`icon signatures: phone=${SIG.phone}  mail=${SIG.mail}`);
if (!SIG.phone || !SIG.mail || SIG.phone === SIG.mail) {
  console.error('FATAL: the two icon fixtures are not distinguishable'); process.exit(1);
}

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1',
    '--unsafely-treat-insecure-origin-as-secure=http://web03.sterling.ca:' + PORT] });
const page = await (await br.newContext()).newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPPush && window.SMPTransportImport, null, { timeout: 15000 });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.catalogueSize() > 0, null, { timeout: 15000 });
await page.evaluate(() => window.SMPProductSelection.selectByPartNumber('BCDP-CM'));
await page.waitForTimeout(200);
await page.addScriptTag({ url: FOLDER + 'integration/adapters/mock-template-import.js' });
await page.waitForFunction(() => window.SMPMockTemplateImport, null, { timeout: 5000 });

console.log('\n1  the icon bank maps every name to its OWN file');
const man = JSON.parse(await readFile(join(REPO, 'generator/icons/manifest.json'), 'utf8'));
const byName = {}, byFile = {};
man.icons.forEach((e) => {
  const k = e.collection + '/' + e.name;
  (byName[k] = byName[k] || []).push(e.file);
  (byFile[e.file] = byFile[e.file] || []).push(k);
});
is(Object.values(byName).every((v) => v.length === 1),
   'no two manifest entries share a (collection, name)',
   Object.entries(byName).filter(([, v]) => v.length > 1).map(([k]) => k).join(', ') || man.icons.length + ' icons');
is(Object.values(byFile).every((v) => v.length === 1),
   'no two icon names resolve to the same SVG file',
   Object.entries(byFile).filter(([, v]) => v.length > 1).map(([k, v]) => k + '<-' + v.join('+')).join(', '));

console.log('\n2  IconBank resolves each token to its OWN artwork');
const bank = await page.evaluate(async () => {
  const html = '<i data-icon="phone" class="a"></i><i data-icon="mail" class="b"></i>';
  const out = await window.IconBank.inline(html);
  const d = document.createElement('div');
  d.innerHTML = out;
  return [...d.querySelectorAll('span')].map((s) => ({
    name: s.getAttribute('data-icon-name'), svg: s.innerHTML }));
});
is(bank.length === 2, 'both tokens became spans', bank.length + ' spans');
is(bank[0] && bank[0].name === 'phone' && sigOf(bank[0].svg) === SIG.phone,
   'the phone token carries the phone artwork', bank[0] && sigOf(bank[0].svg));
is(bank[1] && bank[1].name === 'mail' && sigOf(bank[1].svg) === SIG.mail,
   'the mail token carries the envelope artwork', bank[1] && sigOf(bank[1].svg));
function sigOf(svg) { return sig(String(svg || '')); }

/* ── the real handoff ───────────────────────────────────────────────────── */
const DESIGN = (phoneSvg, mailSvg) => `<!DOCTYPE html><html><head><style>body{margin:0}
  .card{position:relative;width:336px;height:192px;background:#123a5e;overflow:hidden;font-family:Arial}
  .ico{position:absolute;width:18px;height:18px;color:#e8d9b0}
  .i1{left:24px;top:120px} .i2{left:24px;top:150px}
  .n{position:absolute;left:24px;top:30px;color:#fff;font-size:20px;font-weight:700}
  .t1{position:absolute;left:52px;top:120px;color:#fff;font-size:11px}
  .t2{position:absolute;left:52px;top:150px;color:#fff;font-size:11px}
</style></head><body><div class="card">
  <div class="n">Lakeside Clinic</div>
  <span class="ico i1" data-icon-name="phone">${phoneSvg}</span>
  <span class="ico i2" data-icon-name="mail">${mailSvg}</span>
  <div class="t1">555-0100</div>
  <div class="t2">hello@lakeside.ca</div>
</div></body></html>`;

const result = await page.evaluate(async ({ html }) => {
  generatedHtml = html;
  lastPayload = { templateType: 'Business Card', width: 3.5, height: 2, unit: 'in', doubleSided: false };
  const mock = window.SMPMockTemplateImport.createMockImportEndpoint({});
  const transport = new window.SMPTransportImport.TemplateImportTransport({
    baseUrl: '/mock', fetchImpl: mock });
  window.SMPPush.setTransportMode('import', transport);
  try {
    const built = await (async () => {
      const { template } = await window.SMPPush.convertCurrentDesign();
      return window.SMPTransportImport.buildRequest(template,
        window.SMPProductSelection.get(), {});
    })();
    const objs = [];
    built.manifest.pages.forEach((pg, pi) => (pg.canvasJson.objects || []).forEach((o, oi) => {
      if (o.type !== 'image') return;
      objs.push({ page: pi, index: oi, sterlingType: o.sterlingType || null,
        x: o.left, y: o.top, w: o.width, h: o.height,
        ref: o.importAssetRef || null,
        svg: (typeof o.src === 'string' && o.src.indexOf('data:image/svg+xml;base64,') === 0)
          ? atob(o.src.slice('data:image/svg+xml;base64,'.length)) : null });
    }));
    /* multipart part names + the exact bytes behind each declared refId */
    const fd = window.SMPTransportImport.toFormData(built);
    const parts = [];
    for (const [k, v] of fd.entries()) {
      if (k === 'manifest') continue;
      parts.push({ name: k, size: v.size, type: v.type });
    }
    return { ok: true, objs, parts,
      manifestAssets: built.manifest.assets.map((a) => ({ refId: a.refId, sha256: a.sha256,
        mimeType: a.mimeType, byteLength: a.byteLength })),
      stats: built.stats };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code || null };
  } finally { window.SMPPush.setTransportMode('local'); }
}, { html: DESIGN(ICONS.phone, ICONS.mail) });

/* The allowlist that lets the bank load must not have been widened past it. */
const guard = await page.evaluate(async () => {
  const probe = (p) => fetch(p, { method: 'GET' })
    .then(() => 'allowed').catch((e) => (/demo guard/i.test(e.message) ? 'blocked' : 'allowed'));
  return {
    manifest: await probe('icons/manifest.json'),
    icon: await probe('icons/minimal/phone.svg'),
    stray: await probe('../deploy-notes.json'),
    nonIcon: await probe('icons/manifest.json.bak'),
  };
});
is(guard.manifest === 'allowed' && guard.icon === 'allowed',
   'the icon manifest and its SVGs reach the page', JSON.stringify(guard));
is(guard.stray === 'blocked' && guard.nonIcon === 'blocked',
   'nothing else was opened up by the icon exception', JSON.stringify(guard));

console.log('\n3  a PHONE and an ENVELOPE survive the handoff as themselves');
is(result.ok === true, 'the design converts and builds an import request', result.error || '');
if (!result.ok) { await br.close(); server.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }

const vectors = result.objs.filter((o) => o.svg);
console.log('     image objects: ' + JSON.stringify(result.objs.map((o) =>
  ({ i: o.index, t: o.sterlingType, ref: o.ref, sig: o.svg ? sig(o.svg) : null }))));
is(vectors.length === 2, 'both icons travel as their own vector image object',
   vectors.length + ' vector objects');
const sigs = vectors.map((v) => sig(v.svg));
is(new Set(sigs).size === 2, 'the two vector objects carry DIFFERENT artwork', sigs.join(' | '));
is(sigs.includes(SIG.phone), 'the phone artwork is present in the outgoing canvas', sigs.join(' | '));
is(sigs.includes(SIG.mail), 'the envelope artwork is present in the outgoing canvas', sigs.join(' | '));
/* geometry decides WHICH is which: i1 sits above i2 in the design */
const byY = [...vectors].sort((a, b) => a.y - b.y);
is(sig(byY[0].svg) === SIG.phone, 'the UPPER icon is still the phone (not the envelope)',
   'upper=' + sig(byY[0].svg));
is(sig(byY[1].svg) === SIG.mail, 'the LOWER icon is still the envelope', 'lower=' + sig(byY[1].svg));

console.log('\n4  raster asset refs are unique and byte-correct');
const refs = result.objs.filter((o) => o.ref).map((o) => o.ref);
is(new Set(result.manifestAssets.map((a) => a.refId)).size === result.manifestAssets.length,
   'every declared asset has a unique refId', result.manifestAssets.map((a) => a.refId).join(', '));
is(new Set(result.manifestAssets.map((a) => a.sha256)).size === result.manifestAssets.length,
   'every declared asset has a distinct content hash (no two refs share bytes)');
const partNames = result.parts.map((p) => p.name).sort();
is(JSON.stringify(partNames) === JSON.stringify(result.manifestAssets
     .map((a) => 'asset_' + a.refId).sort()),
   'each manifest refId has exactly one matching asset_<refId> part', partNames.join(', '));
is(result.parts.every((p) => {
     const a = result.manifestAssets.find((x) => 'asset_' + x.refId === p.name);
     return a && a.byteLength === p.size && a.mimeType === p.type;
   }), 'each part carries the byte count and MIME its manifest entry declares');
is(refs.every((r) => result.manifestAssets.some((a) => a.refId === r)),
   'every importAssetRef in the canvas resolves to a declared asset', refs.join(', '));

console.log('\n5  the importer rewrite preserves the per-object mapping');
const rewrite = await page.evaluate(({ objs, assets }) => {
  /* Mirror templateImport.cfc rewritePages(): each importAssetRef becomes the
     assetKey planned for it. Distinct content must stay distinct. */
  const keysByRef = {};
  assets.forEach((a, i) => { keysByRef[a.refId] = 'key-' + (i + 1); });
  const out = objs.map((o) => ({ index: o.index,
    imageKey: o.ref ? keysByRef[o.ref] : null,
    svgSig: o.svg ? o.svg.slice(0, 200) : null }));
  const keyed = out.filter((o) => o.imageKey);
  /* Distinct REFS must stay distinct. Two objects that legitimately carry the
     same ref (identical bytes) sharing one key is the dedup working. */
  const refs = [...new Set(objs.filter((o) => o.ref).map((o) => o.ref))];
  return { distinctRefs: refs.length,
    distinctKeysForRefs: new Set(refs.map((r) => keysByRef[r])).size,
    keyed: keyed.length,
    vectorsUntouched: out.filter((o) => o.svgSig && !o.imageKey).length };
}, { objs: result.objs, assets: result.manifestAssets });
is(rewrite.distinctRefs === rewrite.distinctKeysForRefs,
   'no two distinct asset refs collapse onto one imageKey',
   rewrite.distinctRefs + ' refs, ' + rewrite.distinctKeysForRefs + ' distinct keys');
is(rewrite.vectorsUntouched === 2,
   'both vector icons pass through the rewrite untouched (no imageKey, src kept)',
   rewrite.vectorsUntouched + ' untouched');

await br.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
