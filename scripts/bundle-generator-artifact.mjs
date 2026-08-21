/* Bundle the ACTUAL Generator into one self-contained page for an Artifact.
 *
 * This is not a mock or a re-creation: it inlines the real generator/index.html
 * with its real CSS and its real scripts, byte for byte, and serves the three
 * catalogue/sample JSON files from embedded copies because an Artifact page has
 * no origin to fetch them from. The only thing added is a slim control strip
 * that DRIVES the real UI through its own public APIs so the reviewer can step
 * through the states without typing.
 *
 *   node scripts/bundle-generator-artifact.mjs [outfile]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const GEN = path.join(ROOT, 'generator');
const out = process.argv[2] || path.join(ROOT, 'scripts', '__reports__', 'generator-artifact.html');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* Anything inlined into a <script> block must not carry a literal </script>
 * (several sample designs and app.js do). Escaping the slash is invisible to
 * the JS/JSON parser but stops the HTML parser closing the block early. */
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\u0021--');
const source = read('generator/index.html');
const headMatch = source.match(/<head>([\s\S]*?)<\/head>/i);
const bodyMatch = source.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!headMatch || !bodyMatch) throw new Error('could not split index.html');
/* Split BEFORE inlining: several inlined files contain literal </body> and
 * </script> strings, which would truncate the page if matched afterwards. */
let head = headMatch[1];
let body = bodyMatch[1];

/* ── 1. inline the stylesheet ─────────────────────────────────────── */
head = head.replace(
  /<link rel="stylesheet" href="style\.css"[^>]*>/,
  `<style>\n${read('generator/style.css')}\n</style>`,
);

/* ── 2. inline every script, in the page's own order ──────────────── */
const scriptRe = /<script src="([^"]+)"><\/script>/g;
const inlined = [];
const inlineScripts = (chunk) => chunk.replace(scriptRe, (_m, src) => {
  const rel = src.split('?')[0];
  const file = rel.startsWith('../')
    ? rel.replace(/^\.\.\//, '')
    : path.posix.join('generator', rel);
  const code = safe(read(file));
  inlined.push(file);
  return `<script data-src="${rel}">\n${code}\n</script>`;
});
head = inlineScripts(head);
body = inlineScripts(body);

/* ── 3. embed the data the page fetches, and serve it from memory ─── */
const DATA = {
  '../data/test-templates.json': read('data/test-templates.json'),
  '../data/sterling-products.json': read('data/sterling-products.json'),
  '../data/sterling-test-catalogue.json': read('data/sterling-test-catalogue.json'),
};
const shim = `<script>
/* Artifact packaging only: an Artifact page has no origin to fetch the
 * catalogue and sample files from, so they are embedded verbatim and returned
 * by a fetch shim. Nothing else about the Generator is altered. Installed
 * BEFORE demo-guard.js, so the guard still wraps and polices every request. */
(function () {
  var FILES = ${safe(JSON.stringify(DATA))};
  var real = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = (input && input.url) || String(input);
    var key = url.split('?')[0];
    for (var k in FILES) {
      if (key === k || key.endsWith(k.replace('../', '/')) || key.endsWith(k.replace('../', ''))) {
        return Promise.resolve(new Response(FILES[k], {
          status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
    }
    if (!real) return Promise.reject(new Error('fetch unavailable in this preview'));
    return real(input, init);
  };
})();
</script>`;

/* ── 4. the control strip: drives the REAL UI through its own APIs ── */
const strip = `<style>
  /* The page below is the Generator itself, unaltered — it owns its own visual
     identity. This strip is the only authored surface: a quiet instrument panel
     that stays subordinate to the application. It commits to one dark treatment
     (it reads as chrome, not as a document), so it paints every colour
     explicitly and never inherits the host ground. */
  :root {
    --pv-ink:   #0e1114;
    --pv-panel: #171c21;
    --pv-edge:  #2a323b;
    --pv-text:  #e6ecf2;
    --pv-mute:  #8d9aa8;
    --pv-live:  #f9a03f;   /* Sterling's demo-banner orange, used once */
    --pv-ground:#eef1f4;
  }
  body { background: var(--pv-ground); }
  #pvBar {
    position: sticky; top: 0; z-index: 9999;
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    padding: 10px 16px;
    background: var(--pv-ink); color: var(--pv-text);
    border-bottom: 1px solid var(--pv-edge);
    font: 500 12px/1.35 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  #pvBar .pvLabel {
    font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
    color: var(--pv-mute); margin-right: 4px;
  }
  #pvBar button {
    padding: 6px 11px; border: 1px solid var(--pv-edge); border-radius: 6px;
    background: var(--pv-panel); color: var(--pv-text);
    font: 600 12px/1 inherit; cursor: pointer;
    transition: background .12s ease, border-color .12s ease;
  }
  #pvBar button:hover { background: #212932; border-color: #3d4854; }
  #pvBar button:focus-visible { outline: 2px solid var(--pv-live); outline-offset: 2px; }
  #pvStatus { color: var(--pv-live); font-weight: 600; }
  #pvBar .pvNote {
    margin-left: auto; max-width: 44ch;
    color: var(--pv-mute); font-weight: 400; font-size: 11px; line-height: 1.45;
  }
  @media (prefers-reduced-motion: reduce) {
    #pvBar button { transition: none; }
  }
  /* The Generator's shell is height:100vh. The strip above it would push the
     bottom of the preview panel off-screen, so hand the shell the height that
     is actually left. Packaging only — the app's own CSS is untouched. */
  .app-layout { box-sizing: border-box !important;
                height: calc(100vh - var(--pv-bar, 0px)) !important; }
</style>
<div id="pvBar">
  <span class="pvLabel">Preview steps</span>
  <button data-step="A">A · Initial</button>
  <button data-step="B">B · Select BCDP-CM</button>
  <button data-step="C">C · Select DP1218 (12×18)</button>
  <button data-step="D">D · Click Axiom demo</button>
  <button data-step="E">E · Shortcut list</button>
  <span id="pvStatus" role="status" aria-live="polite"></span>
  <span class="pvNote">Drives the real Generator below through its own public APIs.
    DP1216 is not in the test catalogue, so C uses the real DP1218 (12&nbsp;×&nbsp;18).</span>
</div>
<script>
(function () {
  var st = function (m) { document.getElementById('pvStatus').textContent = m; };
  function ready() {
    return window.SMPProductSelection && window.SMPDemoSamples
      && window.SMPProductSelection.catalogueSize() > 0
      && window.SMPDemoSamples.all().length > 0;
  }
  function whenReady(fn) {
    if (ready()) return fn();
    var n = 0;
    var t = setInterval(function () {
      if (ready()) { clearInterval(t); fn(); }
      else if (++n > 200) { clearInterval(t); st('catalogue did not load'); }
    }, 100);
  }
  var STEPS = {
    A: function () {
      window.SMPProductSelection.clear();
      var r = document.getElementById('resetBtn');
      if (r) r.click();
      st('A — no product selected, standalone empty state');
    },
    B: function () {
      window.SMPProductSelection.selectByPartNumber('BCDP-CM').then(function (p) {
        st('B — ' + p.partNumber + ' · ' + p.dimensions.widthIn + '×' + p.dimensions.heightIn
           + 'in · ' + p.pages.min + ' blank pages');
      });
    },
    C: function () {
      window.SMPProductSelection.selectByPartNumber('DP1218').then(function (p) {
        st('C — ' + p.partNumber + ' · ' + p.dimensions.widthIn + '×' + p.dimensions.heightIn
           + 'in · ' + p.pages.min + ' blank page');
      });
    },
    D: function () {
      var b = [].slice.call(document.querySelectorAll('button')).filter(function (x) {
        return x.textContent.trim().indexOf('Load sample: Axiom') === 0; })[0];
      if (!b) return st('Axiom shortcut not found');
      b.click();
      setTimeout(function () {
        var p = window.SMPProductSelection.get();
        st('D — Axiom loaded; product auto-selected: ' + (p ? p.partNumber + ' / id ' + p.id : 'none'));
      }, 1200);
    },
    E: function () {
      var names = window.SMPDemoSamples.list().map(function (s) { return s.name; });
      st('E — ' + names.length + ' shortcuts: ' + names.join(' · '));
      var el = document.querySelector('#generateBtn');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    },
  };
  document.getElementById('pvBar').addEventListener('click', function (e) {
    var s = e.target && e.target.getAttribute && e.target.getAttribute('data-step');
    if (s && STEPS[s]) whenReady(STEPS[s]);
  });
  function sizeBar() {
    var h = document.getElementById('pvBar').getBoundingClientRect().height;
    document.documentElement.style.setProperty('--pv-bar', Math.ceil(h) + 'px');
    if (window.SMPBlankArtboard) window.SMPBlankArtboard.relayout();
  }
  window.addEventListener('resize', sizeBar);
  sizeBar();
  setTimeout(sizeBar, 300);
  whenReady(function () { st('ready — ' + window.SMPProductSelection.catalogueSize()
    + ' products, ' + window.SMPDemoSamples.list().length + ' demo shortcuts'); });
})();
</script>`;

/* ── 5. assemble: the Artifact supplies doctype/html/head/body ─────── */
head = head
  .replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<link rel="icon"[^>]*>/ig, '');

const page = `<title>Sterling Design Template Generator</title>
${head}
${strip}
${shim}
${body}
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`wrote ${out}  (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`inlined ${inlined.length} scripts:\n  ${inlined.join('\n  ')}`);
