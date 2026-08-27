/* ── web03 DEV E2E bootstrap ───────────────────────────────────────────────
 *
 * Points the Generator's EXISTING import transport at the verified web03 dev
 * endpoint, and nothing else. No UI change, no second Generator, no fork: the
 * normalisation, extraction and push code paths are exactly the ones every
 * other mode uses.
 *
 * ACTIVE ONLY when this Generator is being served from the web03 dev clone
 * folder. On GitHub Pages, on a laptop, or from any other path this file
 * returns immediately and the default 'local' transport is untouched.
 *
 * The three values below are CONSTANTS in this file. Nothing is read from the
 * URL, the query string or any other client input, so a crafted link cannot
 * point this page at production, at another datasource, or at another asset
 * root. Those rules are the server's to enforce and it still does: the request
 * goes to the real templateImport.cfm, which keeps its internal-IP gate, its
 * security provider and its CSRF check.
 */
(function () {
  'use strict';

  /* The cfGitPuller folder this build is deployed into. */
  var CLONE_FOLDER = '/generator-web03-dev-e2e/';

  var DEV = {
    /* TemplateImportTransport appends /templateImport.cfm to this. */
    importBase:   '/git/web03-dev-e2e/tests/web03-dev-e2e',
    /* The FULL-UI dev clone: it runs the real templateDesigner.cfm and shows its
     * real toolbar, menus and controls. Not the earlier canvas-only harness. */
    designerPage: '/git/web03-dev-e2e/tests/web03-dev-e2e/templateDesignerFullDev.cfm',
    /* The published dev-only test token from web03DevSecurity.cfc. Not a
     * secret: it exists so the real endpoint's CSRF check is exercised rather
     * than bypassed, and it grants nothing anywhere else. */
    csrfToken:    'web03-dev-e2e-token'
  };

  var path = (window.location && window.location.pathname) || '';
  if (path.indexOf(CLONE_FOLDER) === -1) { return; }   // not the dev clone — do nothing

  /* ── data/*.json over HTTP ───────────────────────────────────────────────
   *
   * product-select.js and demo-samples.js each fetch a file from ../data/.
   * On web03 those three requests fail, and both features fail silently as a
   * result: the picker reports "Product catalogue unavailable", and the demo
   * shortcuts — Axiom included — are never built at all, because demo-samples.js
   * builds them inside the fetch's .then.
   *
   * The files are present in the clone (they are committed, plain, and not LFS
   * pointers), so this is the server declining to serve them, not the build.
   * Rather than guess at web03's IIS static-file configuration from here, the
   * dev clone stops depending on it: the real fetch is still tried FIRST and
   * still wins whenever it works, and only a failed or non-JSON response falls
   * back to the copy in web03-dev-data.js.
   *
   * Only ../data/<name>.json requests for files we actually embed are touched.
   * Every other request — the import POST included — goes straight through. */
  var DATA_RE = /(?:^|\/)data\/([A-Za-z0-9._-]+\.json)(?:\?|$)/;
  var dataFallback = [];   // {file, reason} for anything that had to fall back

  function embeddedFor(url) {
    var store = window.SMPWeb03DevData;
    if (!store) { return null; }
    var m = DATA_RE.exec(String(url));
    return (m && Object.prototype.hasOwnProperty.call(store, m[1]))
      ? { name: m[1], body: store[m[1]] } : null;
  }

  function embeddedResponse(hit, reason) {
    dataFallback.push({ file: hit.name, reason: reason });
    renderFallbackNote();
    return new Response(JSON.stringify(hit.body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  /* Say plainly, in the picker's OWN status line — the same element that would
   * otherwise read "Product catalogue unavailable" — that the catalogue came
   * from this clone, so a shorter product list reads as expected rather than
   * as a failure. Deferred, because the fetches resolve after DOMContentLoaded
   * and the element does not exist while this file first runs. */
  function renderFallbackNote() {
    var draw = function () {
      var status = document.getElementById('productStatus');
      if (!status || !dataFallback.length) { return; }
      status.textContent = 'Dev clone: web03 did not serve '
        + dataFallback.map(function (f) { return f.file + ' (' + f.reason + ')'; }).join(', ')
        + ' \u2014 using this clone\u2019s embedded copy. BCDP-CM is available.';
      status.classList.remove('hidden');
      status.classList.remove('is-error');
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(draw, 0); });
    } else {
      setTimeout(draw, 0);
    }
  }

  function installDataFallback() {
    if (typeof window.fetch !== 'function' || typeof Response !== 'function') { return; }
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var hit = embeddedFor(url);
      if (!hit) { return nativeFetch(input, init); }
      return nativeFetch(input, init).then(function (res) {
        if (!res || !res.ok) {
          return embeddedResponse(hit, 'HTTP ' + (res ? res.status : 'no response'));
        }
        /* A server can answer 200 with an error page. Only trust it if it
         * really parses as JSON; the clone leaves the original readable. */
        return res.clone().json().then(
          function () { return res; },
          function () { return embeddedResponse(hit, 'response was not JSON'); }
        );
      }, function (e) {
        return embeddedResponse(hit, (e && e.message) || 'request failed');
      });
    };
  }

  /* This script runs before product-select.js and demo-samples.js, so the
   * fallback data has to be in place before either of them fetches. A
   * parser-inserted document.write is the one way to load it synchronously at
   * this point — and it keeps the public build from downloading it at all. */
  function loadFallbackData() {
    if (window.SMPWeb03DevData || document.readyState !== 'loading') { return; }
    document.write('<scr' + 'ipt src="web03-dev-data.js?v=w03d1"></scr' + 'ipt>');
  }

  /* There is deliberately NO key file to load any more. A key committed to
   * web03-dev-api-key.js was reported by GitHub's secret scanning and revoked by
   * Anthropic within minutes — twice. The DEV key now lives in this browser's
   * localStorage under SMP_WEB03_DEV_ANTHROPIC_API_KEY and browser-api.js reads
   * it there, so there is nothing in the repository to scan. */

  function configure() {
    var Import = window.SMPTransportImport;
    if (!Import || !Import.TemplateImportTransport || !window.SMPPush) { return false; }

    var transport = new Import.TemplateImportTransport({
      baseUrl: DEV.importBase,
      fetchImpl: function (url, init) {
        init = init || {};
        var headers = {};
        var given = init.headers || {};
        for (var k in given) { if (given.hasOwnProperty(k)) { headers[k] = given[k]; } }
        headers['X-CSRF-Token'] = DEV.csrfToken;
        var opts = {};
        for (var o in init) { if (init.hasOwnProperty(o)) { opts[o] = init[o]; } }
        opts.headers = headers;
        opts.credentials = 'same-origin';   // same host as the Generator
        return fetch(url, opts);
      }
    });

    window.SMPPush.setTransportMode('import', transport);

    /* Read by push-to-designer.js to build the hand-off URL from the numeric
     * templateId the endpoint returns. */
    window.SMPWeb03Dev = {
      active: true,
      designerPage: DEV.designerPage,
      importBase: DEV.importBase,
      /* Where browser-api.js sends Anthropic requests on this clone. Published
       * for diagnostics only — browser-api.js holds its own constant, and the
       * demo guard a third, so all three have to agree. */
      aiProxy: '/git/web03-dev-e2e/tests/web03-dev-e2e/aiProxy.cfm',
      /* Empty when the server served ../data/*.json itself; otherwise one
       * entry per file that fell back, with the real reason it did. */
      dataFallback: dataFallback
    };
    return true;
  }

  installDataFallback();
  loadFallbackData();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configure);
  } else {
    configure();
  }
})();
