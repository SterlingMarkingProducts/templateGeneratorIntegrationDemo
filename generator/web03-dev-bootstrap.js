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
    designerPage: '/git/web03-dev-e2e/tests/web03-dev-e2e/templateDesignerDev.cfm',
    /* The published dev-only test token from web03DevSecurity.cfc. Not a
     * secret: it exists so the real endpoint's CSRF check is exercised rather
     * than bypassed, and it grants nothing anywhere else. */
    csrfToken:    'web03-dev-e2e-token'
  };

  var path = (window.location && window.location.pathname) || '';
  if (path.indexOf(CLONE_FOLDER) === -1) { return; }   // not the dev clone — do nothing

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
      importBase: DEV.importBase
    };
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configure);
  } else {
    configure();
  }
})();
