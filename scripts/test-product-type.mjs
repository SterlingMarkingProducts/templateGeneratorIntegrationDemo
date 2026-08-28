/* Product type from the REAL DesignCentral classification.
   The live picker changed products but Template Type stayed "Business Card"
   for everything: the live endpoint carried no type at all, and the form kept
   whatever was already selected. devProductCatalogue.cfm now emits each
   product's authoritative product-group rows (products.id ->
   productinformationmap -> productinformation, the relation functions.cfc's
   getProductGroupsFromBasePartId() reads), and the Generator maps those
   database words — and nothing else — to its Template Type.

   The catalogue fixture below is the VERBATIM response of the updated
   devProductCatalogue.cfm, captured from a live Lucee 7 + MariaDB replica of
   designCentral-dev running the real templateImport.resolveProduct() path. */
const CATALOGUE = {
 "products": [
  {
   "maxLines": 0,
   "bleed": {
    "left": 12,
    "bottom": 12,
    "right": 12,
    "top": 12
   },
   "partNumber": "BCDP-CM",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 2,
    "max": 2
   },
   "classification": {
    "productInformation": [
     {
      "productTable": "business-cards",
      "id": 805,
      "title": "Vibrant Colour Business Cards"
     }
    ]
   },
   "dimensions": {
    "heightDisplay": "2",
    "displayUnit": "in",
    "heightIn": 2,
    "widthDisplay": "3-1/2",
    "widthIn": 3.5
   },
   "name": "Vibrant Colour Business Cards - Classic Matte",
   "id": 6505,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 3,
    "isProStamp": true,
    "bandString": "",
    "greenInkAvailable": false,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 0,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 6,
     "bottom": 6,
     "right": 6,
     "top": 6
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  },
  {
   "maxLines": 0,
   "bleed": {
    "left": 0,
    "bottom": 0,
    "right": 0,
    "top": 0
   },
   "partNumber": "DS21218",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 1,
    "max": 1
   },
   "classification": {
    "productInformation": [
     {
      "productTable": "light-gauge-plastic-signs",
      "id": 801,
      "title": "Light Gauge Plastic Signs"
     }
    ]
   },
   "dimensions": {
    "heightDisplay": "12",
    "displayUnit": "in",
    "heightIn": 12,
    "widthDisplay": "18",
    "widthIn": 18
   },
   "name": "Light Gauge Plastic Sign 12x18",
   "id": 7001,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 3,
    "isProStamp": false,
    "bandString": "",
    "greenInkAvailable": true,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 2,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 0,
     "bottom": 0,
     "right": 0,
     "top": 0
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  },
  {
   "maxLines": 0,
   "bleed": {
    "left": 0,
    "bottom": 0,
    "right": 0,
    "top": 0
   },
   "partNumber": "TBDP-CG",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 2,
    "max": 2
   },
   "classification": {
    "productInformation": [
     {
      "productTable": "trifold-brochures",
      "id": 802,
      "title": "Trifold Brochures"
     }
    ]
   },
   "dimensions": {
    "heightDisplay": "8.5",
    "displayUnit": "in",
    "heightIn": 8.5,
    "widthDisplay": "11",
    "widthIn": 11
   },
   "name": "Trifold Brochure - Classic Gloss",
   "id": 7002,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 3,
    "isProStamp": false,
    "bandString": "",
    "greenInkAvailable": true,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 2,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 0,
     "bottom": 0,
     "right": 0,
     "top": 0
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  },
  {
   "maxLines": 0,
   "bleed": {
    "left": 0,
    "bottom": 0,
    "right": 0,
    "top": 0
   },
   "partNumber": "HB2436DS",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 1,
    "max": 2
   },
   "classification": {
    "productInformation": [
     {
      "productTable": "banners",
      "id": 803,
      "title": "Banners"
     }
    ]
   },
   "dimensions": {
    "heightDisplay": "36",
    "displayUnit": "in",
    "heightIn": 36,
    "widthDisplay": "24",
    "widthIn": 24
   },
   "name": "Banner 24x36 Double Sided",
   "id": 7003,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 3,
    "isProStamp": false,
    "bandString": "",
    "greenInkAvailable": true,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 2,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 0,
     "bottom": 0,
     "right": 0,
     "top": 0
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  },
  {
   "maxLines": 0,
   "bleed": {
    "left": 0,
    "bottom": 0,
    "right": 0,
    "top": 0
   },
   "partNumber": "MYSTERY-1",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 1,
    "max": 1
   },
   "classification": {
    "productInformation": []
   },
   "dimensions": {
    "heightDisplay": "4",
    "displayUnit": "in",
    "heightIn": 4,
    "widthDisplay": "6",
    "widthIn": 6
   },
   "name": "A part with no product group row",
   "id": 7005,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 3,
    "isProStamp": false,
    "bandString": "",
    "greenInkAvailable": true,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 2,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 0,
     "bottom": 0,
     "right": 0,
     "top": 0
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  },
  {
   "maxLines": 0,
   "bleed": {
    "left": 0,
    "bottom": 0,
    "right": 0,
    "top": 0
   },
   "partNumber": "NB13",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 1,
    "max": 1
   },
   "classification": {
    "productInformation": [
     {
      "productTable": "name-badges",
      "id": 804,
      "title": "Name Badges"
     }
    ]
   },
   "dimensions": {
    "heightDisplay": "1",
    "displayUnit": "in",
    "heightIn": 1,
    "widthDisplay": "3",
    "widthIn": 3
   },
   "name": "Name Badge 1x3",
   "id": 7004,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 1,
    "isProStamp": false,
    "bandString": "",
    "greenInkAvailable": true,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 2,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 0,
     "bottom": 0,
     "right": 0,
     "top": 0
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  },
  {
   "maxLines": 0,
   "bleed": {
    "left": 0,
    "bottom": 0,
    "right": 0,
    "top": 0
   },
   "partNumber": "DS21824",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 1,
    "max": 1
   },
   "classification": {
    "productInformation": []
   },
   "dimensions": {
    "heightDisplay": "18",
    "displayUnit": "in",
    "heightIn": 18,
    "widthDisplay": "24",
    "widthIn": 24
   },
   "name": "Light Gauge Plastic Sign 24x18",
   "id": 7010,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 3,
    "isProStamp": false,
    "bandString": "",
    "greenInkAvailable": true,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 2,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 0,
     "bottom": 0,
     "right": 0,
     "top": 0
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  },
  {
   "maxLines": 0,
   "bleed": {
    "left": 0,
    "bottom": 0,
    "right": 0,
    "top": 0
   },
   "partNumber": "DS-CONFLICT",
   "status": {
    "retired": false,
    "active": true
   },
   "pages": {
    "min": 1,
    "max": 1
   },
   "classification": {
    "productInformation": [
     {
      "id": 999,
      "productTable": "business-cards",
      "title": "Vibrant Colour Business Cards"
     }
    ]
   },
   "dimensions": {
    "heightDisplay": "12",
    "displayUnit": "in",
    "heightIn": 12,
    "widthDisplay": "18",
    "widthIn": 18
   },
   "name": "Premium Yard Sign",
   "id": 7011,
   "shape": "rect",
   "legacy": {
    "designerVariationCode": 3,
    "isProStamp": false,
    "bandString": "",
    "greenInkAvailable": true,
    "borders": {
     "left": 0,
     "bottom": 0,
     "width": 2,
     "right": 0,
     "top": 0
    },
    "daterBox": {
     "height": 0,
     "width": 0
    },
    "margins": {
     "left": 0,
     "bottom": 0,
     "right": 0,
     "top": 0
    }
   },
   "orientation": {
    "portraitAvailable": true,
    "landscapeAvailable": true
   }
  }
 ],
 "truncated": false,
 "count": 8,
 "source": "designCentral-dev (live, read-only)",
 "prioritised": [
  "BCDP-CM",
  "DS21218",
  "TBDP-CG",
  "HB2436DS"
 ],
 "datasource": "designCentral-dev",
 "refused": 0
};

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, extname } from 'node:path';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');

const REPO = process.argv[2] || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOLDER = '/git/generator-web03-dev-e2e-phase2c/';
const ENDPOINT = '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm';
const PORT = 8898;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === ENDPOINT) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(CATALOGUE));
    return;
  }
  if (url.pathname.indexOf(FOLDER) !== 0) { res.writeHead(404).end('no clone'); return; }
  const rel = normalize(url.pathname.slice(FOLDER.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(REPO, rel);
  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

console.log('\n1  the endpoint fixture is the real thing');
is(CATALOGUE.source === 'designCentral-dev (live, read-only)'
   && CATALOGUE.products.length >= 6, 'live-shape catalogue with the example products');
const byPart = Object.fromEntries(CATALOGUE.products.map((p) => [p.partNumber, p]));
is(['DS21218', 'DS21824', 'TBDP-CG', 'HB2436DS', 'NB13', 'BCDP-CM', 'MYSTERY-1']
     .every((k) => byPart[k]), 'sign, brochure, banner, name badge, card and an unclassified part');
is(CATALOGUE.products.every((p) => p.classification
     && Array.isArray(p.classification.productInformation)),
   'every product carries classification.productInformation');
is(CATALOGUE.products.every((p) => p.classification.productInformation.every((g) =>
     typeof g.id === 'number' && typeof g.productTable === 'string' && typeof g.title === 'string')),
   'each group row is the database row verbatim: id, productTable, title');
is(byPart['MYSTERY-1'].classification.productInformation.length === 0,
   'a part with no active group row reports an EMPTY classification, not a guess');
is(CATALOGUE.products.every((p) => !('productFamily' in p)),
   'and no productFamily is invented alongside it');

console.log('\n2  the picker maps the database words to a Template Type');
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1'] });
const ctx = await br.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
await page.goto(`http://web03.sterling.ca:${PORT}${FOLDER}generator/index.html`,
  { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SMPProductSelection
  && window.SMPProductSelection.catalogueSize() > 0, null, { timeout: 15000 });
is(await page.evaluate(() => window.SMPProductSelection.sourceId()) === 'sterling-designcentral-dev',
   'the picker is reading the live-endpoint shape');

const pickType = (part) => page.evaluate(async (part) => {
  await window.SMPProductSelection.selectByPartNumber(part);
  await new Promise((r) => setTimeout(r, 30));
  const sel = document.getElementById('templateType');
  return { value: sel.value, disabled: sel.disabled,
    w: document.getElementById('dimWidth').value, h: document.getElementById('dimHeight').value };
}, part);

const CASES = [
  ['BCDP-CM',  'Business Card'],
  ['DS21218',  'Sign'],
  ['DS21824',  'Sign'],          // the live failure: no group names a type; the NAME does
  ['DS-CONFLICT', 'Sign'],       // the part's own name beats a broader merchandising group
  ['TBDP-CG',  'Brochure'],
  ['HB2436DS', 'Banner'],
  ['NB13',     'Name Badge'],
];
for (const [part, want] of CASES) {
  const r = await pickType(part);
  is(r.value === want && r.disabled === true,
     `${part} -> ${want}`, `got "${r.value}"${r.disabled ? '' : ' (not locked)'}`);
}

console.log('\n3  an unclassified product is unknown, never Business Card');
/* Select a typed product first so a stale value would be visible. */
await pickType('BCDP-CM');
const myst = await pickType('MYSTERY-1');
is(myst.value === '', 'Template Type goes blank', `got "${myst.value || '(blank)'}"`);
is(myst.disabled === false, 'and stays editable so a person can say what it is');
const placeholder = await page.evaluate(() => {
  const sel = document.getElementById('templateType');
  const o = sel.options[sel.selectedIndex];
  return o ? o.textContent : null;
});
is(/select a product type/i.test(placeholder || ''), 'showing the "Select a product type…" placeholder',
   placeholder);

console.log('\n4  the Banner option is a real choice');
is(await page.evaluate(() =>
     [...document.getElementById('templateType').options].some((o) => o.value === 'Banner')),
   'the Template Type select now offers Banner');

console.log('\n5  clearing restores the manual form');
const cleared = await page.evaluate(async () => {
  window.SMPProductSelection.clear();
  await new Promise((r) => setTimeout(r, 30));
  const sel = document.getElementById('templateType');
  return { disabled: sel.disabled };
});
is(cleared.disabled === false, 'no product -> the select is editable again');
await ctx.close(); await br.close(); server.close();

console.log('\n6  the visual policy reads the real type, geometry only as fallback');
const ENGINE_SRC = readFileSync(REPO + '/generator/engine.js', 'utf8');
globalThis.window = {};
globalThis.fetch = async () => ({ ok: false, status: 404 });
let src = ENGINE_SRC.replace('window.handleGenerate = handleGenerate;',
  'globalThis.__p = { stockProductClass, isLargeFormatForAssets };');
src = src.replace('window.handleGenerateJson = handleGenerateJson;', '');
// eslint-disable-next-line no-eval
eval(src);
const P = globalThis.__p;
is(P.stockProductClass('Sign', 18, 12) === 'general'
   && P.stockProductClass('Banner', 72, 24) === 'general'
   && P.stockProductClass('Brochure', 11, 8.5) === 'brochure',
   'a real Sign, Banner and Brochure classify by NAME');
is(P.stockProductClass('Name Badge', 3, 1) === 'nameplate'
   && P.stockProductClass('Stamp', 2.25, 0.8) === 'stamp',
   'a real Name Badge and Stamp classify by NAME');
is(P.stockProductClass('Sign', 3, 2) === 'general',
   'an authoritative type wins even when the geometry is small');
is(P.stockProductClass('', 3.5, 2) === 'card',
   'unknown type + card-sized geometry falls back to the card policy');
is(P.stockProductClass('', 18, 12) === 'general',
   'unknown type + large geometry falls back to general');
is(P.stockProductClass('Business Card', 18, 12) === 'general',
   'and the one existing geometry override on named cards is intact');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
