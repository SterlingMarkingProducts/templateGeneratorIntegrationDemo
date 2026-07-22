/* Mock ColdFusion backend for the static test copy of the Sterling designer.
 *
 * The real designer front-end (SMPdesigner.js) talks to a handful of .cfm
 * endpoints. This shim, loaded after jQuery and BEFORE SMPdesigner.js,
 * intercepts those calls and answers them with embedded TEST fixtures, so the
 * genuine designer UI runs with no ColdFusion server, no database, and no
 * connection to any Sterling system.
 *
 * Captured fixture data: product 6505 (BCDP-CM full-colour business card,
 * 3.5" x 2") and its blank template #32910 — structure identical to the live
 * getStampInfo.cfm / getTemplateJson.cfm responses.
 */
(function () {
  'use strict';

  /* Stubs for scripts intentionally not loaded in the test copy */
  window.Modernizr = window.Modernizr || { canvas: true };
  if (!window.JL) {
    var noop = function () {};
    var logger = { fatalException: noop, fatal: noop, error: noop, warn: noop, info: noop, debug: noop };
    window.JL = function () { return logger; };
    window.JL.setOptions = noop;
    window.JL.createAjaxAppender = function () { return { setOptions: noop }; };
    window.JL.createConsoleAppender = function () { return { setOptions: noop }; };
  }

  var FIXTURE_STAMPINFO = window.__FIXTURE_STAMPINFO__;
  var FIXTURE_TEMPLATE = window.__FIXTURE_TEMPLATE__;
  var TRANSFER_KEY = 'smpDesignTransfer';

  function transferDesign(code) {
    try {
      var raw = window.localStorage.getItem(TRANSFER_KEY + ':' + code);
      if (!raw) return null;
      var rec = JSON.parse(raw);
      if (rec.expires && rec.expires < Date.now()) return null;
      return rec.design;
    } catch (e) { return null; }
  }

  function blockedMessage(endpoint) {
    if (window.toastr) {
      toastr.info('"' + endpoint + '" is disabled in this hosted test copy — no Sterling server is connected.');
    }
  }

  function routeMock(url) {
    // returns undefined when the URL should NOT be mocked
    var path = String(url).split('?')[0].toLowerCase();
    var query = String(url).indexOf('?') >= 0 ? String(url).split('?')[1] : '';
    if (path.indexOf('getstampinfo.cfm') >= 0) {
      return { data: JSON.parse(JSON.stringify(FIXTURE_STAMPINFO)) };
    }
    if (path.indexOf('gettemplatejson.cfm') >= 0) {
      return { data: JSON.parse(JSON.stringify(FIXTURE_TEMPLATE)) };
    }
    if (path.indexOf('getdesignjson.cfm') >= 0) {
      var m = /designcode=([^&]+)/i.exec(query);
      var design = m && transferDesign(decodeURIComponent(m[1]));
      if (design) return { data: design };
      return { fail: 'design not found in this test copy' };
    }
    if (/designersubmit|designerimageupload|getproof|getsvg|getqr|getimage/.test(path)) {
      blockedMessage(path.replace(/^.*\//, ''));
      return { fail: 'endpoint disabled in test copy' };
    }
    return undefined;
  }

  var realAjax = window.jQuery.ajax;
  window.jQuery.ajax = function (url, settings) {
    var opts = typeof url === 'string' ? (settings || {}) : (url || {});
    var target = typeof url === 'string' ? url : opts.url;
    var mock = target && routeMock(target);
    if (mock === undefined) {
      return realAjax.apply(this, arguments);
    }
    var d = window.jQuery.Deferred();
    setTimeout(function () {
      if (mock.fail) {
        d.reject({ status: 501, statusText: mock.fail }, 'error', mock.fail);
      } else {
        if (opts.success) opts.success(mock.data, 'success', d);
        d.resolve(mock.data, 'success', d);
      }
    }, 0);
    var promise = d.promise();
    promise.done = d.done; promise.fail = d.fail; promise.always = d.always;
    return promise;
  };
})();
