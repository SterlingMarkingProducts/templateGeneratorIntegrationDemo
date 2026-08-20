/* Product-integration tests (Phase 2A) — pure Node, no browser, no network.
 *
 * Covers the ProductProvider / Product-contract boundary. The browser-level
 * regression (Generator -> Push to Designer -> realdesigner) stays in
 * scripts/test-integration.mjs.
 *
 * A transport is INJECTED into every SterlingProductProvider here, so no test
 * can reach the network even by mistake. A global guard additionally fails the
 * run if anything touches fetch.
 *
 *   node scripts/test-product-provider.mjs
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const FIX = join(ROOT, 'scripts', '__fixtures__');

/* --- network tripwire: any real fetch fails the suite ---------------- */
const networkAttempts = [];
globalThis.fetch = async (url) => {
  networkAttempts.push(String(url));
  throw new Error('NETWORK BLOCKED IN TESTS: ' + url);
};

/* --- load the integration layer as plain scripts --------------------- */
globalThis.window = globalThis;
require(join(ROOT, 'integration/product-contract.js'));
require(join(ROOT, 'integration/product-provider.js'));
require(join(ROOT, 'integration/normalized-design.js'));
require(join(ROOT, 'integration/adapters/sterling-legacy.js'));

const C = globalThis.SMPProductContract;
const P = globalThis.SMPProductProvider;
const { SterlingProductProvider, DemoProductProvider, ProductSourceError } = P;

const recordedStampInfo = JSON.parse(fs.readFileSync(join(FIX, 'recorded-getstampinfo-8901.json'), 'utf8'));
const recordedClean = JSON.parse(fs.readFileSync(join(FIX, 'recorded-productlookup-8901.json'), 'utf8'));

/* --- tiny assertion harness ------------------------------------------ */
const results = [];
let failed = 0;
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, pass: true, detail: detail || '' });
  } catch (e) {
    failed++;
    results.push({ name, pass: false, detail: e.message });
  }
}
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

/** Recorded-response transport. Serves fixtures by URL; never touches a socket. */
function recordedTransport(map, opts = {}) {
  const seen = [];
  const impl = async (url) => {
    seen.push(url);
    if (opts.throwNetwork) throw new Error('simulated DNS failure');
    const key = Object.keys(map).find((k) => url.includes(k));
    if (!key) return { status: 404, json: async () => ({ error: { code: 'not-found' } }) };
    const body = map[key];
    if (body && body.__status) return { status: body.__status, json: async () => body };
    return { status: 200, json: async () => body };
  };
  impl.seen = seen;
  return impl;
}

const CFG = { baseUrl: 'https://products.example.invalid/api', siteFamilyId: 1, live: true };

/* ==================== A. DemoProductProvider still works ============== */
check('A. DemoProductProvider unchanged', () => {
  const d = new DemoProductProvider();
  eq(d.bleedPxFor('Business Card'), 12, 'business card bleed');
  eq(d.bleedPxFor('Stamp'), 0, 'stamp bleed');
  eq(d.designerModeFor('Business Card'), 'FullColour', 'card mode');
  eq(d.designerModeFor('Name Badge'), 'EngravedPlastic', 'badge mode');
  /* Stamps are Grayscale on the standalone path, matching the Sterling-product
   * path. SingleColour is never the default anywhere in the Generator. */
  eq(d.designerModeFor('Stamp'), 'Grayscale', 'stamp mode');
  const demoModes = ['Business Card', 'Poster', 'Sign', 'Brochure', 'Stamp', 'Nameplate', 'Name Badge']
    .map((t) => d.designerModeFor(t));
  ok(!demoModes.includes('SingleColour'), 'SingleColour must never be a demo default');
  const r = d.resolve({ templateType: 'Business Card', doubleSided: true });
  eq(r.pageCount, 2, 'page count');
  eq(r.authoritative, false, 'demo must never claim authority');
  eq(P.get().id, 'demo-provider', 'demo is still the default active provider');
  return 'bleed/mode/pages/authority all unchanged';
});

/* ==================== B. loads a recorded lookup ====================== */
let cleanProduct = null;
await (async () => {
  const t = recordedTransport({ '/productLookup.cfm': recordedClean });
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t });
  try {
    cleanProduct = await p.getById(8901);
    eq(C.validate(cleanProduct), [], 'clean-API record must validate');
    results.push({ name: 'B. SterlingProductProvider loads recorded clean response', pass: true,
      detail: `id=${cleanProduct.id} part=${cleanProduct.partNumber} ${cleanProduct.dimensions.widthIn}x${cleanProduct.dimensions.heightIn}in` });
  } catch (e) {
    failed++; results.push({ name: 'B. SterlingProductProvider loads recorded clean response', pass: false, detail: e.message });
  }
})();

/* ==================== C + D. recorded HLCBBCE normalizes correctly ==== */
let stampProduct = null;
await (async () => {
  const t = recordedTransport({ '/productLookup.cfm': recordedStampInfo });
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t, responseFormat: 'stampinfo' });
  stampProduct = await p.getByPartNumber('HLCBBCE');
})();

check('C. recorded getStampInfo normalizes to a valid Product', () => {
  eq(C.validate(stampProduct), [], 'contract validation problems');
  return 'validator clean';
});

check('D. product facts map correctly (real recorded values)', () => {
  eq(stampProduct.id, 8901, 'id');
  eq(stampProduct.partNumber, 'HLCBBCE', 'partNumber');
  eq(stampProduct.name, 'Hearing Life Co Branded Business Card - English', 'name');
  eq(stampProduct.dimensions.widthIn, 3.5, 'widthIn');
  eq(stampProduct.dimensions.heightIn, 2, 'heightIn');
  eq(stampProduct.dimensions.widthPx, 336, 'widthPx (3.5*96, matches recorded CANVASWIDTH)');
  eq(stampProduct.dimensions.heightPx, 192, 'heightPx (2*96, matches recorded CANVASHEIGHT)');
  eq(stampProduct.bleed, { top: 12, right: 12, bottom: 12, left: 12 }, 'bleed');
  eq(stampProduct.pages, { min: 2, max: 2 }, 'pages');
  eq(stampProduct.shape, 'rect', 'shape');
  eq(stampProduct.maxLines, 3, 'maxLines');
  /* derived px must equal the values Sterling itself computed */
  eq(stampProduct.dimensions.widthPx, recordedStampInfo.CANVASWIDTH, 'derived px == recorded CANVASWIDTH');
  eq(stampProduct.dimensions.heightPx, recordedStampInfo.CANVASHEIGHT, 'derived px == recorded CANVASHEIGHT');
  return 'id/part/name/size/bleed/pages/shape all correct';
});

/* ==================== E. legacy facts isolated ======================== */
check('E. legacy facts isolated under .legacy', () => {
  eq(stampProduct.legacy.designerVariationCode, 3, 'code');
  eq(stampProduct.legacy.designerMode, 'FullColour', 'mode');
  eq(stampProduct.legacy.designerModeProven, true, 'code 3 is the proven one');
  eq(stampProduct.legacy.margins, { top: 6, right: 6, bottom: 6, left: 6 }, 'margins');
  eq(stampProduct.legacy.borders.width, 2, 'border width');
  /* none of these may appear at the top level */
  const top = Object.keys(stampProduct);
  ['designerMode', 'designerVariationCode', 'margins', 'borders', 'daterBox',
   'isProStamp', 'greenInkAvailable', 'clipPaths'].forEach((k) => {
    ok(!top.includes(k), `legacy field '${k}' leaked to the top level`);
  });
  /* an unproven code must be flagged as such */
  const inferred = C.createProduct({ id: 1, partNumber: 'X', widthIn: 1, heightIn: 1,
    designerVariationCode: 1, designerMode: C.designerModeFromCode(1) });
  eq(inferred.legacy.designerMode, 'SingleColour', 'inferred mode');
  eq(inferred.legacy.designerModeProven, false, 'code 1 must NOT claim to be proven');
  return 'legacy namespaced; unproven codes flagged';
});

/* ==================== F. commercial noise discarded =================== */
check('F. pricing/variation noise never reaches the Product record', () => {
  /* provenance.note is deliberately human prose ("...variations... were
   * discarded"), so scanning it for the WORD 'variations' is a false positive.
   * Scan the data, and assert separately that the note carries no values. */
  const { provenance, ...data } = stampProduct;
  const blob = JSON.stringify(data);
  ok(!/\$|\d+\.\d{2}/.test(provenance.note || ''), 'provenance.note must not contain prices');
  ok(recordedStampInfo.LOWESTPRICE !== undefined, 'fixture must contain pricing for this test to mean anything');
  ok(recordedStampInfo.VARIATIONS.length > 0, 'fixture must contain variations');
  ['LOWESTPRICE', 'lowestPrice', 'VARIATIONS', 'variations', 'PRICE', '$1.00',
   'HLCBBCE-500', 'COLOURS', 'colours', 'PRODUCTOPTIONS'].forEach((needle) => {
    ok(!blob.includes(needle), `commercial/UI noise '${needle}' leaked into the Product record`);
  });
  /* and no ColdFusion UPPERCASE naming survives */
  ['CANVASWIDTH', 'PRODUCTIDINT', 'DESIGNERVARIATIONCODE', 'BLEEDTOP', 'PARTNUMBER']
    .forEach((k) => ok(!blob.includes(k), `raw CF field name '${k}' leaked`));
  return 'no pricing, variations, colours, or UPPERCASE CF names';
});

/* ==================== G. missing product ============================== */
await (async () => {
  const t = recordedTransport({});           // nothing registered -> 404
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t });
  try {
    await p.getById(999999);
    failed++; results.push({ name: 'G. missing product returns a predictable error', pass: false, detail: 'no error thrown' });
  } catch (e) {
    const pass = e.name === 'ProductSourceError' && e.code === 'not-found';
    if (!pass) failed++;
    results.push({ name: 'G. missing product returns a predictable error', pass, detail: `${e.name}/${e.code}` });
  }
})();

/* ==================== H. invalid record fails validation ============== */
await (async () => {
  const broken = { ...recordedClean, dimensions: { ...recordedClean.dimensions, widthIn: 0 } };
  const t = recordedTransport({ '/productLookup.cfm': broken });
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t });
  try {
    await p.getById(8901);
    failed++; results.push({ name: 'H. invalid record fails validation clearly', pass: false, detail: 'accepted a zero-width product' });
  } catch (e) {
    const pass = e.code === 'invalid-record' && /widthIn/.test(e.message);
    if (!pass) failed++;
    results.push({ name: 'H. invalid record fails validation clearly', pass, detail: e.message.slice(0, 90) });
  }
})();

/* ==================== I. network failure is controlled =============== */
await (async () => {
  const t = recordedTransport({ '/productLookup.cfm': recordedClean }, { throwNetwork: true });
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t });
  try {
    await p.getById(8901);
    failed++; results.push({ name: 'I. network failure produces a controlled error', pass: false, detail: 'no error thrown' });
  } catch (e) {
    const pass = e.name === 'ProductSourceError' && e.code === 'network';
    if (!pass) failed++;
    results.push({ name: 'I. network failure produces a controlled error', pass, detail: `${e.name}/${e.code}` });
  }
})();

/* ==================== J. context must be explicit ===================== */
check('J. siteFamilyId / live are explicit, never inferred', () => {
  const bad = (cfg, why) => {
    let threw = false;
    try { new SterlingProductProvider(cfg); } catch (e) { threw = true; }
    ok(threw, `should have refused: ${why}`);
  };
  bad({ siteFamilyId: 1, live: true }, 'no baseUrl');
  bad({ baseUrl: 'https://x.invalid', live: true }, 'no siteFamilyId');
  bad({ baseUrl: 'https://x.invalid', siteFamilyId: 1 }, 'no live flag');
  bad({ baseUrl: 'https://x.invalid', siteFamilyId: 1, live: 'yes' }, 'live must be boolean');

  const t = recordedTransport({ '/productLookup.cfm': recordedClean });
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t });
  const url = p.buildUrl('/productLookup.cfm', { id: 8901 });
  ok(url.includes('siteFamilyId=1'), 'siteFamilyId must be on the wire: ' + url);
  ok(url.includes('live=true'), 'live must be on the wire: ' + url);
  ok(url.startsWith(CFG.baseUrl), 'baseUrl must come from config');
  return url.replace(CFG.baseUrl, '<baseUrl>');
});

check('J2. no Sterling hostname is hardcoded in the integration layer', () => {
  for (const f of ['integration/product-provider.js', 'integration/product-contract.js',
                   'integration/adapters/sterling-legacy.js']) {
    const src = fs.readFileSync(join(ROOT, f), 'utf8');
    /* comments/doc references are fine; a literal URL is not */
    const hits = (src.match(/https?:\/\/[^\s'")]*sterling\.ca[^\s'")]*/gi) || []);
    ok(hits.length === 0, `${f} contains a hardcoded Sterling URL: ${hits[0]}`);
  }
  return 'no hardcoded hosts';
});

/* ==================== search + design-context projection ============== */
await (async () => {
  const t = recordedTransport({ '/productSearch.cfm': { results: [
    { id: 8901, partNumber: 'HLCBBCE', name: 'Hearing Life Co Branded Business Card - English',
      productFamily: 'Business Cards', width: 3.5, height: 2, unit: 'in' }] } });
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t });
  const rows = await p.search('business card', { limit: 25 });
  const pass = rows.length === 1 && rows[0].id === 8901 && !JSON.stringify(rows).includes('PRICE');
  if (!pass) failed++;
  results.push({ name: 'search() returns lightweight summaries', pass, detail: JSON.stringify(rows[0]) });
})();

check('toDesignProductContext keeps legacy reachable but not flattened', () => {
  const ctx = C.toDesignProductContext(stampProduct);
  eq(ctx.productId, 8901, 'productId');
  eq(ctx.productNumber, 'HLCBBCE', 'productNumber');
  eq(ctx.designerMode, 'FullColour', 'designerMode surfaced for the adapter');
  eq(ctx.bleedPx, 12, 'bleedPx');
  eq(ctx.pageCount, 2, 'pageCount');
  eq(ctx.authoritative, true, 'authoritative');
  ok(ctx.product && ctx.product.legacy, 'full record still reachable');
  return 'projection correct';
});

/* ==================== adapter: authoritative vs fallback ============= */
check('adapter uses authoritative legacy mode, and falls back offline', () => {
  const N = globalThis.SMPNormalized;
  const A = globalThis.SterlingLegacyAdapter;
  const page = { index: 0, bleedAuthored: false, elements: [
    N.rect({ x: 0, y: 0, width: 10, height: 10, fill: '#000', rotation: 0, opacity: 1 })] };

  const authoritative = A.toSterlingTemplate(N.createDocument({
    trimWidthPx: 336, trimHeightPx: 192, bleedPx: 12, dpi: 96, unit: 'in',
    widthIn: 3.5, heightIn: 2,
    productContext: C.toDesignProductContext(stampProduct),
    pages: [page], provenance: {},
  }));
  eq(authoritative.canvasProperties.designerVariationCode, 'FullColour', 'authoritative mode');
  eq(authoritative.canvasProperties.productNumber, 'HLCBBCE', 'authoritative part number');

  /* offline: the demo provider must still drive the adapter with no API */
  const demoCtx = new DemoProductProvider().resolve({ templateType: 'Name Badge', doubleSided: false });
  const offline = A.toSterlingTemplate(N.createDocument({
    trimWidthPx: 288, trimHeightPx: 96, bleedPx: 0, dpi: 96, unit: 'in',
    widthIn: 3, heightIn: 1, productContext: demoCtx, pages: [page], provenance: {},
  }));
  eq(offline.canvasProperties.designerVariationCode, 'EngravedPlastic', 'offline fallback mode');
  return 'authoritative -> product record; offline -> demo inference';
});

/* ==================== L. current-shape extras are ignored ============= *
 * The recorded HLCBBCE fixture predates seven keys that oldDesigner's current
 * functions.cfc::getStampInfo() now returns (see the fixture's _provenance).
 * These checks replay the recording with those keys ADDED, to prove the
 * normalizer is an allow-list and not a passthrough.
 *
 * Every value below is SYNTHETIC TEST NOISE invented solely to be findable in
 * a serialized record. None of it is a real Sterling product value, and none of
 * it is written back to the fixture — the recording on disk stays untouched. */
const SYNTHETIC = {
  /* consumed by design: bandString is an already-declared contract field */
  BANDSTRING: 'SYNTHETIC-BAND-NOISE',
  /* must be discarded */
  DESCRIPTIONFR: 'SYNTHETIC-FR-NOISE',
  PRODUCTOPTIONS: [{ CATEGORY: 'SYNTHETIC-OPTCAT-NOISE', OPTIONS: [{ DESCRIPTION: 'SYNTHETIC-OPT-NOISE', PRICE: '$99.99' }] }],
  SAMPLEIMAGEEN: 'SYNTHETIC-SAMPLE-EN-NOISE.png',
  SAMPLEIMAGEFR: 'SYNTHETIC-SAMPLE-FR-NOISE.png',
  PRODUCTIMAGEEN: 'SYNTHETIC-PRODIMG-EN-NOISE.png',
  PRODUCTIMAGEFR: 'SYNTHETIC-PRODIMG-FR-NOISE.png',
};
const DISCARDABLE_EXTRAS = Object.keys(SYNTHETIC).filter((k) => k !== 'BANDSTRING');

/** Re-normalize the recording with extra raw keys merged in. */
async function normalizeWithExtras(extras) {
  const t = recordedTransport({ '/productLookup.cfm': { ...recordedStampInfo, ...extras } });
  const p = new SterlingProductProvider({ ...CFG, fetchImpl: t, responseFormat: 'stampinfo' });
  return p.getByPartNumber('HLCBBCE');
}

/* provenance.fetchedAt is a wall-clock stamp; compare everything else. */
const withoutStamp = (prod) => {
  const { provenance, ...rest } = prod;
  const { fetchedAt, ...prov } = provenance;
  return { ...rest, provenance: prov };
};

let extrasProduct = null, allExtrasProduct = null;
await (async () => {
  extrasProduct = await normalizeWithExtras(
    DISCARDABLE_EXTRAS.reduce((a, k) => (a[k] = SYNTHETIC[k], a), {}));
  allExtrasProduct = await normalizeWithExtras(SYNTHETIC);
})();

check('L1. the six non-contract extras leave the Product record identical', () => {
  eq(C.validate(extrasProduct), [], 'contract validation problems');
  eq(withoutStamp(extrasProduct), withoutStamp(stampProduct),
     'normalized record must be byte-identical with the six extras present');
  return DISCARDABLE_EXTRAS.length + ' extras present, record unchanged';
});

check('L2. no synthetic extra value appears anywhere in the record', () => {
  const blob = JSON.stringify(extrasProduct);
  ok(blob.includes('HLCBBCE'), 'sanity: the record really is the HLCBBCE product');
  ['SYNTHETIC-FR-NOISE', 'SYNTHETIC-OPTCAT-NOISE', 'SYNTHETIC-OPT-NOISE',
   'SYNTHETIC-SAMPLE-EN-NOISE', 'SYNTHETIC-SAMPLE-FR-NOISE',
   'SYNTHETIC-PRODIMG-EN-NOISE', 'SYNTHETIC-PRODIMG-FR-NOISE',
   '$99.99', '.png'].forEach((needle) => {
    ok(!blob.includes(needle), `synthetic extra '${needle}' leaked into the Product record`);
  });
  /* pricing from the recording itself is still discarded with extras present */
  ['LOWESTPRICE', 'VARIATIONS', 'HLCBBCE-500', '$1.00', 'COLOURS']
    .forEach((n) => ok(!blob.includes(n), `commercial value '${n}' leaked`));
  return 'descriptionFR, productOptions, sample/product images and pricing all discarded';
});

check('L3. no UPPERCASE ColdFusion key survives normalization', () => {
  /* Walk every key at every depth: a CF key is ALLCAPS (with optional digits)
   * and at least four characters, which no contract field is. */
  const offenders = [];
  (function walk(v, path) {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === 'object') {
      Object.keys(v).forEach((k) => {
        if (/^[A-Z][A-Z0-9]{3,}$/.test(k)) offenders.push(`${path}.${k}`);
        walk(v[k], `${path}.${k}`);
      });
    }
  })(allExtrasProduct, '$');
  eq(offenders, [], 'UPPERCASE CF keys leaked');
  /* and the seven raw key names themselves must not appear as keys */
  const blobKeys = JSON.stringify(allExtrasProduct);
  Object.keys(SYNTHETIC).forEach((k) => {
    ok(!blobKeys.includes('"' + k + '"'), `raw CF key '${k}' survived as a key`);
  });
  return '0 UPPERCASE keys at any depth';
});

check('L4. bandString is consumed by design, not accidentally', () => {
  /* BANDSTRING is the one of the seven that the contract already declares
   * (legacy.bandString). It must flow through — and change NOTHING else. */
  eq(allExtrasProduct.legacy.bandString, SYNTHETIC.BANDSTRING, 'legacy.bandString');
  eq(stampProduct.legacy.bandString, '', 'baseline had no BANDSTRING to consume');
  const a = withoutStamp(allExtrasProduct), b = withoutStamp(stampProduct);
  a.legacy = { ...a.legacy, bandString: '' };
  eq(a, b, 'bandString aside, the record must be identical');
  return 'bandString -> legacy.bandString; nothing else moved';
});

check('L5. designerVariationCode 4 is now proven, 1 and 2 are not', () => {
  eq(C.PROVEN_MODE_CODES, [3, 4], 'proven set');
  eq(C.designerModeFromCode(4), 'EngravedPlastic', 'code 4 mode');
  eq(C.designerModeFromCode(3), 'FullColour', 'code 3 mode');
  const proven = (code) => C.createProduct({ id: 1, partNumber: 'X', widthIn: 1, heightIn: 1,
    designerVariationCode: code, designerMode: C.designerModeFromCode(code) }).legacy.designerModeProven;
  eq(proven(3), true, 'code 3 proven');
  eq(proven(4), true, 'code 4 proven (gettemplateJson.cfm:165-166)');
  eq(proven(1), false, 'code 1 must stay unproven');
  eq(proven(2), false, 'code 2 must stay unproven');
  return 'proven {3,4}; {1,2} still flagged unproven';
});

/* ==================== K. nothing touched the network ================= */
check('K. no request reached sterling.ca (or any network)', () => {
  eq(networkAttempts, [], 'real fetch attempts');
  return '0 network calls';
});

/* ---------------------------- report --------------------------------- */
console.log('\n=========== PRODUCT PROVIDER / CONTRACT TESTS ===========\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '\n        ' + r.detail : ''}`);
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
console.log(failed ? 'RESULT: FAIL\n' : 'RESULT: PASS\n');
process.exit(failed ? 1 : 0);
