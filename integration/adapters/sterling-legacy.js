/* Sterling LEGACY adapter — normalized design model → Fabric.js objects →
 * Sterling "version 1.2" template envelope.
 *
 * This file is the ONLY place that knows Sterling's current Designer exists.
 * Everything Fabric- or Sterling-specific lives here:
 *
 *   - Fabric object dialect: type names, version:'4.4.0', originX/originY,
 *     scaleX/scaleY, charSpacing in 1/1000 em, crossOrigin
 *   - Sterling markers: sterlingType, typeImage
 *   - the v1.2 envelope: templateNumber/templateKey/version/canvasProperties/
 *     productList/pages[].canvasData
 *   - designerVariationCode, and the trim-vs-bleed canvas convention
 *   - print bleed expansion in Fabric coordinate space
 *
 * When Sterling replaces the Designer, write a sibling adapter against the same
 * normalized model and leave the Generator alone.
 *
 * PROVENANCE: the bleed/cover-scale geometry below is carried over verbatim
 * from the working prototype (push-to-designer.js). It is print-correctness
 * logic that was tuned against real generated designs — it is moved, not
 * rewritten.
 */
(function (root) {
  'use strict';

  var round2 = function (n) { return Math.round(n * 100) / 100; };
  var round4 = function (n) { return Math.round(n * 10000) / 10000; };

  /* ---- normalized element → Fabric object ---------------------------- */

  function textToFabric(el) {
    var fs = el.font.sizePx;
    return {
      type: 'i-text', version: '4.4.0', originX: 'left', originY: 'top',
      sterlingType: 'textObject',
      left: round2(el.x), top: round2(el.y), width: round2(Math.max(el.width, 10)),
      text: el.text,
      fontSize: round2(fs),
      fontFamily: el.font.family,
      fontWeight: el.font.weight,
      fontStyle: el.font.style,
      underline: !!el.font.underline,
      textAlign: el.font.align,
      fill: el.color,
      lineHeight: el.font.lineHeightRatio,
      /* Fabric measures letter spacing in 1/1000 em, the Generator in pixels. */
      charSpacing: Number.isFinite(el.font.letterSpacingPx) && fs > 0
        ? Math.round(el.font.letterSpacingPx / fs * 1000) : 0,
      angle: el.rotation, scaleX: 1, scaleY: 1, opacity: el.opacity,
    };
  }

  function shapeBase(el) {
    return {
      version: '4.4.0', originX: 'left', originY: 'top',
      left: round2(el.x), top: round2(el.y), fill: el.fill,
      stroke: el.stroke, strokeWidth: el.strokeWidth,
      angle: el.rotation, scaleX: 1, scaleY: 1,
      opacity: el.opacity, sterlingType: 'shape', typeImage: 'shapes',
    };
  }

  function shapeToFabric(el) {
    var base = shapeBase(el);
    if (el.kind === 'polygon') {
      base.type = 'polygon';
      base.points = el.points;
      base.width = el.width; base.height = el.height;
      return base;
    }
    if (el.kind === 'circle') {
      base.type = 'circle'; base.radius = el.radius;
      return base;
    }
    if (el.kind === 'ellipse') {
      base.type = 'ellipse'; base.rx = el.radiusX; base.ry = el.radiusY;
      return base;
    }
    base.type = 'rect';
    base.width = el.width; base.height = el.height;
    base.rx = el.cornerRadiusX; base.ry = el.cornerRadiusY;
    return base;
  }

  function imageToFabric(el) {
    var o = {
      type: 'image', version: '4.4.0', originX: 'left', originY: 'top',
      left: round2(el.x), top: round2(el.y),
      /* Fabric sizes an image by its natural dimensions plus a scale factor. */
      width: round2(el.naturalWidth), height: round2(el.naturalHeight),
      scaleX: round4(el.width / el.naturalWidth),
      scaleY: round4(el.height / el.naturalHeight),
      angle: el.rotation, src: el.src, crossOrigin: 'anonymous', opacity: el.opacity,
    };
    /* Sterling's provenance markers. They record what the artwork IS; they do
     * not lock the object — background art stays selectable and movable, and
     * 'backgroundArt' additionally drives bleed cover-scaling below. */
    if (el.role === 'background') o.sterlingType = 'backgroundArt';
    else if (el.role === 'vector') o.sterlingType = 'vectorArt';
    return o;
  }

  function toFabric(el) {
    if (el.kind === 'text') return textToFabric(el);
    if (el.kind === 'image') return imageToFabric(el);
    return shapeToFabric(el);
  }

  /* ---- bleed geometry (carried over verbatim) ------------------------ */

  function coverScaleObject(o, s, offX, offY) {
    o.left = round2((o.left || 0) * s + offX);
    o.top = round2((o.top || 0) * s + offY);
    if (o.type === 'image') {
      o.scaleX = round4((o.scaleX || 1) * s); o.scaleY = round4((o.scaleY || 1) * s);
    } else if (o.type === 'rect') {
      o.width = round2(o.width * s); o.height = round2(o.height * s);
      if (o.rx) o.rx = round2(o.rx * s); if (o.ry) o.ry = round2(o.ry * s);
    } else if (o.type === 'circle') {
      o.radius = round2(o.radius * s);
    } else if (o.type === 'ellipse') {
      o.rx = round2(o.rx * s); o.ry = round2(o.ry * s);
    } else if (o.type === 'polygon' && Array.isArray(o.points)) {
      o.points = o.points.map(function (p) { return { x: round2(p.x * s), y: round2(p.y * s) }; });
      if (o.width) o.width = round2(o.width * s);
      if (o.height) o.height = round2(o.height * s);
    }
  }

  /* Does this object act as the card background (it should bleed off every edge)
   * rather than as foreground content (which must stay inside the safe area)? */
  function isBackgroundObject(o, trimW, trimH) {
    if (o.sterlingType === 'backgroundArt' || o.sterlingType === 'fixedImage') return true;
    if (o.type !== 'image' && o.type !== 'rect') return false;
    var w = (o.width || 0) * (o.scaleX || 1);
    var h = (o.height || 0) * (o.scaleY || 1);
    var nearOrigin = (o.left || 0) <= trimW * 0.06 && (o.top || 0) <= trimH * 0.06;
    return nearOrigin && w >= trimW * 0.9 && h >= trimH * 0.9;
  }

  /* Print-correct bleed: the background art is scaled to COVER the full bleed
   * canvas so it extends past the trim on every edge, while foreground content
   * (text, logos, accents) is only translated into the padded canvas by the
   * bleed offset — never enlarged — so it stays inside the safe/trim area. A
   * foreground rect that was already touching a trim edge is stretched out to the
   * bleed edge so intentional edge bands keep bleeding. Mutates in place. */
  function applyBleed(objects, trimW, trimH, bleedPx) {
    if (bleedPx <= 0) return;
    var canvasW = trimW + 2 * bleedPx, canvasH = trimH + 2 * bleedPx;
    var s = Math.max(canvasW / trimW, canvasH / trimH);
    var offX = (canvasW - trimW * s) / 2, offY = (canvasH - trimH * s) / 2;
    var tol = 1.5;
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (isBackgroundObject(o, trimW, trimH)) { coverScaleObject(o, s, offX, offY); continue; }
      var origLeft = o.left || 0, origTop = o.top || 0;
      o.left = round2(origLeft + bleedPx);
      o.top = round2(origTop + bleedPx);
      if (o.type === 'rect' && typeof o.width === 'number' && typeof o.height === 'number') {
        var right = origLeft + o.width, bottom = origTop + o.height;
        if (origLeft <= tol) { o.width = round2(o.width + o.left); o.left = 0; }
        if (right >= trimW - tol) { o.width = round2(o.width + bleedPx); }
        if (origTop <= tol) { o.height = round2(o.height + o.top); o.top = 0; }
        if (bottom >= trimH - tol) { o.height = round2(o.height + bleedPx); }
      }
    }
  }

  /* ---- normalized document → Sterling v1.2 template ------------------ */

  /**
   * @param {object} doc  normalized design document (SMPNormalized.createDocument)
   * @returns {object}    Sterling version-1.2 template envelope
   */
  function toSterlingTemplate(doc) {
    var d = doc.document;
    var pc = doc.productContext || {};
    var trimW = d.trimWidthPx, trimH = d.trimHeightPx, bleedPx = d.bleedPx;

    /* Convert each page's elements, then apply bleed in Fabric space. */
    var pageObjects = doc.pages.map(function (p) {
      return { objects: p.elements.map(toFabric), bleedAuthored: p.bleedAuthored };
    });

    /* The Sterling designer builds its canvas as canvasProperties.width/height +
     * the declared bleeds (SMPdesigner: canvas.setHeight = height + bleedTop +
     * bleedBottom). So canvasProperties.width/height MUST be the TRIM size with
     * the bleed declared separately, or the designer adds bleed on top of an
     * already-bleed-inclusive size and the artwork leaves a gap.
     * Bleed-authored pages already sit in the full bleed-canvas coordinate
     * space, so only trim-authored pages get the offset. */
    if (bleedPx > 0) {
      pageObjects.forEach(function (pg) {
        if (!pg.bleedAuthored) applyBleed(pg.objects, trimW, trimH, bleedPx);
      });
    }

    var prov = doc.provenance || {};
    var canvasProperties = {
      width: trimW, height: trimH, dpi: d.dpi, shape: pc.shape || 'rect', angle: 0,
      designerVariationCode: pc.designerMode || 'FullColour',
      bleedTop: bleedPx, bleedRight: bleedPx, bleedBottom: bleedPx, bleedLeft: bleedPx, bleedMargin: 0,
      borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: 0, borderWidth: 2,
      marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
      sideBorder: 0, topBorder: 0, sideMargin: 0, topMargin: 0,
      daterBoxHeight: 0, daterBoxWidth: 0, maxLines: 0,
      drawFullBorder: false, greenInkAvailable: false, isProstamp: false,
      materialColour: '', productNumber: pc.productNumber || '', productNumberVariation: '',
      /* provenance — lets the designer recognise generator designs */
      sourceApplication: prov.sourceApplication || 'templateGenerator',
      sourceVersion: prov.sourceVersion || 1,
      /* Trim size (the finished product size, excluding bleed) so product
       * recommendations match on 3.5x2, not the bleed canvas of 3.75x2.25. */
      trimWidthPx: trimW, trimHeightPx: trimH, bleedPx: bleedPx,
      sourceMeta: {
        templateType: pc.templateType || '',
        widthIn: d.widthIn,
        heightIn: d.heightIn,
        businessName: prov.businessName || '',
      },
    };

    return {
      templateNumber: 0,
      templateKey: 'TG-' + Date.now().toString(36).toUpperCase(),
      version: 1.2,
      canvasProperties: canvasProperties,
      productList: [],
      pages: pageObjects.map(function (pg, i) {
        return {
          page: i,
          canvasProperties: Object.assign({}, canvasProperties),
          canvasData: { version: '4.4.0', objects: pg.objects },
        };
      }),
    };
  }

  root.SterlingLegacyAdapter = {
    id: 'sterling-legacy',
    /** Designer page this adapter targets. */
    designerUrl: '../realdesigner/index.html',
    toSterlingTemplate: toSterlingTemplate,
    /* exposed for tests / reuse */
    toFabric: toFabric,
    applyBleed: applyBleed,
    isBackgroundObject: isBackgroundObject,
  };
})(typeof window !== 'undefined' ? window : globalThis);
