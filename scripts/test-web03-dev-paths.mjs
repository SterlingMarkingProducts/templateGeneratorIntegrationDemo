/* web03 dev PATH GATING only.
   The same build served from three folders: the approved dev clone, the new
   Phase 1 dev clone beside it, and a plain clone. The first two must get
   identical dev behaviour; the third must get none of it. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/user/oldDesigner/tests/phase4c/node_modules/playwright-core/index.js');
const HOST = 'http://web03.sterling.ca:8888';
const APPROVED = `${HOST}/git/generator-web03-dev-e2e/generator/index.html`;
const PHASE1   = `${HOST}/git/generator-web03-dev-e2e-phase1/generator/index.html`;
const PLAIN    = 'http://127.0.0.1:8888/git/generator-plain/generator/index.html';
const PROXY    = '/git/web03-dev-e2e/tests/web03-dev-e2e/aiProxy.cfm';
const STATUS   = '/git/web03-dev-e2e/tests/web03-dev-e2e/aiKeyStatus.cfm';
const CATALOGUE= '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm';

let pass = 0, fail = 0;
const is = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--host-resolver-rules=MAP web03.sterling.ca 127.0.0.1, MAP www.sterling.ca 127.0.0.1'] });

async function inspect(url, seedKey) {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 950 } });
  if (seedKey) {
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} },
      ['SMP_WEB03_DEV_ANTHROPIC_API_KEY', 'skXantXpathXfixtureXplaceholder0000000000']);
  }
  const page = await ctx.newPage();
  const hits = [];
  page.on('request', (r) => {
    if (r.url().includes('devProductCatalogue.cfm')) hits.push('CATALOGUE');
    if (r.url().includes('aiKeyStatus.cfm')) hits.push('STATUS');
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.SMPPush && window.anthropic, { timeout: 25000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
  const state = await page.evaluate(async (paths) => {
    const reach = async (u) => {
      try { const r = await fetch(u); return r.status; } catch (e) { return 'blocked'; }
    };
    const sel = window.SMPProductSelection;
    return {
      devActive: !!(window.SMPWeb03Dev && window.SMPWeb03Dev.active),
      designerPage: (window.SMPWeb03Dev || {}).designerPage || null,
      importBase: (window.SMPWeb03Dev || {}).importBase || null,
      transport: window.SMPPush && window.SMPPush.transportMode ? window.SMPPush.transportMode() : null,
      devKeyModule: !!window.SMPDevKey,
      importableOnly: sel && sel.importableOnly ? sel.importableOnly() : null,
      sourceId: sel && sel.sourceId ? sel.sourceId() : null,
      catalogueSize: sel && sel.catalogueSize ? sel.catalogueSize() : null,
      selected: sel && sel.get() ? { id: sel.get().id, part: sel.get().partNumber } : null,
      statusReach: await reach(paths.STATUS),
      catalogueReach: await reach(paths.CATALOGUE),
    };
  }, { STATUS, CATALOGUE });
  state.hits = hits;
  await ctx.close();
  return state;
}

console.log('\nA  the APPROVED dev clone — the behaviour to match');
const a = await inspect(APPROVED, true);
console.log('     ', JSON.stringify(a));
is(a.devActive === true, 'dev bootstrap active');
is(a.transport === 'import', 'Push to Designer uses the real import transport');
is(a.devKeyModule === true, 'dev API key module loaded');
is(a.importableOnly === true && a.sourceId === 'sterling-designcentral-dev',
   'live designCentral-dev picker');
is(a.selected && String(a.selected.id) === '6505', 'BCDP-CM / 6505 default', a.selected && a.selected.part);
is(a.statusReach === 200 && a.catalogueReach === 200, 'guard allows the dev endpoints');

console.log('\nB  the PHASE 1 clone — same folder rules, new folder name');
const p = await inspect(PHASE1, true);
console.log('     ', JSON.stringify(p));
is(p.devActive === true, 'dev bootstrap active');
is(p.designerPage === a.designerPage && p.importBase === a.importBase,
   'same Template Designer hand-off and import endpoint', p.designerPage);
is(p.transport === 'import', 'Push to Designer uses the real import transport');
is(p.devKeyModule === true, 'dev API key dialog module loaded');
is(p.importableOnly === true && p.sourceId === 'sterling-designcentral-dev',
   'live designCentral-dev picker', p.sourceId);
is(p.catalogueSize === a.catalogueSize, 'same live catalogue', String(p.catalogueSize));
is(p.selected && String(p.selected.id) === '6505', 'BCDP-CM / 6505 default', p.selected && p.selected.part);
is(p.statusReach === 200 && p.catalogueReach === 200,
   'the demo guard allows the dev endpoints from the new folder',
   'status ' + p.statusReach + ', catalogue ' + p.catalogueReach);
is(p.hits.includes('CATALOGUE'), 'it really fetched the live catalogue');

console.log('\nC  a plain clone gets none of it');
const c = await inspect(PLAIN, false);
console.log('     ', JSON.stringify({ devActive: c.devActive, devKeyModule: c.devKeyModule,
  importableOnly: c.importableOnly, sourceId: c.sourceId, transport: c.transport }));
is(c.devActive === false, 'no dev bootstrap');
is(c.devKeyModule === false, 'no dev key dialog');
is(c.importableOnly === false && c.sourceId === 'sterling-catalogue-local',
   'still the committed catalogue files', c.sourceId);
is(c.transport === 'local', 'still the local transport');

console.log('\nD  the folder names cannot bleed into each other');
const bleed = await (async () => {
  const ctx = await br.newContext();
  const page = await ctx.newPage();
  await page.goto(APPROVED, { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(() => ({
    approvedMatchesPhase1: '/git/generator-web03-dev-e2e/generator/index.html'
      .indexOf('/generator-web03-dev-e2e-phase1/') !== -1,
    phase1MatchesApproved: '/git/generator-web03-dev-e2e-phase1/generator/index.html'
      .indexOf('/generator-web03-dev-e2e/') !== -1,
  }));
  await ctx.close();
  return r;
})();
is(bleed.approvedMatchesPhase1 === false && bleed.phase1MatchesApproved === false,
   'each folder constant matches only its own folder (trailing slash)');

await br.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
