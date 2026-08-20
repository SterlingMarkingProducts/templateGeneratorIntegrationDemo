/* ============================================================ *
 *  M O C K   —   N O T   S T E R L I N G                       *
 * ============================================================ *
 *
 * A deterministic stand-in for templateImport.cfm, which DOES NOT EXIST YET.
 * It reaches no network, touches no database, and every id it returns is
 * synthetic and prefixed so it can never be mistaken for a Sterling id.
 *
 * It exists to prove the CLIENT half of the pipeline end to end, and to be
 * the executable statement of what the server must do. It simulates only the
 * parts that shape the client contract:
 *
 *   - deduplicate assets by sha256 and mint an imageKey per unique binary
 *   - rewrite each image object: importAssetRef -> imageKey + getImage.cfm src
 *   - refuse a page whose canvasJson exceeds the TEXT limit
 *   - return the draft's openUrl
 *
 * It deliberately does NOT simulate: authentication, CSRF, IP restriction,
 * MIME sniffing, product validation against designCentral, asset storage on
 * disk, or the database transaction. Those are the real server's job and are
 * listed in docs/template-import-contract.md. Nothing here should be read as
 * evidence that any of them work.
 */
(function (root) {
  'use strict';

  var MOCK_TEMPLATE_ID_BASE = 900000;   // real templates.id is ~35,042 — this is obviously not one
  var MOCK_TEMPLATE_KEY_BASE = 990000;
  var MAX_PAGE_JSON_BYTES = 60000;

  /* Deterministic UUID-shaped key derived from the asset hash, so the same
   * bitmap always yields the same mock key and tests are reproducible.
   * The real server calls createUUID(); this only has to LOOK like a UUID
   * because getImage.cfm validates with isValid("UUID", key). */
  function mockImageKey(sha256) {
    var h = sha256.replace(/[^0-9a-f]/g, '').padEnd(32, '0').slice(0, 32).toUpperCase();
    return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-');
  }

  function modeFor(designerMode) {
    if (designerMode === 'Grayscale') return { mode: 'GS', ver: 'gray' };
    if (designerMode === 'SingleColour') return { mode: 'BW', ver: 'gray' };
    return { mode: 'FC', ver: 'scale' };
  }

  function jsonResponse(status, body) {
    return {
      status: status,
      ok: status >= 200 && status < 300,
      json: function () { return Promise.resolve(body); },
    };
  }

  function fail(status, code, message, detail) {
    return jsonResponse(status, { error: { code: code, message: message, detail: detail || null } });
  }

  /**
   * Build a fetch-compatible mock.
   *
   * @param {object} opts
   *   product        the CMS-verified product the server would look up
   *   forceStatus    simulate an error: 400|409|413|422|500
   *   forceNetwork   true -> the returned fetch rejects, as a dead host would
   *   counterStart   deterministic id offset
   */
  function createMockImportEndpoint(opts) {
    opts = opts || {};
    var calls = 0;
    var state = { assetsStored: [], lastManifest: null };

    var impl = async function (url, init) {
      calls++;
      if (opts.forceNetwork) throw new Error('MOCK: simulated network failure');

      if (!init || init.method !== 'POST') return fail(405, 'bad-request', 'MOCK: POST only.');
      var fd = init.body;
      if (!fd || typeof fd.get !== 'function') return fail(400, 'bad-request', 'MOCK: expected multipart FormData.');

      var manifestRaw = fd.get('manifest');
      if (!manifestRaw) return fail(400, 'bad-request', 'MOCK: manifest part is missing.');
      var manifest;
      try { manifest = JSON.parse(manifestRaw); }
      catch (e) { return fail(400, 'bad-request', 'MOCK: manifest is not valid JSON.'); }
      state.lastManifest = manifest;

      if (opts.forceStatus) {
        var canned = {
          400: ['bad-request', 'MOCK: simulated malformed request.'],
          409: ['page-count-mismatch', 'MOCK: simulated page count outside the product range.'],
          413: ['payload-too-large', 'MOCK: simulated payload over the limit.'],
          422: ['invalid-canvas', 'MOCK: simulated canvas schema rejection.'],
          500: ['server-error', 'MOCK: simulated server error.'],
        }[opts.forceStatus] || ['server-error', 'MOCK: simulated failure.'];
        return fail(opts.forceStatus, canned[0], canned[1]);
      }

      if (!(manifest.productId > 0)) {
        return fail(400, 'bad-request', 'MOCK: productId must be a positive designCentral id.');
      }
      if (!Array.isArray(manifest.pages) || !manifest.pages.length) {
        return fail(400, 'bad-request', 'MOCK: at least one page is required.');
      }

      /* --- the server's asset step: dedupe by hash, mint a key each --- */
      var keyByRef = {};
      (manifest.assets || []).forEach(function (a) {
        var blob = fd.get('asset_' + a.refId);
        if (!blob) throw new Error('MOCK: manifest lists ' + a.refId + ' but no such part was sent');
        keyByRef[a.refId] = mockImageKey(a.sha256);
        state.assetsStored.push({ refId: a.refId, sha256: a.sha256, imageKey: keyByRef[a.refId] });
      });

      /* --- the server's rewrite step --- */
      var m = modeFor(opts.product && opts.product.legacy && opts.product.legacy.designerMode);
      var pagesOut = [];
      for (var i = 0; i < manifest.pages.length; i++) {
        var page = JSON.parse(JSON.stringify(manifest.pages[i]));
        var objects = (page.canvasJson && page.canvasJson.objects) || [];
        for (var j = 0; j < objects.length; j++) {
          var o = objects[j];
          if (o.type !== 'image') continue;
          var ref = o.importAssetRef;
          if (!ref) {
            /* No marker is legitimate for an object the client left inline
             * (small SVG) or one that already carries a getImage.cfm src from
             * an earlier import. Only a RASTER data URI or a bare object with
             * neither marker nor src is a real error. */
            var src = typeof o.src === 'string' ? o.src : '';
            if (/^data:image\/(png|jpe?g|gif|webp|bmp)/i.test(src)) {
              return fail(422, 'invalid-canvas',
                'MOCK: image object on page ' + i + ' still carries a raster data URI.');
            }
            if (!src) {
              return fail(422, 'invalid-canvas',
                'MOCK: image object on page ' + i + ' has neither importAssetRef nor src.');
            }
            continue;   // inline SVG or an already-imported src — leave untouched
          }
          var key = keyByRef[ref];
          if (!key) {
            return fail(422, 'invalid-canvas',
              'MOCK: importAssetRef "' + ref + '" was not uploaded.');
          }
          delete o.importAssetRef;
          o.imageKey = key;
          o.src = 'getImage.cfm?key=' + key + '&mode=' + m.mode + '&ver=' + m.ver;
        }
        /* --- the server's invariant checks --- */
        var stored = JSON.stringify(page.canvasJson);
        /* RASTER data URIs are a hard failure. Small inline SVG is allowed by
         * design (see asset-extract.js INLINE_MIME) and is bounded by the page
         * size check immediately below. */
        if (/"src"\s*:\s*"data:image\/(png|jpe?g|gif|webp|bmp)/i.test(stored)) {
          return fail(422, 'invalid-canvas', 'MOCK: a raster data: image src survived on page ' + i + '.');
        }
        if (stored.length > MAX_PAGE_JSON_BYTES) {
          return fail(413, 'payload-too-large',
            'MOCK: page ' + i + ' canvasJson is ' + stored.length + ' bytes.');
        }
        pagesOut.push({ pageNumber: page.pageNumber, canvasJson: page.canvasJson,
                        storedBytes: stored.length });
      }

      var n = (opts.counterStart || 0) + calls;
      var templateId = MOCK_TEMPLATE_ID_BASE + n;
      return jsonResponse(201, {
        mock: true,
        mockNotice: 'SYNTHETIC — templateImport.cfm does not exist yet. These ids are not Sterling ids.',
        templateId: templateId,
        templateKey: MOCK_TEMPLATE_KEY_BASE + n,
        pages: pagesOut.length,
        live: false,
        mapped: false,
        openUrl: '/templateDesigner.cfm?template=' + templateId + '&product=' + manifest.productId,
        /* Not part of the real contract — exposed so tests and the preview can
         * inspect what the server WOULD have written to templatepages. */
        _mockStoredPages: pagesOut,
        _mockAssetsStored: state.assetsStored,
      });
    };

    impl.state = state;
    impl.callCount = function () { return calls; };
    return impl;
  }

  root.SMPMockTemplateImport = {
    createMockImportEndpoint: createMockImportEndpoint,
    mockImageKey: mockImageKey,
    IS_MOCK: true,
    MOCK_TEMPLATE_ID_BASE: MOCK_TEMPLATE_ID_BASE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
