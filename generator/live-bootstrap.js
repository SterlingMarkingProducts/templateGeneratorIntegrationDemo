/* ═══════════════════════════════════════════════════════════════════════════
   LIVE MODE wiring: the production CCA → Generator → Template Designer handoff.

   Active ONLY when the page was opened as ?product=<numeric id>&mode=live.
   On every other page — the dev clone, a standalone copy, file:// — this file
   does nothing at all, so existing behaviour is untouched.

   What it wires:
     · Push to Designer posts the EXISTING multipart import payload to the live
       importer. The manifest and asset parts are unchanged; only the
       destination and the CSRF header are new.
     · The CSRF nonce is fetched same-origin from templateImportToken.cfm
       immediately before the post. It is a per-session nonce, not a
       credential: it authorises nothing without the session cookie the browser
       already holds, and nothing server-side is exposed here.
     · The final redirect target is Jesse's site-independent Designer.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* One folder, three files: the token endpoint, the importer, and the
     Designer all live together, so a single base keeps them in step. */
  var DESIGNER_BASE = '/templateDesigner';
  var TOKEN_URL     = DESIGNER_BASE + '/templateImportToken.cfm';

  function liveMode() {
    return !!(window.SMPProductSelection
      && typeof window.SMPProductSelection.isLiveMode === 'function'
      && window.SMPProductSelection.isLiveMode());
  }

  /* The nonce for THIS session, fetched fresh for each push. Same-origin with
     credentials so the request carries the Designer application's session
     cookie — the token and the import must resolve to the same session. */
  function fetchCsrfToken() {
    return fetch(TOKEN_URL, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Could not obtain an import token from the Template Designer ('
            + res.status + ').');
        }
        return res.json();
      })
      .then(function (data) {
        var token = data && data.csrfToken;
        if (typeof token !== 'string' || !token.length) {
          throw new Error('The Template Designer returned no import token.');
        }
        return token;
      });
  }

  function configure() {
    var Import = window.SMPTransportImport;
    if (!Import || !Import.TemplateImportTransport || !window.SMPPush) { return false; }

    var transport = new Import.TemplateImportTransport({
      baseUrl: DESIGNER_BASE,          // transport appends /templateImport.cfm
      fetchImpl: function (url, init) {
        /* Token first, then the unchanged multipart POST carrying it. */
        return fetchCsrfToken().then(function (token) {
          init = init || {};
          var opts = {};
          for (var o in init) { if (init.hasOwnProperty(o)) { opts[o] = init[o]; } }
          var headers = {};
          var given = init.headers || {};
          for (var k in given) { if (given.hasOwnProperty(k)) { headers[k] = given[k]; } }
          headers['X-CSRF-Token'] = token;
          opts.headers = headers;
          opts.credentials = 'same-origin';   // same session as the token
          return fetch(url, opts);
        });
      }
    });

    window.SMPPush.setTransportMode('import', transport);

    /* Where a successful import hands off. push-to-designer.js builds
       ?template=<server id>&product=<selected product id> from this. */
    window.SMPDesignerTarget = {
      live: true,
      designerPage: DESIGNER_BASE + '/templateDesigner.cfm',
      importBase: DESIGNER_BASE,
      tokenUrl: TOKEN_URL
    };
    return true;
  }

  function start() {
    if (!liveMode()) { return; }
    if (configure()) { return; }
    /* product-select.js and the transport adapters load in their own order;
       retry briefly rather than depending on script position. */
    var tries = 0;
    var timer = setInterval(function () {
      if (configure() || ++tries > 40) { clearInterval(timer); }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
