/* ── DOM refs ──────────────────────────────────────── */
const generateBtn     = document.getElementById('generateBtn');
const resetBtn        = document.getElementById('resetBtn');
const regenBtn        = document.getElementById('regenBtn');
const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
const jsonBtn         = document.getElementById('jsonBtn');
const jsonBtnLabel    = document.getElementById('jsonBtnLabel');
const jsonBtnIcon     = document.getElementById('jsonBtnIcon');

const templateType    = document.getElementById('templateType');
const dimWidth        = document.getElementById('dimWidth');
const dimHeight       = document.getElementById('dimHeight');
const unitToggle      = document.getElementById('unitToggle');
const industry        = document.getElementById('industry');
const businessName    = document.getElementById('businessName');
const styleDirection  = document.getElementById('styleDirection');
const creativityLevel = document.getElementById('creativityLevel');
const imageUrl        = document.getElementById('imageUrl');
const referenceFile   = document.getElementById('referenceFile');
const referenceImageUrl = document.getElementById('referenceImageUrl');
const referencePreview = document.getElementById('referencePreview');
const referencePreviewImg = document.getElementById('referencePreviewImg');
const referenceClear  = document.getElementById('referenceClear');
const svgPaste        = document.getElementById('svgPaste');
const svgFile         = document.getElementById('svgFile');
const specialInstr    = document.getElementById('specialInstructions');
const productNote     = document.getElementById('productNote');
const sidePreviews    = document.getElementById('sidePreviews');
const thumbFront      = document.getElementById('thumbFront');
const thumbBack       = document.getElementById('thumbBack');
const thumbFrontFrame = document.getElementById('thumbFrontFrame');
const thumbBackFrame  = document.getElementById('thumbBackFrame');

const emptyState      = document.getElementById('emptyState');
const loadingState    = document.getElementById('loadingState');
const resultState     = document.getElementById('resultState');

const summaryBody      = null;
const summaryAccordion = null;
const previewFrame    = document.getElementById('previewFrame');
const iframeScaler    = document.getElementById('iframeScaler');
const iframeOuter     = document.getElementById('iframeOuter');
const iframeScrollArea = document.getElementById('iframeScrollArea');
const toolbarLabel    = document.getElementById('toolbarLabel');
const bleedOverlay    = document.getElementById('bleedOverlay');
const guidePills      = document.getElementById('guidePills');
const guideSafe       = document.getElementById('guideSafe');
const guideBleed      = document.getElementById('guideBleed');
const dimWidthLabel   = document.getElementById('dimWidthLabel');
const dimHeightLabel  = document.getElementById('dimHeightLabel');
const dimWidthIndicator  = document.getElementById('dimWidthIndicator');
const dimHeightIndicator = document.getElementById('dimHeightIndicator');
const zoomLabel       = document.getElementById('zoomLabel');
const zoomInBtn       = document.getElementById('zoomIn');
const zoomOutBtn      = document.getElementById('zoomOut');
const zoomFitBtn      = document.getElementById('zoomFit');

const loadingSubline  = document.getElementById('loadingSubline');
const loadingProgressBar = document.getElementById('loadingProgressBar');
const errorToast      = document.getElementById('errorToast');
const errorMessage    = document.getElementById('errorMessage');
const toastClose      = document.getElementById('toastClose');

/* ── State ─────────────────────────────────────────── */
let selectedUnit      = 'in';
let lastPayload       = null;
let generatedHtml     = null;
let generatedJson     = null;
let toastTimeout      = null;
let jsonState         = 'generate'; // 'generate' | 'loading' | 'download'
let lastScale         = 1;
let fitScale          = 1;
let userZoomPercent   = 100;
let showSafeGuide     = true;
let showBleedGuide    = true;
let referenceImageData = null; // { mediaType, data } base64, no prefix

const SUBLINES = [
  'Reading the brief…',
  'Identifying the aesthetic…',
  'Researching design references…',
  'Defining the visual language…',
  'Selecting typography…',
  'Establishing the palette…',
  'Preparing creative direction…',
];
let sublineInterval  = null;
let progressInterval = null;

/* ── Unit toggle ───────────────────────────────────── */
unitToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.unit-btn');
  if (!btn) return;
  unitToggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedUnit = btn.dataset.unit;
});

/* ── Product presets ───────────────────────────────── */
const DOUBLE_SIDED_PRODUCTS = ['Business Card', 'Brochure'];

/* ── Print bleed (0.125" on every edge → 12px @ 96dpi) ── */
const BLEED_IN = 0.125;
const BLEED_PRODUCTS = ['Business Card', 'Poster', 'Brochure'];
function bleedPxFor(type) {
  return BLEED_PRODUCTS.includes(type) ? Math.round(BLEED_IN * 96) : 0;
}

const PRODUCT_PRESETS = {
  'Sign':          { w: 18,     h: 24,      unit: 'in', note: '' },
  'Business Card': { w: 3.5,    h: 2,       unit: 'in', note: 'Double-sided: Front = contact details, Back = branding.' },
  'Brochure':      { w: 11,     h: 8.5,     unit: 'in', note: 'Tri-fold, letter size. Generates outside and inside spreads (double-sided). Flat/open: 11"×8.5". Each panel: ~3.67"×8.5".' },
  'Poster':        { w: 18,     h: 24,      unit: 'in', note: '' },
  'Stamp':         { w: 2.25,   h: 0.8125,  unit: 'in', note: 'Standard self-inking stamp. Max 6 lines of text.' },
  'Nameplate':     { w: 8,      h: 2,       unit: 'in', note: '' },
  'Name Badge':    { w: 3,      h: 1,       unit: 'in', note: '' },
};

/* ── Template type: auto-fill dimensions ───────────── */
templateType.addEventListener('change', () => {
  const preset = PRODUCT_PRESETS[templateType.value];
  if (preset) {
    dimWidth.value  = preset.w;
    dimHeight.value = preset.h;
    unitToggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
    unitToggle.querySelector(`[data-unit="${preset.unit}"]`).classList.add('active');
    selectedUnit = preset.unit;
    if (preset.note) {
      productNote.textContent = preset.note;
      productNote.classList.remove('hidden');
    } else {
      productNote.textContent = '';
      productNote.classList.add('hidden');
    }
  } else {
    productNote.textContent = '';
    productNote.classList.add('hidden');
  }
});

/* ── Default product type ──────────────────────────── */
function applyDefaultProduct() {
  templateType.value = 'Business Card';
  templateType.dispatchEvent(new Event('change'));
}
applyDefaultProduct();

/* ── Colour pickers ────────────────────────────────── */
document.querySelectorAll('.color-toggle').forEach(toggle => {
  toggle.addEventListener('change', () => {
    const slot  = toggle.dataset.slot;
    const body  = document.getElementById(`colorBody-${slot}`);
    const row   = toggle.closest('.color-row');
    if (toggle.checked) {
      body.classList.remove('disabled');
      row?.classList.add('enabled');
    } else {
      body.classList.add('disabled');
      row?.classList.remove('enabled');
    }
  });
});

document.querySelectorAll('.color-picker').forEach(picker => {
  picker.addEventListener('input', () => {
    const slot = picker.id.replace('color-', '');
    document.getElementById(`colorHex-${slot}`).textContent = picker.value;
  });
});

/* ── Style preset chips ────────────────────────────── */
function clearChipActive() {
  document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
}

document.querySelectorAll('.style-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const isSurprise = chip.id === 'surpriseChip';
    // Empty style lets the server pick a full diverse style + bold archetype
    styleDirection.value = isSurprise ? '' : chip.dataset.style;
    clearChipActive();
    chip.classList.add('active');
  });
});

// Deactivate chips if user manually edits the style direction field
styleDirection.addEventListener('input', () => {
  clearChipActive();
  const val = styleDirection.value.trim();
  if (val) {
    document.querySelectorAll('.style-chip:not(.style-chip--surprise)').forEach(chip => {
      if (chip.dataset.style === val) chip.classList.add('active');
    });
  }
});

let contactDomSide    = 'front'; // which .card--* holds contact info (business cards)

function isBusinessCardPreview() {
  return lastPayload?.templateType === 'Business Card';
}

function scoreContactContent(htmlChunk) {
  if (!htmlChunk) return 0;
  let s = 0;
  if (/zone-contact|contact-group|contact-line|icon-row/i.test(htmlChunk)) s += 10;
  if (/mailto:|tel:|@|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/i.test(htmlChunk)) s += 8;
  if (/person-name|job-title|person-title/i.test(htmlChunk)) s += 4;
  if (/www\.|https?:\/\//i.test(htmlChunk)) s += 3;
  return s;
}

function extractCardHtml(html, side) {
  const re = new RegExp(`<div class="card card--${side}"[\\s\\S]*?(?=</body>|<div class="card card--|$)`, 'i');
  const m = html.match(re);
  return m ? m[0] : '';
}

function detectContactDomSideFromHtml(html) {
  const backChunk = extractCardHtml(html, 'back');
  if (!backChunk) return 'front';
  const frontScore = scoreContactContent(extractCardHtml(html, 'front'));
  const backScore = scoreContactContent(backChunk);
  if (backScore === frontScore) return 'front'; // prefer front per business-card convention
  return backScore > frontScore ? 'back' : 'front';
}

function detectContactDomSideFromDoc(doc) {
  const front = doc.querySelector('.card--front');
  const back = doc.querySelector('.card--back');
  if (!back) return 'front';
  const frontScore = scoreContactContent(front?.innerHTML || '');
  const backScore = scoreContactContent(back.innerHTML);
  if (backScore === frontScore) return contactDomSide || 'front';
  return backScore > frontScore ? 'back' : 'front';
}

function uiSideToDomSide(uiSide) {
  if (!isBusinessCardPreview()) return uiSide;
  const contact = contactDomSide || 'front';
  const brand = contact === 'front' ? 'back' : 'front';
  return uiSide === 'front' ? contact : brand;
}

/* ── Side switching (double-sided products) ─────────── */
function switchSide(uiSide) {
  const doc = previewFrame.contentDocument;
  if (!doc) return;
  const front = doc.querySelector('.card--front');
  const back  = doc.querySelector('.card--back');

  if (isBusinessCardPreview() && doc) {
    contactDomSide = detectContactDomSideFromDoc(doc);
  }

  const domSide = uiSideToDomSide(uiSide);

  if (domSide === 'back' && !back) {
    thumbFront?.classList.add('active');
    thumbBack?.classList.remove('active');
    return;
  }

  if (front && !doc.__cardDisplay) {
    const d = doc.defaultView.getComputedStyle(front).display;
    if (d && d !== 'none') doc.__cardDisplay = d;
  }
  const visibleDisplay = doc.__cardDisplay || 'grid';

  if (front) front.style.setProperty('display', domSide === 'front' ? visibleDisplay : 'none', 'important');
  if (back)  back.style.setProperty('display',  domSide === 'back'  ? visibleDisplay : 'none', 'important');

  thumbFront?.classList.toggle('active', uiSide === 'front');
  thumbBack?.classList.toggle('active', uiSide === 'back');
}

thumbFront?.addEventListener('click', () => switchSide('front'));
thumbBack?.addEventListener('click', () => switchSide('back'));

/* ── Print guide toggles ───────────────────────────── */
function toggleGuidePill(btn, stateKey) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (stateKey === 'safe') showSafeGuide = !showSafeGuide;
    else showBleedGuide = !showBleedGuide;
    btn.classList.toggle('active', stateKey === 'safe' ? showSafeGuide : showBleedGuide);
    updateBleedOverlay(lastScale);
  });
}
toggleGuidePill(guideSafe, 'safe');
toggleGuidePill(guideBleed, 'bleed');

/* ── Zoom controls ─────────────────────────────────── */
function setZoom(percent) {
  userZoomPercent = Math.max(25, Math.min(400, percent));
  if (zoomLabel) zoomLabel.textContent = `${Math.round(userZoomPercent)}%`;
  fitIframeToContent();
}

zoomInBtn?.addEventListener('click', () => setZoom(userZoomPercent + 25));
zoomOutBtn?.addEventListener('click', () => setZoom(userZoomPercent - 25));
zoomFitBtn?.addEventListener('click', () => setZoom(100));

/* ── SVG file upload ───────────────────────────────── */
svgFile.addEventListener('change', () => {
  const file = svgFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    svgPaste.value = reader.result;
  };
  reader.onerror = () => showError('Could not read the SVG file.');
  reader.readAsText(file);
});

const REFERENCE_MAX_BYTES = 5 * 1024 * 1024;

function setReferencePreview(dataUrl) {
  if (!referencePreview || !referencePreviewImg) return;
  if (dataUrl) {
    referencePreviewImg.src = dataUrl;
    referencePreview.classList.remove('hidden');
  } else {
    referencePreviewImg.src = '';
    referencePreview.classList.add('hidden');
  }
}

function clearReferenceImage() {
  referenceImageData = null;
  if (referenceFile) referenceFile.value = '';
  if (referenceImageUrl) referenceImageUrl.value = '';
  setReferencePreview(null);
}

function loadReferenceFromFile(file) {
  if (!file) return;
  if (file.size > REFERENCE_MAX_BYTES) {
    showError('Reference image must be under 5 MB.');
    referenceFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result;
    const match = /^data:([^;]+);base64,(.+)$/.exec(result);
    if (!match) {
      showError('Could not read the reference image.');
      return;
    }
    referenceImageData = { mediaType: match[1], data: match[2] };
    if (referenceImageUrl) referenceImageUrl.value = '';
    setReferencePreview(result);
  };
  reader.onerror = () => showError('Could not read the reference image.');
  reader.readAsDataURL(file);
}

if (referenceFile) {
  referenceFile.addEventListener('change', () => {
    const file = referenceFile.files?.[0];
    if (file) loadReferenceFromFile(file);
  });
}

if (referenceImageUrl) {
  referenceImageUrl.addEventListener('input', () => {
    if (referenceImageUrl.value.trim()) {
      referenceImageData = null;
      if (referenceFile) referenceFile.value = '';
      setReferencePreview(null);
    }
  });
}

if (referenceClear) {
  referenceClear.addEventListener('click', clearReferenceImage);
}

/* ── Collect colours ───────────────────────────────── */
function getColors() {
  const result = {};
  ['primary', 'secondary', 'tertiary', 'quaternary'].forEach(slot => {
    const toggle = document.querySelector(`.color-toggle[data-slot="${slot}"]`);
    if (toggle && toggle.checked) {
      result[slot] = document.getElementById(`color-${slot}`).value;
    }
  });
  return result;
}

/* ── Build payload ─────────────────────────────────── */
function buildPayload() {
  return {
    templateType: templateType.value,
    width:        parseFloat(dimWidth.value) || null,
    height:       parseFloat(dimHeight.value) || null,
    unit:         selectedUnit,
    industry:     industry.value.trim(),
    businessName: businessName.value.trim(),
    colors:       getColors(),
    styleDirection:      styleDirection.value.trim(),
    creativityLevel:     creativityLevel?.value || 'bold',
    imageUrl:            imageUrl.value.trim(),
    referenceImage:      referenceImageData,
    referenceImageUrl:   referenceImageUrl?.value.trim() || '',
    svgContent:          svgPaste.value.trim(),
    specialInstructions: specialInstr.value.trim(),
    doubleSided:         DOUBLE_SIDED_PRODUCTS.includes(templateType.value),
  };
}

/* ── Validate ──────────────────────────────────────── */
function validate(payload) {
  if (!payload.templateType) {
    showError('Please select a Template Type.');
    templateType.focus();
    return false;
  }
  if (!payload.width || !payload.height) {
    showError('Please enter both Width and Height dimensions.');
    (payload.width ? dimHeight : dimWidth).focus();
    return false;
  }
  if (payload.referenceImageUrl && !/^https?:\/\/.+/i.test(payload.referenceImageUrl)) {
    showError('Reference image URL must start with http:// or https://.');
    referenceImageUrl.focus();
    return false;
  }
  if (payload.imageUrl && !/^https?:\/\/.+/i.test(payload.imageUrl)) {
    showError('Image must be a valid URL starting with http:// or https://.');
    imageUrl.focus();
    return false;
  }
  if (payload.svgContent && !/<svg[\s>]/i.test(payload.svgContent)) {
    showError('SVG content must include valid <svg> markup.');
    svgPaste.focus();
    return false;
  }
  return true;
}

/* ── Show / hide panels ────────────────────────────── */
function showPanel(name) {
  emptyState.classList.toggle('hidden',   name !== 'empty');
  loadingState.classList.toggle('hidden', name !== 'loading');
  resultState.classList.toggle('hidden',  name !== 'result');
}

/* ── Subline cycling ───────────────────────────────── */
function startSublineCycle() {
  let idx = 0;
  loadingSubline.textContent = SUBLINES[0];
  sublineInterval = setInterval(() => {
    idx = (idx + 1) % SUBLINES.length;
    loadingSubline.style.opacity = '0';
    setTimeout(() => {
      loadingSubline.textContent = SUBLINES[idx];
      loadingSubline.style.opacity = '1';
    }, 300);
  }, 3200);
}

function stopSublineCycle() {
  clearInterval(sublineInterval);
  sublineInterval = null;
}

/* ── Progress bar ──────────────────────────────────── */
function setProgress(pct) {
  if (loadingProgressBar) loadingProgressBar.style.width = Math.min(pct, 100) + '%';
}

function resetProgress() {
  clearInterval(progressInterval);
  progressInterval = null;
  if (loadingProgressBar) {
    loadingProgressBar.style.transition = 'none';
    loadingProgressBar.style.width = '0%';
    // re-enable transition on next frame
    requestAnimationFrame(() => {
      loadingProgressBar.style.transition = '';
    });
  }
}

// Slowly creep from `from` to `to` over `durationMs` (ease-out)
function startFakeProgress(from, to, durationMs) {
  clearInterval(progressInterval);
  const steps    = 50;
  const interval = durationMs / steps;
  let step = 0;
  setProgress(from);
  progressInterval = setInterval(() => {
    step++;
    const t     = step / steps;
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    setProgress(from + (to - from) * eased);
    if (step >= steps) clearInterval(progressInterval);
  }, interval);
}

// Map streaming char count to 40–90% range
function updateStreamProgress(charCount) {
  const streamPct = Math.min(charCount / 12000, 1);
  setProgress(40 + streamPct * 50);
}

/* ── Layout safety for generated iframe HTML ─────────── */
function resolveTextZoneCollisions(root, cardHeight, bottomPad) {
  const card = root.querySelector?.('.card') || root.querySelector?.('[class*="card"]') || (root.classList?.contains('card') ? root : null);
  if (!card) return null;

  const minScale = lastPayload?.creativityLevel === 'bold' ? 0.6 : 0.45;
  const hideRules = lastPayload?.creativityLevel !== 'bold';

  const copy = card.querySelector('.zone-copy');
  const contact = card.querySelector('.zone-contact');
  const gap = 8;
  const cardRect = () => card.getBoundingClientRect();
  const report = { cardHeight, copyTop: copy?.offsetTop, contactTopBefore: contact?.offsetTop, actions: [] };

  if (copy) copy.style.transform = '';
  if (contact) {
    contact.style.transform = '';
    contact.style.top = '';
    contact.style.bottom = '';
  }
  card.querySelectorAll('.layout-hidden').forEach((el) => {
    el.classList.remove('layout-hidden');
    el.style.display = '';
  });

  if (copy && contact) {
    const contactH = contact.scrollHeight;
    report.overlapBefore = (copy.offsetTop + copy.scrollHeight) - contact.offsetTop;

    const scaleCopyTo = (maxCopyBottom) => {
      const available = maxCopyBottom - copy.offsetTop;
      if (available > 0 && copy.scrollHeight > available) {
        const scale = Math.max(minScale, available / copy.scrollHeight);
        copy.style.transform = `scale(${scale})`;
        copy.style.transformOrigin = 'top left';
        report.actions.push(`scaled-copy:${scale.toFixed(2)}`);
        return scale;
      }
      return 1;
    };

    if (cardHeight <= 240) {
      const maxCopyBottom = cardHeight - bottomPad - contactH - gap;
      scaleCopyTo(maxCopyBottom);

      let copyVisualBottom = copy.getBoundingClientRect().bottom - cardRect().top;
      let contactTop = Math.round(copyVisualBottom + gap);
      const maxContactTop = cardHeight - bottomPad - contactH;

      if (contactTop > maxContactTop) {
        scaleCopyTo(maxContactTop - gap);
        copyVisualBottom = copy.getBoundingClientRect().bottom - cardRect().top;
        contactTop = Math.min(maxContactTop, Math.round(copyVisualBottom + gap));
        report.actions.push('rescaled-for-contact-fit');
      }

      contact.style.bottom = 'auto';
      contact.style.top = `${contactTop}px`;
      report.actions.push(`anchored-contact:${contactTop}px`);
    } else {
      let maxCopyBottom = contact.offsetTop - gap;
      if (maxCopyBottom <= copy.offsetTop + 20) {
        contact.style.bottom = 'auto';
        contact.style.top = `${Math.max(copy.offsetTop + 40, cardHeight - bottomPad - contactH)}px`;
        maxCopyBottom = parseFloat(contact.style.top) - gap;
        report.actions.push('repositioned-contact-top');
      }
      scaleCopyTo(maxCopyBottom);

      const copyVisualBottom = copy.getBoundingClientRect().bottom - cardRect().top;
      if (copyVisualBottom > contact.offsetTop - gap) {
        contact.style.bottom = 'auto';
        contact.style.top = `${Math.min(cardHeight - bottomPad - contactH, copyVisualBottom + gap)}px`;
        report.actions.push('pushed-contact-below-copy');
      }
    }

    report.copyBottom = copy.getBoundingClientRect().bottom - cardRect().top;
    report.contactTopAfter = contact.offsetTop;
    report.overlapAfter = report.copyBottom - contact.offsetTop;
  } else {
    card.querySelectorAll('.zone-copy, .zone-contact').forEach((zone) => {
      zone.style.transform = '';
      const available = cardHeight - zone.offsetTop - bottomPad;
      if (zone.scrollHeight > available && zone.scrollHeight > 0) {
        const scale = Math.max(minScale, available / zone.scrollHeight);
        zone.style.transform = `scale(${scale})`;
        zone.style.transformOrigin = 'top left';
        report.actions.push(`scaled-${zone.className}:${scale.toFixed(2)}`);
      }
    });
  }

  const copyRect = copy?.getBoundingClientRect();
  const cRect = cardRect();
  if (hideRules) card.querySelectorAll('.rule-line, [class*="rule-line"], [class*="divider-line"]').forEach((line) => {
    const lineRect = line.getBoundingClientRect();
    const lineTop = line.offsetTop;
    const copyBottom = copy ? copy.getBoundingClientRect().bottom - cRect.top : 0;
    const contactTop = contact ? contact.offsetTop : cardHeight;
    const contactBottom = contact ? contactTop + contact.offsetHeight : cardHeight;
    const inTextBand = lineTop >= (copy?.offsetTop ?? 0) - 4 && lineTop <= contactBottom + 4;
    const crossesCopy = copyRect && lineRect.bottom > copyRect.top + 2 && lineRect.top < copyRect.bottom - 2;
    if (inTextBand || crossesCopy || (lineTop >= copyBottom - 4 && lineTop <= contactTop + 4)) {
      line.classList.add('layout-hidden');
      line.style.display = 'none';
      report.actions.push('hid-rule-line');
    }
  });

  return report;
}

function captureLayoutFixStyles(doc) {
  const card = doc.querySelector('.card') || doc.querySelector('[class*="card"]');
  if (!card) return '';
  let css = '';
  const copy = card.querySelector('.zone-copy');
  const contact = card.querySelector('.zone-contact');
  if (copy?.style.transform) {
    css += `.zone-copy{transform:${copy.style.transform}!important;transform-origin:top left!important;}`;
  }
  if (contact?.style.top) {
    css += `.zone-contact{bottom:auto!important;top:${contact.style.top}!important;}`;
  }
  if (card.querySelector('.layout-hidden')) {
    css += `.layout-hidden{display:none!important;}`;
  }
  return css;
}

function injectCapturedLayoutFixes(html, css) {
  if (!css) return html;
  const tag = `<style id="layout-fix-applied">${css}</style>`;
  if (html.includes('id="layout-fix-applied"')) {
    return html.replace(/<style id="layout-fix-applied">[\s\S]*?<\/style>/, tag);
  }
  return html.includes('</head>') ? html.replace('</head>', tag + '</head>') : tag + html;
}

function injectLayoutSafety(html, widthPx, heightPx, options = {}) {
  const { creativityLevel, templateType } = options;
  const isLargeFormat = /poster|sign/i.test(templateType || '') || heightPx > 600;
  const isBold = creativityLevel === 'bold';

  /* The preview iframe is sized to the full bleed canvas (trim + bleed), but
   * designs are authored at trim size and would otherwise sit in the top-left
   * corner leaving white on the right/bottom. Center the trim design and
   * scale it to COVER the bleed canvas so the artwork fills the frame and
   * bleeds off every edge — mirroring what Push to Designer does. */
  const bleedPair = bleedPxFor(templateType) * 2;
  const trimW = widthPx - bleedPair, trimH = heightPx - bleedPair;
  const cover = bleedPair > 0 && trimW > 0 && trimH > 0
    ? Math.max(widthPx / trimW, heightPx / trimH) : 1;
  const bodyFill = cover > 1
    ? `html{margin:0;padding:0;overflow:hidden;width:${widthPx}px;height:${heightPx}px;}`
      + `body{margin:0;padding:0;width:${trimW}px;height:${trimH}px;position:absolute;`
      + `left:50%;top:50%;transform:translate(-50%,-50%) scale(${cover.toFixed(4)});`
      + `transform-origin:center center;}`
    : `html,body{margin:0;padding:0;}`;

  // Posters and large formats need monumental type — skip card-style safety caps
  if (isLargeFormat) {
    const minimalRules = `<style id="layout-safety">${bodyFill}.card,.design,.canvas,[class*="card"]{overflow:hidden!important;position:relative!important;}</style>`;
    return html.includes('</head>') ? html.replace('</head>', minimalRules + '</head>') : minimalRules + html;
  }

  // Nameplates / badges: the person NAME is the hero (large) — never apply the
  // business-card person-name/job-title caps. Only scale text DOWN if it overflows.
  if (/nameplate|name badge|name tag/i.test(templateType || '')) {
    // The model names the outer container freely (.card, .plate, .badge…), so
    // match it generically for both the overflow clamp and the fit-down script.
    const rules = `${bodyFill}
.card,.plate,.nameplate,.badge,.design,.canvas,[class*="card"],[class*="plate"],[class*="badge"]{overflow:hidden!important;position:relative!important;}
.zone-copy{display:flex!important;flex-direction:column!important;gap:6px!important;}
.layout-hidden{display:none!important;}`;
    const styleTag = `<style id="layout-safety">${rules}</style>`;
    const fitScript = `<script id="layout-safety-script">(function(){function fit(){var c=document.querySelector(".card,.plate,.nameplate,.badge,[class*=card],[class*=plate],[class*=badge]")||(document.body&&document.body.firstElementChild);if(!c)return;var cw=c.clientWidth,ch=c.clientHeight;var zones=c.querySelectorAll(".zone-copy,.zone-contact");if(!zones.length)return;zones.forEach(function(z){z.style.transform="";z.style.transformOrigin="center center";var aw=cw-24,ah=ch-24,zw=z.scrollWidth,zh=z.scrollHeight;if((zw>aw||zh>ah)&&zw>0&&zh>0){var s=Math.max(0.4,Math.min(aw/zw,ah/zh));z.style.transform="scale("+s+")";}});}function r(){fit();setTimeout(fit,60);setTimeout(fit,220);setTimeout(fit,600);}if(document.fonts&&document.fonts.ready)document.fonts.ready.then(r);else r();window.addEventListener("load",r);})();<\/script>`;
    let out = html.includes('</head>') ? html.replace('</head>', styleTag + '</head>') : styleTag + html;
    out = out.includes('</body>') ? out.replace('</body>', fitScript + '</body>') : out + fitScript;
    return out;
  }

  const isSmall = heightPx <= 240;
  const headlineMax = isBold
    ? (heightPx <= 192 ? 44 : heightPx <= 240 ? 64 : 80)
    : (heightPx <= 192 ? 28 : heightPx <= 240 ? 36 : 52);
  const subMax = isBold ? (heightPx <= 192 ? 13 : 16) : (heightPx <= 192 ? 11 : 14);
  const nameMax = isBold ? (heightPx <= 192 ? 15 : 18) : (heightPx <= 192 ? 13 : 16);
  const minScale = isBold ? 0.6 : 0.45;
  const bottomPad = 10;
  let rules = `
${bodyFill}
.card,.design,.canvas,[class*="card"]{overflow:hidden!important;position:relative!important;}
.zone-copy{display:flex!important;flex-direction:column!important;gap:6px!important;overflow:hidden!important;}
.zone-copy>*{margin-top:0!important;flex-shrink:1!important;}
.zone-contact{display:flex!important;flex-direction:column!important;gap:6px!important;overflow:hidden!important;}
.card:has(.contact-group) .icon-row,.card:has(.zone-contact) .icon-row{display:none!important;}
.zone-copy>:is(.business-name,h1,[class*="business"],[class*="brand"],[class*="headline"],[class*="line-1"],[class*="line-2"],[class*="word-1"],[class*="word-2"]){font-size:min(${headlineMax}px,var(--headline-size,${headlineMax}px))!important;line-height:0.95!important;}
.zone-copy>:is(.tagline,[class*="tagline"],[class*="sub"]){font-size:min(${subMax}px,var(--sub-size,${subMax}px))!important;line-height:1.2!important;}
.zone-copy>:is(.person-name,[class*="person-name"]){font-size:min(${nameMax}px,var(--name-size,${nameMax}px))!important;line-height:1.2!important;}
.zone-copy>:is(.job-title,[class*="job-title"]){font-size:min(9px,var(--title-size,9px))!important;line-height:1.3!important;}
.layout-hidden{display:none!important;}
`;
  if (isSmall) {
    rules += `
.zone-copy .contact-group{display:none!important;}
`;
  }
  const styleTag = `<style id="layout-safety">${rules}</style>`;
  const fitScript = `<script id="layout-safety-script">(function(){var bp=${bottomPad},gap=8,minScale=${minScale};function R(c){var copy=c.querySelector(".zone-copy"),contact=c.querySelector(".zone-contact"),ch=c.clientHeight,cr=c.getBoundingClientRect();if(copy)copy.style.transform="";if(contact){contact.style.transform="";contact.style.top="";contact.style.bottom="";}c.querySelectorAll(".layout-hidden").forEach(function(el){el.classList.remove("layout-hidden");el.style.display="";});if(copy&&contact){var ch2=contact.scrollHeight;function sc(mx){var av=mx-copy.offsetTop;if(av>0&&copy.scrollHeight>av){var s=Math.max(minScale,av/copy.scrollHeight);copy.style.transform="scale("+s+")";copy.style.transformOrigin="top left";}}if(ch<=240){sc(ch-bp-ch2-gap);var cb=copy.getBoundingClientRect().bottom-cr.top,ct=Math.round(cb+gap),mct=ch-bp-ch2;if(ct>mct){sc(mct-gap);cb=copy.getBoundingClientRect().bottom-cr.top;ct=Math.min(mct,Math.round(cb+gap));}contact.style.bottom="auto";contact.style.top=ct+"px";}else{var mh=contact.offsetTop-gap;if(mh>copy.offsetTop+20)sc(mh);var cb2=copy.getBoundingClientRect().bottom-cr.top;if(cb2>contact.offsetTop-gap){contact.style.bottom="auto";contact.style.top=Math.min(ch-bp-ch2,cb2+gap)+"px";}}${isBold ? '' : 'var cpr=copy.getBoundingClientRect(),ct2=contact.offsetTop,cbt=ct2+contact.offsetHeight;c.querySelectorAll(".rule-line,[class*=\'rule-line\'],[class*=\'divider-line\']").forEach(function(l){var lr=l.getBoundingClientRect(),lt=l.offsetTop,cb3=copy.getBoundingClientRect().bottom-cr.top,cross=cpr&&lr.bottom>cpr.top+2&&lr.top<cpr.bottom-2,inBand=lt>=(copy.offsetTop||0)-4&&lt<=cbt+4;if(cross||inBand||(lt>=cb3-4&&lt<=ct2+4)){l.classList.add("layout-hidden");l.style.display="none";}});'}}else{c.querySelectorAll(".zone-copy,.zone-contact").forEach(function(z){z.style.transform="";var a=ch-z.offsetTop-bp;if(z.scrollHeight>a&&a>0){var s=Math.max(minScale,a/z.scrollHeight);z.style.transform="scale("+s+")";z.style.transformOrigin="top left";}});}}function f(){var c=document.querySelector(".card")||document.querySelector('[class*="card"]');if(c)R(c);}function r(){f();setTimeout(f,50);setTimeout(f,200);setTimeout(f,600);}if(document.fonts&&document.fonts.ready)document.fonts.ready.then(r);else r();window.addEventListener("load",r);})();</script>`;
  let out = html.includes('</head>') ? html.replace('</head>', styleTag + '</head>') : styleTag + html;
  out = out.includes('</body>') ? out.replace('</body>', fitScript + '</body>') : out + fitScript;
  return out;
}

function renderPreviewHtml(htmlStr, payload) {
  if (payload.templateType === 'Business Card') {
    contactDomSide = detectContactDomSideFromHtml(htmlStr);
  }
  const bleed    = bleedPxFor(payload.templateType) * 2;
  const widthPx  = toPx(payload.width, payload.unit) + bleed;
  const heightPx = toPx(payload.height, payload.unit) + bleed;
  return injectLayoutSafety(htmlStr, widthPx, heightPx, {
    creativityLevel: payload.creativityLevel,
    templateType: payload.templateType,
  });
}

function fitCardTextInPreview(persistFixes) {
  const doc = previewFrame.contentDocument;
  if (!doc) return;
  // Nameplates handle their own fitting via the injected nameplate script — the
  // business-card collision logic would wrongly shrink the hero name.
  if (/nameplate|name badge|name tag/i.test(lastPayload?.templateType || '')) return;
  const card = doc.querySelector('.card') || doc.querySelector('[class*="card"]');
  if (!card) return;
  resolveTextZoneCollisions(doc, card.clientHeight, 10);
  if (persistFixes && generatedHtml) {
    const css = captureLayoutFixStyles(doc);
    generatedHtml = injectCapturedLayoutFixes(generatedHtml, css);
  }
}

function formatDimLabel(value, unit) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '—';
  if (unit === 'in') return `${n.toFixed(2)}in`;
  if (unit === 'mm') return `${Math.round(n)}mm`;
  return `${Math.round(n)}px`;
}

function updateDimensionIndicators(scaledW, scaledH) {
  if (!lastPayload) return;
  if (dimWidthLabel) dimWidthLabel.textContent = formatDimLabel(lastPayload.width, lastPayload.unit);
  if (dimHeightLabel) dimHeightLabel.textContent = formatDimLabel(lastPayload.height, lastPayload.unit);
  dimHeightIndicator?.style.setProperty('--dim-h', `${scaledH}px`);
  dimWidthIndicator?.style.setProperty('--dim-w', `${scaledW}px`);
}

function injectThumbSideCss(html, uiSide) {
  let css = '<style id="thumb-side-only">';
  let showDom = uiSide;
  if (isBusinessCardPreview()) {
    const contact = detectContactDomSideFromHtml(html);
    showDom = uiSide === 'front' ? contact : (contact === 'front' ? 'back' : 'front');
  }
  if (showDom === 'front') {
    css += '.card--back{display:none!important;}';
  } else {
    css += '.card--front{display:none!important;}.card--back{display:grid!important;}';
  }
  css += '</style>';
  if (html.includes('</head>')) return html.replace('</head>', css + '</head>');
  return css + html;
}

function fitThumbFrame(frame, html) {
  if (!frame || !lastPayload) return;
  frame.srcdoc = html;
  frame.onload = () => {
    const bleed = bleedPxFor(lastPayload.templateType) * 2;
    const w = toPx(lastPayload.width, lastPayload.unit) + bleed;
    const h = toPx(lastPayload.height, lastPayload.unit) + bleed;
    const wrap = frame.parentElement;
    if (!wrap) return;
    const s = Math.min(wrap.clientWidth / w, wrap.clientHeight / h);
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    frame.style.transform = `scale(${s})`;
    frame.style.transformOrigin = 'top left';
  };
}

function updateSidePreviews() {
  if (!generatedHtml || !lastPayload?.doubleSided || !/class="card card--back"/i.test(generatedHtml)) {
    sidePreviews?.classList.add('hidden');
    return;
  }
  sidePreviews?.classList.remove('hidden');
  fitThumbFrame(thumbFrontFrame, injectThumbSideCss(generatedHtml, 'front'));
  fitThumbFrame(thumbBackFrame, injectThumbSideCss(generatedHtml, 'back'));
  thumbFront?.classList.add('active');
  thumbBack?.classList.remove('active');
}

function schedulePreviewTextFit() {
  fitCardTextInPreview();
  const doc = previewFrame.contentDocument;
  if (doc?.fonts?.ready) doc.fonts.ready.then(() => fitCardTextInPreview());
  requestAnimationFrame(() => requestAnimationFrame(() => fitCardTextInPreview()));
  setTimeout(() => fitCardTextInPreview(), 100);
  setTimeout(() => fitCardTextInPreview(true), 600);
}

/* ── Size iframe to design dimensions and scale to fit ── */
function fitIframeToContent() {
  if (!lastPayload) return;

  const bleed    = bleedPxFor(lastPayload.templateType) * 2;
  const widthPx  = toPx(lastPayload.width,  lastPayload.unit) + bleed;
  const heightPx = toPx(lastPayload.height, lastPayload.unit) + bleed;

  previewFrame.style.width  = widthPx  + 'px';
  previewFrame.style.height = heightPx + 'px';

  requestAnimationFrame(() => applyPreviewScale(widthPx, heightPx));
}

previewFrame.addEventListener('load', () => {
  fitIframeToContent();
  schedulePreviewTextFit();
  updateSidePreviews();
  if (lastPayload?.doubleSided) switchSide('front'); // front = contact side for business cards
});

/* ── PX conversion (for iframe sizing) ────────────── */
function toPx(value, unit) {
  if (unit === 'px') return value;
  if (unit === 'mm') return Math.round(value * (96 / 25.4));
  if (unit === 'in') return Math.round(value * 96);
  return value;
}

/* ── Scale iframe to fit panel ─────────────────────── */
function applyPreviewScale(widthPx, heightPx) {
  const padding = 48;
  const areaW = iframeScrollArea.clientWidth - padding;
  const areaH = iframeScrollArea.clientHeight - padding;

  if (areaW <= 0 || areaH <= 0) {
    requestAnimationFrame(() => applyPreviewScale(widthPx, heightPx));
    return;
  }

  fitScale = Math.min(areaW / widthPx, areaH / heightPx);
  const scale = fitScale * (userZoomPercent / 100);

  previewFrame.style.width  = `${widthPx}px`;
  previewFrame.style.height = `${heightPx}px`;
  previewFrame.width  = widthPx;
  previewFrame.height = heightPx;

  iframeScaler.style.width           = `${widthPx}px`;
  iframeScaler.style.height          = `${heightPx}px`;
  iframeScaler.style.transform       = `scale(${scale})`;
  iframeScaler.style.transformOrigin = 'top left';

  const scaledW = Math.ceil(widthPx * scale);
  const scaledH = Math.ceil(heightPx * scale);
  iframeOuter.style.width  = `${scaledW}px`;
  iframeOuter.style.height = `${scaledH}px`;

  if (zoomLabel) zoomLabel.textContent = `${Math.round(userZoomPercent)}%`;
  updateDimensionIndicators(scaledW, scaledH);

  lastScale = scale;
  updateBleedOverlay(scale);
}

/* ── Bleed / trim / safe-area guides overlay ───────── */
function updateBleedOverlay(scale) {
  if (!bleedOverlay || !lastPayload) return;

  const bleed = bleedPxFor(lastPayload.templateType);
  const hasBleedProduct = bleed > 0;

  guidePills?.classList.remove('hidden');
  guideBleed?.classList.toggle('hidden', !hasBleedProduct);

  const showAny = showSafeGuide || (showBleedGuide && hasBleedProduct);
  if (!showAny) {
    bleedOverlay.classList.add('hidden');
    return;
  }

  bleedOverlay.style.setProperty('--bleed', `${hasBleedProduct ? bleed : 12}px`);
  bleedOverlay.style.setProperty('--safe', `${hasBleedProduct ? bleed * 2 : 12}px`);
  bleedOverlay.style.setProperty('--lw', `${1 / (scale || 1)}px`);

  bleedOverlay.querySelector('.bleed-line--bleed')?.classList.toggle('hidden', !showBleedGuide || !hasBleedProduct);
  bleedOverlay.querySelector('.bleed-line--trim')?.classList.toggle('hidden', !showBleedGuide || !hasBleedProduct);
  bleedOverlay.querySelector('.bleed-line--safe')?.classList.toggle('hidden', !showSafeGuide);

  bleedOverlay.classList.remove('hidden');
}

/* ── Generate ──────────────────────────────────────── */
async function generate(payload) {
  lastPayload   = payload;
  generatedHtml = null;
  generatedJson = null;
  generateBtn.disabled = true;
  regenBtn.disabled    = true;
  showPanel('loading');
  resetProgress();
  startSublineCycle();

  try {
    const res = await fetch('/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    // Validation errors arrive as plain JSON before SSE headers are set
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Generation failed.');
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer   = '';
    let accum       = '';
    let htmlRendered = false;

    const widthPx  = toPx(payload.width,  payload.unit);
    const heightPx = toPx(payload.height, payload.unit);

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });

      // SSE events are delimited by \n\n
      const events = sseBuffer.split('\n\n');
      sseBuffer = events.pop(); // retain incomplete trailing chunk

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data: ')) continue;

        let msg;
        try { msg = JSON.parse(line.slice(6)); } catch { continue; }

        if (msg.error) throw new Error(msg.error);

        if (msg.phase === 0) {
          stopSublineCycle();
          loadingSubline.style.opacity = '1';
          loadingSubline.textContent = 'Analyzing style reference…';
          startFakeProgress(0, 18, 12000);
        }

        if (msg.phase === 1) {
          stopSublineCycle();
          loadingSubline.style.opacity = '1';
          loadingSubline.textContent = 'Creative director developing the visual spec…';
          startFakeProgress(0, 38, 30000);
        }

        if (msg.phase === 2) {
          clearInterval(progressInterval);
          loadingSubline.style.opacity = '1';
          loadingSubline.textContent = 'Building the design with Claude…';
          setProgress(42);
        }

        if (msg.t) {
          accum += msg.t;
          updateStreamProgress(accum.length);

          // Render preview the instant the HTML block closes — summary streams in after
          if (!htmlRendered) {
            const htmlMatch = accum.match(/```html\s*([\s\S]*?)```/);
            if (htmlMatch) {
              const htmlStr = htmlMatch[1].trim();
              generatedHtml = renderPreviewHtml(htmlStr, payload);

              toolbarLabel.textContent = payload.templateType + ' — Preview';
              setJsonState('generate');
              showPanel('result');
              stopSublineCycle();
              userZoomPercent = 100;
              if (zoomLabel) zoomLabel.textContent = '100%';

              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  previewFrame.srcdoc = generatedHtml;
                  // scaling is handled by the iframe 'load' listener (fitIframeToContent)
                });
              });

              regenBtn.disabled        = false;
              downloadHtmlBtn.disabled = false;
              htmlRendered = true;
            }
          }
        }

        if (msg.done) {
          // If HTML wasn't detected mid-stream (edge case), try final buffer
          if (!htmlRendered) {
            const htmlMatch = accum.match(/```html\s*([\s\S]*?)```/);
            if (!htmlMatch) {
              throw new Error('The AI response did not contain a valid HTML block. Please try regenerating.');
            }
            const htmlStr = htmlMatch[1].trim();
            generatedHtml = renderPreviewHtml(htmlStr, payload);

            toolbarLabel.textContent = payload.templateType + ' — Preview';
            setJsonState('generate');
            showPanel('result');
            stopSublineCycle();
            userZoomPercent = 100;
            if (zoomLabel) zoomLabel.textContent = '100%';

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                previewFrame.srcdoc = generatedHtml;
                // scaling is handled by the iframe 'load' listener (fitIframeToContent)
              });
            });

            regenBtn.disabled        = false;
            downloadHtmlBtn.disabled = false;
          }

          setProgress(100);
          break outer;
        }
      }
    }

  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
    showPanel('empty');
  } finally {
    stopSublineCycle();
    clearInterval(progressInterval);
    generateBtn.disabled = false;
  }
}

/* ── Event: Generate button ────────────────────────── */
generateBtn.addEventListener('click', () => {
  const payload = buildPayload();
  if (validate(payload)) generate(payload);
});

/* ── Event: Regenerate button ──────────────────────── */
regenBtn.addEventListener('click', () => {
  if (lastPayload) generate(lastPayload);
});

/* ── Event: Reset ──────────────────────────────────── */
resetBtn.addEventListener('click', () => {
  applyDefaultProduct();
  industry.value       = '';
  businessName.value   = '';
  styleDirection.value = '';
  imageUrl.value       = '';
  clearReferenceImage();
  svgPaste.value       = '';
  svgFile.value        = '';
  specialInstr.value   = '';
  productNote.textContent = '';
  productNote.classList.add('hidden');
  sidePreviews?.classList.add('hidden');
  if (thumbFrontFrame) thumbFrontFrame.srcdoc = '';
  if (thumbBackFrame) thumbBackFrame.srcdoc = '';
  userZoomPercent = 100;
  if (zoomLabel) zoomLabel.textContent = '100%';
  contactDomSide = 'front';
  clearChipActive();

  unitToggle.querySelectorAll('.unit-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.unit === 'in');
  });
  selectedUnit = 'in';

  document.querySelectorAll('.color-toggle').forEach(t => {
    t.checked = false;
    const slot = t.dataset.slot;
    document.getElementById(`colorBody-${slot}`).classList.add('disabled');
    t.closest('.color-row')?.classList.remove('enabled');
  });

  generatedHtml = null;
  generatedJson = null;
  lastPayload   = null;

  setJsonState('generate');
  resetProgress();
  showPanel('empty');
  hideError();
});

/* ── Download helpers ──────────────────────────────── */
function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function prepareDownloadHtml(html, doubleSided, templateType) {
  if (!doubleSided) return html;
  let out = html;
  // Remove preview-only hiding so both spreads render in the saved file.
  out = out.replace(/(<div class="card card--back"[^>]*)\s*style="display:\s*none;?\s*"/gi, '$1');
  out = out.replace(/(<div class="card card--back"[^>]*)\s*style="[^"]*display:\s*none;?[^"]*"/gi, '$1');
  out = out.replace(/(\.card--back[^{]*\{[^}]*?)display:\s*none\s*;?\s*/gi, '$1');
  const cardDisplay = templateType === 'Brochure' ? 'grid' : 'block';
  if (!out.includes('id="download-both-sides"')) {
    out = out.replace('</head>', `<style id="download-both-sides">
.card--back{display:${cardDisplay}!important;margin-top:24px;}
@media print{
  .card--front{page-break-after:always;}
  .card--back{margin-top:0!important;}
}
</style></head>`);
  }
  return out;
}

downloadHtmlBtn.addEventListener('click', () => {
  if (!generatedHtml) return;
  const name = (lastPayload?.templateType || 'template').replace(/\s+/g, '-').toLowerCase();
  const out = prepareDownloadHtml(generatedHtml, lastPayload?.doubleSided, lastPayload?.templateType);
  downloadFile(out, `${name}-design.html`, 'text/html');
});

/* ── JSON state machine ────────────────────────────── */
const JSON_ICONS = {
  generate: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>`,
  loading:  `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
};
const JSON_LABELS = {
  generate: 'Generate JSON',
  loading:  'Generating…',
  download: 'Download JSON',
};

function setJsonState(state) {
  jsonState = state;
  jsonBtnIcon.innerHTML  = JSON_ICONS[state];
  jsonBtnLabel.textContent = JSON_LABELS[state];
  jsonBtn.disabled       = state === 'loading';
  jsonBtn.classList.toggle('tool-btn-spinning', state === 'loading');
  jsonBtn.classList.toggle('tool-btn-ready', state === 'download');
}

jsonBtn.addEventListener('click', async () => {
  if (jsonState === 'download') {
    const name = (lastPayload?.templateType || 'template').replace(/\s+/g, '-').toLowerCase();
    downloadFile(generatedJson, `${name}-design.json`, 'application/json');
    return;
  }
  if (jsonState !== 'generate' || !generatedHtml) return;

  setJsonState('loading');
  try {
    const res  = await fetch('/generate-json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ html: generatedHtml }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'JSON generation failed.');
    generatedJson = data.json;
    setJsonState('download');
  } catch (err) {
    setJsonState('generate');
    showError(err.message || 'JSON generation failed. Please try again.');
  }
});

/* ── Error toast ───────────────────────────────────── */
function showError(msg) {
  clearTimeout(toastTimeout);
  errorMessage.textContent = msg;
  errorToast.classList.remove('hidden');
  toastTimeout = setTimeout(hideError, 8000);
}

function hideError() {
  errorToast.classList.add('hidden');
}

toastClose.addEventListener('click', hideError);

/* ── Resize: re-scale on window resize ─────────────── */
let resizeDebounce = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    if (!resultState.classList.contains('hidden') && lastPayload) {
      fitIframeToContent();
    }
  }, 120);
});
