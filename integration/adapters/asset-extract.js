/* Asset extraction — pull embedded raster data out of a Sterling package.
 *
 * The Generator emits Fabric image objects whose `src` is a base64 data URI.
 * Sterling stores page design data in `templatepages.canvasJson`, a MySQL TEXT
 * column capped at 65,535 bytes; a single one of our images can be 1.4 MB. The
 * fix is Sterling's own: images live in the `templateassets` store, keyed by an
 * `assetKey` UUID, and the canvas holds only that key.
 *
 * This module performs the CLIENT half:
 *   - find every `data:` image src across every page
 *   - decode it, hash it, and deduplicate identical binaries
 *   - hand back the binaries plus a canvas in which each data URI has been
 *     replaced by a temporary reference marker
 *
 * ------------------------------------------------------------------------
 * WHAT THIS MODULE MUST NEVER DO, and why:
 *
 *   It never mints an `imageKey`. Keys are minted server-side by
 *   createUUID() and are the primary key of a real table
 *   (templateassets.assetKey, UNIQUE). A client-chosen key could collide with
 *   or overwrite a reference to somebody else's asset. The client says "this
 *   is my asset #1"; the server says "that is now key X".
 *
 *   It never trusts a filename extension. The extension is derived from the
 *   data URI's declared MIME type, and even that is advisory — the server
 *   decides the real storage format after decoding the bytes.
 *
 *   It never mutates the caller's package. Extraction returns a deep copy, so
 *   the on-screen design, the local realdesigner transport and the golden
 *   masters are all unaffected by an import attempt.
 * ------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  /* RASTER types are extracted to the asset store: the Generator emits PNG, and
   * JPEG appears when the local transport's size ladder recompresses. These are
   * the ones that blow the TEXT column — a single PNG runs to 1.4 MB. */
  var EXTRACT_MIME = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
  };

  /* VECTOR data URIs stay INLINE, deliberately.
   *
   * The Generator's SVG logos are 570 bytes to 5 KB for a whole design — three
   * orders of magnitude smaller than its rasters — so they cost nothing in the
   * canvasJson budget, and the page-size check below still catches any
   * pathological case. Extracting them would also be actively wrong today:
   * Sterling's own upload path validates an incoming image with <cfimage>,
   * which cannot open an SVG, so an SVG upload would fail there.
   *
   * They survive the Sterling round trip untouched because gettemplateJson.cfm
   * only rewrites `src` for objects that HAVE an imageKey; an object without
   * one keeps whatever src it was stored with.
   *
   * Whether Sterling's Fabric build renders an inline SVG data URI is the one
   * thing here that still needs confirming on a server — see
   * docs/template-import-contract.md. */
  var INLINE_MIME = { 'image/svg+xml': 'svg' };

  /* Marker written into the outgoing canvas in place of the data URI. The
   * server replaces it with the real imageKey and a getImage.cfm src. */
  var REF_FIELD = 'importAssetRef';

  function AssetExtractError(code, message, detail) {
    var e = new Error(message);
    e.name = 'AssetExtractError';
    e.code = code;              // unsupported-mime | malformed-data-uri | decode-failed
    e.detail = detail || null;
    return e;
  }

  /** Split a data URI into {mime, base64}. Throws on anything malformed. */
  function parseDataUri(src) {
    if (typeof src !== 'string') throw AssetExtractError('malformed-data-uri', 'Image src is not a string.');
    var m = /^data:([a-z0-9.+/-]+)(;[^,]*)?,(.*)$/i.exec(src);
    if (!m) throw AssetExtractError('malformed-data-uri', 'Image src is not a well-formed data URI.');
    var mime = m[1].toLowerCase();
    var params = (m[2] || '').toLowerCase();
    if (params.indexOf('base64') < 0) {
      throw AssetExtractError('malformed-data-uri', 'Only base64 data URIs are supported, got: ' + params);
    }
    var b64 = m[3];
    if (!b64) throw AssetExtractError('malformed-data-uri', 'Data URI carries no payload.');
    /* Reject before decoding: atob() is lenient about junk in some engines. */
    if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
      throw AssetExtractError('malformed-data-uri', 'Data URI payload is not valid base64.');
    }
    return { mime: mime, base64: b64.replace(/\s+/g, '') };
  }

  function base64ToBytes(b64) {
    var bin;
    try { bin = atob(b64); }
    catch (e) { throw AssetExtractError('decode-failed', 'Could not base64-decode the image payload.'); }
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function toHex(buf) {
    var v = new Uint8Array(buf), s = '';
    for (var i = 0; i < v.length; i++) s += ('0' + v[i].toString(16)).slice(-2);
    return s;
  }

  /** SHA-256 of the DECODED bytes — the same thing the server will hash. */
  async function sha256(bytes) {
    var subtle = (root.crypto && root.crypto.subtle)
      || (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle);
    if (!subtle) throw AssetExtractError('decode-failed', 'WebCrypto SHA-256 is unavailable.');
    return toHex(await subtle.digest('SHA-256', bytes));
  }

  function isDataUriImage(o) {
    return o && o.type === 'image' && typeof o.src === 'string'
      && o.src.slice(0, 5).toLowerCase() === 'data:';
  }

  /**
   * Extract every embedded raster from a Sterling legacy package.
   *
   * @param {object} template  the SterlingLegacyAdapter package (not mutated)
   * @returns {Promise<{pages, assets, stats}>}
   *   pages  — deep copies with each data URI replaced by {importAssetRef}
   *   assets — ONE entry per unique binary: {refId, sha256, mimeType, extension,
   *            filename, bytes, byteLength, usedBy[]}
   */
  async function extractAssets(template) {
    if (!template || !Array.isArray(template.pages)) {
      throw AssetExtractError('malformed-data-uri', 'Package has no pages array.');
    }
    /* Deep copy FIRST: nothing below may touch the caller's object. */
    var pages = JSON.parse(JSON.stringify(template.pages));

    var byHash = Object.create(null);   // sha256 -> asset
    var assets = [];
    var imageObjects = 0, dataUriBytes = 0, inlineObjects = 0, inlineBytes = 0;

    for (var p = 0; p < pages.length; p++) {
      var objects = (pages[p].canvasData && pages[p].canvasData.objects) || [];
      for (var i = 0; i < objects.length; i++) {
        var o = objects[i];
        if (!isDataUriImage(o)) continue;
        imageObjects++;
        dataUriBytes += o.src.length;

        var parsed = parseDataUri(o.src);

        if (INLINE_MIME[parsed.mime]) {
          /* Left exactly as-is: no extraction, no marker, no mutation. */
          inlineObjects++;
          inlineBytes += o.src.length;
          continue;
        }

        var ext = EXTRACT_MIME[parsed.mime];
        if (!ext) {
          throw AssetExtractError('unsupported-mime',
            'Unsupported image type "' + parsed.mime + '". Extracted: '
            + Object.keys(EXTRACT_MIME).join(', ') + '. Kept inline: '
            + Object.keys(INLINE_MIME).join(', ') + '.',
            { mime: parsed.mime, page: p, objectIndex: i });
        }

        var bytes = base64ToBytes(parsed.base64);
        var hash = await sha256(bytes);

        var asset = byHash[hash];
        if (!asset) {
          /* Canonical MIME: image/jpg is not a real type, normalise it. */
          var mime = parsed.mime === 'image/jpg' ? 'image/jpeg' : parsed.mime;
          asset = {
            refId: 'asset-' + (assets.length + 1),
            sha256: hash,
            mimeType: mime,
            /* Extension derived from the DECLARED MIME, never from a filename.
             * Advisory only — the server re-derives it from the bytes. */
            extension: ext,
            filename: 'asset-' + (assets.length + 1) + '.' + ext,
            bytes: bytes,
            byteLength: bytes.length,
            usedBy: [],
          };
          byHash[hash] = asset;
          assets.push(asset);
        }
        asset.usedBy.push({ page: p, objectIndex: i });

        /* Swap the payload for a marker. Geometry, scale, angle, opacity,
         * origin, crossOrigin and sterlingType are all left untouched. */
        delete o.src;
        o[REF_FIELD] = asset.refId;
      }
    }

    return {
      pages: pages,
      assets: assets,
      stats: {
        imageObjects: imageObjects,
        extractedObjects: imageObjects - inlineObjects,
        uniqueAssets: assets.length,
        duplicatesCollapsed: (imageObjects - inlineObjects) - assets.length,
        inlineObjects: inlineObjects,
        inlineBytes: inlineBytes,
        dataUriBytes: dataUriBytes,
        assetBytes: assets.reduce(function (n, a) { return n + a.byteLength; }, 0),
      },
    };
  }

  /** True when no page still carries an EXTRACTABLE (raster) data: image src.
   * Small inline SVG data URIs are allowed by design — see INLINE_MIME. */
  function hasNoRasterDataUris(pages) {
    return !(pages || []).some(function (pg) {
      return ((pg.canvasData && pg.canvasData.objects) || []).some(function (o) {
        if (!isDataUriImage(o)) return false;
        var m = /^data:([^;,]+)/i.exec(o.src);
        var mime = m ? m[1].toLowerCase() : '';
        return !INLINE_MIME[mime];
      });
    });
  }

  /** Every data: image src, raster or vector. Used by tests and reporting. */
  function listDataUriMimes(pages) {
    var seen = {};
    (pages || []).forEach(function (pg) {
      ((pg.canvasData && pg.canvasData.objects) || []).forEach(function (o) {
        if (!isDataUriImage(o)) return;
        var m = /^data:([^;,]+)/i.exec(o.src);
        var mime = m ? m[1].toLowerCase() : '(unparseable)';
        seen[mime] = (seen[mime] || 0) + 1;
      });
    });
    return seen;
  }

  /** Serialized size of each page's canvasData, for the 60 KB pre-flight. */
  function pageSizes(pages) {
    return (pages || []).map(function (pg) {
      return JSON.stringify(pg.canvasData || {}).length;
    });
  }

  root.SMPAssetExtract = {
    extractAssets: extractAssets,
    hasNoRasterDataUris: hasNoRasterDataUris,
    listDataUriMimes: listDataUriMimes,
    pageSizes: pageSizes,
    parseDataUri: parseDataUri,
    AssetExtractError: AssetExtractError,
    EXTRACT_MIME: Object.keys(EXTRACT_MIME),
    INLINE_MIME: Object.keys(INLINE_MIME),
    REF_FIELD: REF_FIELD,
  };
})(typeof window !== 'undefined' ? window : globalThis);
