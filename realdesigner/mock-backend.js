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

  /* When the page is opened with ?transfer=<id>, the pushed design defines the
   * product: its dimensions, bleed, margins, and page count are synthesized
   * into the stampinfo/template responses so the designer boots at the pushed
   * design's size — business card, sign, poster, any size — instead of being
   * pinned to the single captured fixture product. */
  function urlTransferDesign() {
    var m = /[?&]transfer=([^&]*)/.exec(window.location.search);
    return m ? transferDesign(decodeURIComponent(m[1])) : null;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function synthesizeStampInfo(design) {
    var cp = design.canvasProperties;
    var dpi = cp.dpi || 96;
    var scale = 96 / dpi; // stampinfo values are px @ 96dpi
    var w = Math.round(cp.width * scale), h = Math.round(cp.height * scale);
    var info = JSON.parse(JSON.stringify(FIXTURE_STAMPINFO));
    info.CANVASWIDTH = w;
    info.CANVASHEIGHT = h;
    info.WIDTH = String(round2(w / 96));
    info.HEIGHT = String(round2(h / 96));
    info.WIDTHDISPLAY = info.WIDTH + '"';
    info.HEIGHTDISPLAY = info.HEIGHT + '"';
    info.SHAPE = cp.shape || 'rect';
    var KEY_MAP = {
      BLEEDTOP: 'bleedTop', BLEEDRIGHT: 'bleedRight', BLEEDBOTTOM: 'bleedBottom', BLEEDLEFT: 'bleedLeft',
      MARGINTOP: 'marginTop', MARGINRIGHT: 'marginRight', MARGINBOTTOM: 'marginBottom', MARGINLEFT: 'marginLeft',
      BORDERTOP: 'borderTop', BORDERRIGHT: 'borderRight', BORDERBOTTOM: 'borderBottom', BORDERLEFT: 'borderLeft',
      BORDERWIDTH: 'borderWidth', DATERBOXHEIGHT: 'daterBoxHeight', DATERBOXWIDTH: 'daterBoxWidth',
    };
    Object.keys(KEY_MAP).forEach(function (K) {
      if (typeof cp[KEY_MAP[K]] === 'number') info[K] = Math.round(cp[KEY_MAP[K]] * scale);
    });
    info.TOPMARGIN = info.MARGINTOP; info.SIDEMARGIN = info.MARGINLEFT;
    info.TOPBORDER = info.BORDERTOP; info.SIDEBORDER = info.BORDERLEFT;
    info.MAXLINES = cp.maxLines || 0;
    info.GREENINKAVAILABLE = !!cp.greenInkAvailable;
    info.MINPAGES = Math.max(1, (design.pages || []).length);
    info.MAXPAGES = Math.max(info.MINPAGES, info.MAXPAGES || 1);
    info.PARTNUMBER = 'TG-PUSHED';
    info.DESCRIPTION = 'Pushed design (' + info.WIDTH + '" x ' + info.HEIGHT + '") - hosted test copy';
    info.DESCRIPTIONFR = info.DESCRIPTION;
    info.LOWESTPRICE = 'n/a (test)';
    info.VARIATIONS = [];
    return info;
  }

  function synthesizeBlankTemplate(design) {
    var t = JSON.parse(JSON.stringify(design));
    (t.pages || []).forEach(function (p) {
      if (p.canvasData) p.canvasData.objects = [];
    });
    return t;
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
    var pushed = urlTransferDesign();
    if (path.indexOf('getstampinfo.cfm') >= 0) {
      return { data: pushed ? synthesizeStampInfo(pushed) : JSON.parse(JSON.stringify(FIXTURE_STAMPINFO)) };
    }
    if (path.indexOf('gettemplatejson.cfm') >= 0) {
      return { data: pushed ? synthesizeBlankTemplate(pushed) : JSON.parse(JSON.stringify(FIXTURE_TEMPLATE)) };
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
