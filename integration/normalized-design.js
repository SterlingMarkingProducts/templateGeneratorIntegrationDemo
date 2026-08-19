/* Normalized design model — the STABLE BOUNDARY between the Design Template
 * Generator and any downstream design system.
 *
 * The Generator owns GENERATION. An adapter owns TRANSLATION. A designer owns
 * EDITING. This file defines the contract in the middle, and it is deliberately
 * free of Fabric.js and Sterling implementation details:
 *
 *   NOT here:  version:'4.4.0', originX/originY, scaleX/scaleY, sterlingType,
 *              typeImage, charSpacing (1/1000 em), prodfill/prodstroke,
 *              canvasProperties, templateKey, designerVariationCode encoding.
 *   Here:      geometry in CSS pixels, real typography, real colours, real
 *              image sources, page structure, product context, provenance.
 *
 * Everything above the line is the design as a human would describe it.
 * Everything below it is one designer's dialect, and lives in an adapter under
 * ./adapters/. Swapping Sterling's legacy Designer for its replacement should
 * mean writing a new adapter, not touching the Generator.
 *
 * Coordinate system
 *   Origin is the TOP-LEFT of the full canvas (trim + bleed on every edge).
 *   Units are CSS pixels at document.dpi. x/y are the element's top-left corner
 *   BEFORE rotation; rotation is clockwise degrees about that corner, matching
 *   how the extractor measures the DOM.
 *
 * Plain script (no modules) so it loads the same way as the rest of the app.
 */
(function (root) {
  'use strict';

  var SCHEMA_VERSION = 1;

  var round2 = function (n) { return Math.round(n * 100) / 100; };

  /* ---- element factories --------------------------------------------
   * Each returns a plain data object. Callers pass measured values; these
   * functions add no geometry logic of their own — the extractor's hard-won
   * measurement stays exactly where it is. */

  /** Text run. sizePx/letterSpacingPx are canvas pixels, not CSS-source px. */
  function textElement(o) {
    return {
      kind: 'text',
      x: round2(o.x), y: round2(o.y), width: round2(o.width),
      rotation: o.rotation || 0,
      opacity: typeof o.opacity === 'number' ? o.opacity : 1,
      text: o.text,
      color: o.color,
      font: {
        family: o.fontFamily,
        requestedFamily: o.requestedFamily || null,
        sizePx: round2(o.fontSizePx),
        weight: o.fontWeight,
        style: o.fontStyle || 'normal',
        underline: !!o.underline,
        align: o.align || 'left',
        lineHeightRatio: o.lineHeightRatio,
        letterSpacingPx: Number.isFinite(o.letterSpacingPx) ? o.letterSpacingPx : 0,
      },
    };
  }

  function baseShape(o, kind) {
    return {
      kind: kind,
      x: round2(o.x), y: round2(o.y),
      rotation: o.rotation || 0,
      opacity: typeof o.opacity === 'number' ? o.opacity : 1,
      fill: o.fill,
      stroke: o.stroke || null,
      strokeWidth: o.strokeWidth || 0,
    };
  }

  /** Rectangle, optionally uniformly rounded. */
  function rectElement(o) {
    var e = baseShape(o, 'rect');
    e.width = round2(o.width); e.height = round2(o.height);
    e.cornerRadiusX = round2(o.cornerRadiusX || 0);
    e.cornerRadiusY = round2(o.cornerRadiusY || 0);
    return e;
  }

  function circleElement(o) {
    var e = baseShape(o, 'circle');
    e.radius = round2(o.radius);
    return e;
  }

  function ellipseElement(o) {
    var e = baseShape(o, 'ellipse');
    e.radiusX = round2(o.radiusX); e.radiusY = round2(o.radiusY);
    return e;
  }

  /** Polygon. `points` are relative to the element's own x/y. */
  function polygonElement(o) {
    var e = baseShape(o, 'polygon');
    e.points = o.points.map(function (p) { return { x: round2(p.x), y: round2(p.y) }; });
    e.width = round2(o.width); e.height = round2(o.height);
    return e;
  }

  /* Raster or vector image.
   *   naturalWidth/Height  the source's intrinsic size
   *   width/height         the size it should occupy on the canvas
   * An adapter derives whatever scale representation it needs from the two.
   * `role` distinguishes card artwork that must bleed off every edge from
   * foreground content that must stay inside the trim. */
  function imageElement(o) {
    return {
      kind: 'image',
      role: o.role || 'content',            // 'background' | 'content'
      x: round2(o.x), y: round2(o.y),
      width: round2(o.width), height: round2(o.height),
      naturalWidth: round2(o.naturalWidth), naturalHeight: round2(o.naturalHeight),
      rotation: o.rotation || 0,
      opacity: typeof o.opacity === 'number' ? o.opacity : 1,
      src: o.src,
    };
  }

  /* ---- document ------------------------------------------------------ */

  /**
   * @param {object} o
   *   trimWidthPx/trimHeightPx  finished product size (excludes bleed)
   *   bleedPx                   bleed per edge
   *   dpi, unit, widthIn/heightIn  as authored in the Generator
   *   pages   [{ index, elements[], bleedAuthored }]
   *   productContext, provenance
   */
  function createDocument(o) {
    var bleed = o.bleedPx || 0;
    return {
      schemaVersion: SCHEMA_VERSION,
      document: {
        trimWidthPx: o.trimWidthPx,
        trimHeightPx: o.trimHeightPx,
        bleedPx: bleed,
        /* full canvas the elements are positioned in */
        widthPx: o.trimWidthPx + 2 * bleed,
        heightPx: o.trimHeightPx + 2 * bleed,
        dpi: o.dpi || 96,
        unit: o.unit || 'in',
        widthIn: o.widthIn,
        heightIn: o.heightIn,
      },
      productContext: o.productContext || null,
      pages: (o.pages || []).map(function (p, i) {
        return {
          index: typeof p.index === 'number' ? p.index : i,
          /* True when the generated artwork already spans the full bleed
           * canvas, so an adapter must NOT offset it again. */
          bleedAuthored: !!p.bleedAuthored,
          elements: p.elements || [],
        };
      }),
      provenance: o.provenance || null,
    };
  }

  /** Cheap structural check — returns an array of human-readable problems. */
  function validate(doc) {
    var problems = [];
    if (!doc || typeof doc !== 'object') return ['not an object'];
    if (doc.schemaVersion !== SCHEMA_VERSION) problems.push('schemaVersion is ' + doc.schemaVersion);
    var d = doc.document || {};
    if (!(d.trimWidthPx > 0) || !(d.trimHeightPx > 0)) problems.push('trim dimensions missing');
    if (!Array.isArray(doc.pages) || !doc.pages.length) problems.push('no pages');
    (doc.pages || []).forEach(function (p, i) {
      if (!Array.isArray(p.elements)) { problems.push('page ' + i + ' has no elements array'); return; }
      p.elements.forEach(function (el, j) {
        if (!el || !el.kind) problems.push('page ' + i + ' element ' + j + ' has no kind');
        if (el && typeof el.x !== 'number') problems.push('page ' + i + ' element ' + j + ' has no x');
      });
    });
    return problems;
  }

  root.SMPNormalized = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    createDocument: createDocument,
    validate: validate,
    text: textElement,
    rect: rectElement,
    circle: circleElement,
    ellipse: ellipseElement,
    polygon: polygonElement,
    image: imageElement,
  };
})(typeof window !== 'undefined' ? window : globalThis);
