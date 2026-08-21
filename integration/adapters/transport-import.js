/* Import transport — Generator → Sterling templateImport.cfm.
 *
 * ONE multipart/form-data POST carrying the page canvas JSON plus the unique
 * image binaries. The server stores the assets, rewrites each image object with
 * the real imageKey, inserts a NON-LIVE draft (templates + templatepages, no
 * mappings) and returns the URL of the real Template Designer.
 *
 * ------------------------------------------------------------------------
 * WHAT THIS CLIENT DELIBERATELY DOES NOT SEND
 *
 * No width, height, bleed, safe margin, shape, designer mode, minPages or
 * maxPages. Those are Sterling product facts and the server re-derives every
 * one of them from designCentral before it writes anything. The Generator's
 * own catalogue is mostly spreadsheet-INFERRED test data; a server that
 * trusted it could produce a wrongly sized print job. The client sends what
 * only the client knows — the artwork — and an id to look the rest up by.
 *
 * Non-authoritative provenance may be sent for logging, but is namespaced
 * under `source` so nothing can mistake it for a specification.
 *
 * NO ENDPOINT IS HARDCODED. baseUrl is injected, exactly like
 * SterlingProductProvider, because this runs in a public browser app.
 * ------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  /* templatepages.canvasJson is MySQL TEXT (65,535 bytes). Refuse at 60,000 so
   * a page can never be silently truncated on insert. */
  var MAX_PAGE_JSON_BYTES = 60000;
  var MAX_TOTAL_ASSET_BYTES = 20 * 1024 * 1024;

  function ImportError(code, message, detail) {
    var e = new Error(message);
    e.name = 'TemplateImportError';
    /* bad-request | not-eligible | payload-too-large | page-too-large |
     * data-uri-remaining | http-error | network | bad-response */
    e.code = code;
    e.detail = detail || null;
    return e;
  }

  /**
   * Is this product importable into Sterling at all?
   *
   * A real import writes a row keyed on designCentral's products.id. The
   * spreadsheet-derived test catalogue carries SYNTHETIC NEGATIVE ids
   * (see data/sterling-test-catalogue.json) precisely so they can never be
   * mistaken for real ones — those products drive the Generator and the local
   * realdesigner handoff perfectly well, but they cannot be imported.
   */
  function eligibility(product) {
    if (!product) {
      return { eligible: false, reason: 'no-product',
        message: 'Select a Sterling product before importing.' };
    }
    if (typeof product.id !== 'number' || !(product.id > 0)) {
      return { eligible: false, reason: 'synthetic-id',
        message: product.partNumber + ' is a spreadsheet-derived test product with no '
          + 'authoritative designCentral products.id, so it cannot be imported into '
          + 'Sterling yet. It remains fully usable for design generation and the local '
          + 'designer handoff.' };
    }
    if (!product.provenance || product.provenance.technicalDataStatus !== 'cms-verified') {
      return { eligible: false, reason: 'not-verified',
        message: product.partNumber + ' has a real product id but its technical values are '
          + 'not CMS-verified. The server would re-derive them anyway; import is blocked '
          + 'here so a half-trusted record never reaches it.' };
    }
    return { eligible: true, reason: 'ok', message: '' };
  }

  function AE() {
    var m = root.SMPAssetExtract;
    if (!m) throw new Error('integration/adapters/asset-extract.js must load before transport-import.js');
    return m;
  }

  /**
   * Build the import request WITHOUT sending it. Exposed so tests and the
   * preview harness can inspect exactly what would go over the wire.
   */
  async function buildRequest(template, product, options) {
    options = options || {};
    var elig = eligibility(product);
    if (!elig.eligible) throw ImportError('not-eligible', elig.message, elig);

    var extracted = await AE().extractAssets(template);

    /* Pre-flight the two invariants the server also enforces. Failing here
     * costs nothing; failing there costs a round trip and maybe a partial write. */
    if (!AE().hasNoRasterDataUris(extracted.pages)) {
      throw ImportError('data-uri-remaining',
        'Extraction left a raster data: image src in the outgoing canvas. Refusing to send.');
    }
    var sizes = AE().pageSizes(extracted.pages);
    for (var i = 0; i < sizes.length; i++) {
      if (sizes[i] > MAX_PAGE_JSON_BYTES) {
        throw ImportError('page-too-large',
          'Page ' + i + ' canvas JSON is ' + sizes[i] + ' bytes, over the '
          + MAX_PAGE_JSON_BYTES + '-byte limit for templatepages.canvasJson.',
          { page: i, bytes: sizes[i], limit: MAX_PAGE_JSON_BYTES });
      }
    }
    if (extracted.stats.assetBytes > MAX_TOTAL_ASSET_BYTES) {
      throw ImportError('payload-too-large',
        'Total asset payload is ' + extracted.stats.assetBytes + ' bytes, over the '
        + MAX_TOTAL_ASSET_BYTES + '-byte limit.',
        { bytes: extracted.stats.assetBytes, limit: MAX_TOTAL_ASSET_BYTES });
    }

    /* The manifest — the JSON part of the multipart body. Product FACTS are
     * absent by design; only the id travels. */
    var manifest = {
      contractVersion: 1,
      productId: product.id,
      pages: extracted.pages.map(function (pg, idx) {
        return {
          pageNumber: typeof pg.page === 'number' ? pg.page : idx,
          canvasJson: pg.canvasData,
        };
      }),
      assets: extracted.assets.map(function (a) {
        return { refId: a.refId, sha256: a.sha256, mimeType: a.mimeType,
                 byteLength: a.byteLength };
      }),
      source: {
        application: 'templateGenerator',
        version: 1,
        /* Non-authoritative. Present for the server's audit log only; the
         * server must not read a technical value from here. */
        partNumberSeenByClient: product.partNumber,
        technicalDataStatus: product.provenance.technicalDataStatus,
        /* Orientation INTENT ('landscape'|'portrait'). The server validates
         * that the product supports it and derives the authoritative oriented
         * geometry itself — this never carries trusted dimensions. Read from
         * the template's own sourceMeta so the intent and the geometry cannot
         * disagree in transit. */
        orientationRequested:
          (template.canvasProperties
            && template.canvasProperties.sourceMeta
            && template.canvasProperties.sourceMeta.orientation) || null,
      },
    };

    return { manifest: manifest, assets: extracted.assets, stats: extracted.stats,
             pageSizes: sizes };
  }

  /** Assemble the multipart body from a built request. */
  function toFormData(built) {
    if (typeof FormData === 'undefined') throw ImportError('bad-request', 'FormData is unavailable.');
    var fd = new FormData();
    fd.append('manifest', JSON.stringify(built.manifest));
    built.assets.forEach(function (a) {
      /* The filename is a generated refId + a MIME-derived extension. It is
       * never a user-supplied name, and the server must still derive the real
       * storage format from the bytes rather than trusting it. */
      var blob = new Blob([a.bytes], { type: a.mimeType });
      fd.append('asset_' + a.refId, blob, a.filename);
    });
    return fd;
  }

  /**
   * Send the import.
   *
   * @param {object} cfg  {baseUrl, fetchImpl}. baseUrl is REQUIRED and never
   *                      hardcoded; fetchImpl lets tests and the mock inject a
   *                      transport so nothing can reach a real host by accident.
   */
  function TemplateImportTransport(cfg) {
    cfg = cfg || {};
    if (!cfg.baseUrl) {
      throw new Error('TemplateImportTransport requires an explicit baseUrl. '
        + 'Sterling hosts are never hardcoded in browser code.');
    }
    this.baseUrl = String(cfg.baseUrl).replace(/\/+$/, '');
    this.fetchImpl = cfg.fetchImpl || null;
    this.label = cfg.label || 'import';
  }

  TemplateImportTransport.prototype.id = 'template-import';

  TemplateImportTransport.prototype.send = async function (template, product, options) {
    var built = await buildRequest(template, product, options);
    var url = this.baseUrl + '/templateImport.cfm';
    var doFetch = this.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!doFetch) throw ImportError('network', 'No fetch implementation available.');

    var res;
    try {
      res = await doFetch(url, { method: 'POST', body: toFormData(built), credentials: 'include' });
    } catch (e) {
      throw ImportError('network', 'Could not reach the template import endpoint: ' + e.message);
    }

    var body = null;
    try { body = await res.json(); }
    catch (e) {
      throw ImportError('bad-response', 'Import endpoint did not return JSON (HTTP ' + res.status + ').');
    }

    if (res.status !== 201 && res.status !== 200) {
      var err = (body && body.error) || {};
      throw ImportError(err.code || 'http-error',
        err.message || ('Import failed with HTTP ' + res.status + '.'),
        { status: res.status, detail: err.detail || null });
    }
    if (!body || typeof body.templateId !== 'number' || !body.openUrl) {
      throw ImportError('bad-response', 'Import response is missing templateId or openUrl.', body);
    }
    /* Never silently fall back to the local transport — a failed import must
     * surface, not quietly become a localStorage handoff. */
    return { response: body, stats: built.stats, pageSizes: built.pageSizes,
             manifest: built.manifest };
  };

  root.SMPTransportImport = {
    TemplateImportTransport: TemplateImportTransport,
    buildRequest: buildRequest,
    toFormData: toFormData,
    eligibility: eligibility,
    ImportError: ImportError,
    MAX_PAGE_JSON_BYTES: MAX_PAGE_JSON_BYTES,
    MAX_TOTAL_ASSET_BYTES: MAX_TOTAL_ASSET_BYTES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
