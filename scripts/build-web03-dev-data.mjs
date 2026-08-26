#!/usr/bin/env node
/* Generates generator/web03-dev-data.js from the committed catalogue and demo
 * files, so the web03 dev clone can still supply them when the server does not
 * serve ../data/*.json over HTTP.
 *
 *   node scripts/build-web03-dev-data.mjs           write the file
 *   node scripts/build-web03-dev-data.mjs --check   fail if it has drifted
 *
 * The embedded copies are byte-for-byte the parsed contents of the real files.
 * Nothing here is authored by hand, and --check runs in the test suite so the
 * two can never disagree.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* Only what the web03 dev walkthrough needs: the CMS-verified record for
 * BCDP-CM / 6505, and the demo designs. The 800 KB spreadsheet-inferred TEST
 * inventory is deliberately NOT embedded — it is not needed to select BCDP-CM
 * and would duplicate a large file into the repository. */
const FILES = ['sterling-products.json', 'test-templates.json'];

const payload = {};
for (const name of FILES) {
  payload[name] = JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8'));
}

const body = `/* GENERATED FILE — do not edit.
 *
 * Written by scripts/build-web03-dev-data.mjs from data/${FILES.join(' and data/')}.
 * Run \`node scripts/build-web03-dev-data.mjs\` after changing either of those.
 *
 * Loaded ONLY by web03-dev-bootstrap.js, and only when the Generator is served
 * from the /generator-web03-dev-e2e/ clone folder. It is a fallback: the real
 * ../data/*.json files are still fetched first and win whenever the server
 * serves them.
 */
window.SMPWeb03DevData = ${JSON.stringify(payload, null, 0)};
`;

const OUT = join(ROOT, 'generator', 'web03-dev-data.js');
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8'); } catch { /* missing */ }
  if (current !== body) {
    console.error('web03-dev-data.js is out of date — run '
      + 'node scripts/build-web03-dev-data.mjs');
    process.exit(1);
  }
  console.log('web03-dev-data.js matches data/' + FILES.join(' + data/'));
} else {
  writeFileSync(OUT, body);
  console.log('wrote generator/web03-dev-data.js (' + body.length + ' bytes)');
}
