/* ============================================================================
   engine.js — the design-generation pipeline, running entirely in the browser.
   Generated from server.js (same prompts and logic) so the app can be hosted
   as a static site (GitHub Pages). Requires browser-api.js, which provides
   window.anthropic and wires handleGenerate/handleGenerateJson into the
   app's fetch('/generate') calls. Regenerate with scripts/build-engine.js
   after editing server.js.
   ========================================================================= */
(() => {
'use strict';

const MODEL_SPEC = 'claude-opus-4-8';
const MODEL_HTML = 'claude-opus-4-8';
const MODEL_JSON = 'claude-sonnet-4-5-20250929';

// Some newer models (e.g. Opus 4.8) deprecate the `temperature` parameter — omit it there.
function tempParam(model, value) {
  return /opus-4-8|opus-5|sonnet-5|fable-5|haiku-5/i.test(model || '') ? {} : { temperature: value };
}

function getTextContent(message) {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

const REFERENCE_INSPIRATION_PROMPT = `Analyze this design reference image. Extract creative direction cues for a print designer creating a NEW original piece — do NOT describe how to copy or recreate this image literally.

Return ONLY these sections:

PALETTE CUES
[4–6 hex colors capturing the mood — background, primary, accent, text]

TYPOGRAPHY CUES
[Font personalities, weight contrast, scale relationships, mixed type styles if any]

COMPOSITION CUES
[Layout structure: splits, grid, thirds, hero placement, whitespace ratio, edge bleeds]

GRAPHIC LANGUAGE
[Specific techniques visible: neon glow, geometric primitives, data viz, vintage border, illustration layers, textures, etc.]

ATMOSPHERE
[1–2 sentences: mood and what makes this design feel premium]

INSPIRATION MANDATE
[1 sentence telling the designer what to channel from this reference without cloning it]`;

const REFERENCE_RECREATE_PROMPT = `You are reproducing this uploaded design as an editable template. Transcribe and describe it COMPLETELY, LITERALLY and EXACTLY so a designer can recreate it faithfully. Be exhaustive — do not paraphrase or "improve" anything.

Return ONLY these sections:

SIDES
[Is this a single design, or a mockup showing a FRONT and a BACK (or inside/outside)? If two sides, say which is which; describe each separately in the LAYOUT sections below.]

BRAND
[The exact company/brand name as written — preserve capitalization and any two-tone/colour split (e.g. "BrightSmile" where "Bright" and "Smile" differ in colour). Include any descriptor line (e.g. "DENTAL CLINIC") and tagline/slogan.]

TEXT CONTENT — verbatim
[EVERY piece of text, exactly as written, one item per line: person name, title/role, phone, email, website, address, service lists, taglines, footnotes. Copy them character-for-character.]

COLORS
[Exact hex values and where each is used: background(s), primary, secondary/accent, text/light. Give real hex codes.]

LOGO / ICONS
[Describe the logo mark precisely enough to rebuild in CSS/SVG — shape, style, colours. List every icon (phone, mail, globe, pin, tooth, etc.) and how contact lines use them.]

TYPOGRAPHY
[Heading vs body font personality (serif/sans, weight, letter-spacing), and any two-tone or all-caps treatments.]

LAYOUT — FRONT
[Exact composition: logo position, each text block's placement and alignment, decorative shapes (waves, diagonal splits, rounded corners), and where everything sits relative to the edges.]

LAYOUT — BACK
[Same level of detail, only if a back/second side exists.]

FIDELITY MANDATE
[One sentence: reproduce this design faithfully — same brand, colours, content and layout — adapting only to the given product dimensions.]`;

async function fetchReferenceImageFromUrl(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch reference image (${res.status})`);
  const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) throw new Error('URL did not return an image');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) throw new Error('Reference image exceeds 5 MB');
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  }
  return { mediaType: contentType, data: btoa(binary) };
}

async function analyzeReferenceImage(image, mode) {
  const recreate = mode === 'recreate';
  const response = await anthropic.messages.create({
    model: MODEL_SPEC,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.data },
        },
        { type: 'text', text: recreate ? REFERENCE_RECREATE_PROMPT : REFERENCE_INSPIRATION_PROMPT },
      ],
    }],
    max_tokens: recreate ? 1800 : 900,
    ...tempParam(MODEL_SPEC, recreate ? 0.2 : 0.5),
  });
  return getTextContent(response);
}

// ── Elite designer persona ───────────────────────────────────────────────────
const SYSTEM_DESIGNER = `You are a world-class graphic designer and creative director whose portfolio spans the full breadth of design history and contemporary practice. You draw with equal mastery from Swiss International Style (Müller-Brockmann grid discipline), Neo-Brutalism (raw type, stark asymmetry), Bauhaus constructivism (primary geometry, functional form), Art Deco (geometric ornament, architectural symmetry), Memphis Design (bold pattern and color), Japanese Minimalism (ma — negative space as active composition), Dark Editorial (cinematic atmosphere, moody contrast), Organic Modernism (biomorphic shape, earth tones), Retro-Futurism (gradient chrome, 70s–80s space-age), Psychedelic Modernism (vibrant saturation, fluid form), Urban Industrial (raw materials, stencil type), Luxury Maximalism (opulent layering, jewel tones), and Contemporary Craft (artisanal texture, warmth).

Your work has been recognized at Cannes Lions, D&AD Yellow Pencil, and AIGA, and featured in Eye Magazine, PRINT, Wallpaper*, and It's Nice That.

You are, simply, the best in the world at this — the senior designer whose work clients wait months for. Every piece begins with a strong, specific creative CONCEPT (one you could name in a sentence — "a business card that IS a live analytics dashboard", "an Art Deco monogram built from stepped gold rays"), and then you EXECUTE IT PRECISELY at the density that direction deserves. You have no house style and no default personality: a maximalist brief gets a fully designed environment, and a restrained brief gets three perfect elements and composed whitespace — each executed with the same conviction. You make either feel effortless, because every element reinforces the ONE concept and nothing is present to fill space. Your layouts are architecturally composed (never centered-by-default), your palettes are chosen for the brief rather than out of habit, and your typography is confident and deliberately scaled.

TYPOGRAPHY — MATCH THE DIRECTION:
Choose type for the direction in front of you, not out of habit. A high-contrast editorial serif (Cormorant, Playfair Display, EB Garamond, Bodoni Moda, Fraunces, DM Serif Display) is exactly right for elegant serif, modern luxury, editorial minimal and soft-sophisticated work, and wrong for Swiss, brutalist or technical work — and the reverse is equally true. Never carry one favourite family across every brief. Typical pairings, as a starting point rather than a rule:

- Swiss Grid / Bauhaus / Constructivist → Barlow, Space Grotesk, Work Sans, IBM Plex Sans, Outfit (tight tracking, geometric discipline)
- Neo-Brutalism → Archivo Black, Anton, Bebas Neue, Black Han Sans (ultra-heavy, oversized, confrontational)
- Memphis Bold / Psychedelic → Unbounded, Nunito Black, Raleway Black, Righteous (round, energetic, geometric)
- Japanese Minimalism → DM Sans, Noto Sans JP, Inter, Jost (refined restraint, ultra-light weights)
- Dark Editorial / Cinematic → Oswald, Exo 2, Rajdhani, Montserrat (clean, powerful, technical weight)
- Organic / Contemporary Craft → Nunito, Quicksand, Lato, Outfit (warm, rounded, humanist)
- Retro-Futurism → Orbitron, Oxanium, Exo 2, Space Mono (retrofuture, geometric structure)
- Urban Industrial → Bebas Neue, Barlow Condensed, Roboto Condensed, Black Ops One (stencil energy, compressed)
- Dark Glamour / Tech / Cyberpunk → Rajdhani, Chakra Petch, Exo 2, Share Tech Mono (crisp, technical, modern)
- Art Deco → Cinzel, Josefin Sans, Poiret One, Cormorant (the ONLY time to use ornate/serif-adjacent fonts)
- Luxury Maximalism → Fraunces, Abril Fatface, Rozha One, Bodoni Moda (decorative but intentional)
- Coastal Minimalism → DM Sans, Karla, Raleway, Nunito (airy, clean, light-handed)

CRAFT BAR — every design, at every density, must show award-winning print craft:
- A clear HERO MOMENT the viewer remembers — oversized type, a commanding wordmark, a monogram, a bold field, or a decisive split. What it is depends on the direction; that there is one does not.
- Real hierarchy and confident scale contrast, so the eye is led rather than left to hunt.
- Deliberate composition — asymmetry, a strict grid, a diagonal, architectural framing; never centered-by-default.
- Every element present on purpose. Nothing added to fill space, and nothing omitted that the concept needs.
HOW MUCH material a piece carries is set by the DESIGN DENSITY contract in the Style Direction — follow it. A restrained direction executed with three elements, a flat ground and composed whitespace is FINISHED WORK, not an under-designed one; padding it with gradients, patterns and ornament to look busier is a FAIL. A rich direction executed thinly is equally a FAIL. Match the contract you are given.
The one thing that is never acceptable at any density is carelessness: a template-grade centered stack, arbitrary spacing, or an unconsidered palette.

CRAFT PRINCIPLES:
- Intentional composition — real layout decisions (asymmetry, grid, diagonal, architectural framing); never centered-by-default.
- Color creates atmosphere — choose a palette that genuinely suits this business and this direction. Light, warm, soft, saturated, deep and metallic palettes are all legitimate; so is a professional blue when it is the right answer rather than a reflex. What is not acceptable is an unconsidered palette: the same default reached for regardless of brief.
- Integrate any user photo with intent (crop, frame, overlay); never a raw rectangle.
- "Corporate" or "professional" still means top-agency craft — rich, bold, structured — never document-like.

EVERYTHING MUST FIT — non-negotiable, and it never conflicts with richness (richness lives in the background/graphics; text stays disciplined):
- Every glyph must be fully visible inside the canvas. Size display type to FIT the safe width — if a wordmark is too wide, reduce its size or break it onto two lines BEFORE any letter touches or crosses an edge.
- Never rely on overflow:hidden to hide overshooting text. Never let a name, tagline, or contact line clip at any edge.
- Reserve vertical room for every text line so nothing is cut off at the bottom.

HARD FAILS (never ship these):
- PowerPoint / Word / Canva-grade layouts — a centered text stack with arbitrary spacing and no compositional thinking.
- Any text clipped, cut off, hidden, or overlapping other text.
- Ignoring the density contract in either direction — padding a restrained brief, or thinning a rich one.
- Reaching for the same typeface or the same palette regardless of the brief.`;

// ── Portfolio design archetypes — used when style is generic or empty ────────
const GENERIC_STYLE = /^(corporate|professional|business|clean|simple|modern|legal|law|minimal|minimalist|elegant|classic)?$/i;

const LEGAL_ARCHETYPES = [
  'Luxury Black & Gold Monogram — matte black #0d0d0d background, antique gold #c9a84c accents, oversized interlocked-initials monogram as inline SVG, horizontal gold rules flanking firm name, small scales-of-justice or pillar icon, serif+sans type pairing',
  'Burgundy Executive Diagonal — charcoal #2b2b2b left panel + warm cream #f5f0e8 right panel via clip-path diagonal split, deep burgundy #701f28 accent stripe at the split, debossed vertical line texture on dark panel, circular SVG icon contact row',
  'Classic Cream Framed — warm cream paper background, double inset border lines, large serif name, vertical monogram sidebar, contact details with small accent-colored circular SVG icons (phone, email, globe, pin)',
  'Slate & Copper Heritage — slate #3d4f5c + warm white + copper #b87333 accents, geometric corner bracket SVG ornaments, strong caps hierarchy, subtle column/pillar motif',
  'Forest & Brass Prestige — deep forest #1a3c34 + ivory + brushed brass #c9a84c, art deco corner SVG ornaments, asymmetric layout with gold rule accents',
  'Editorial Legal Serif — oversized cropped serif firm name bleeding off canvas edge, charcoal + terracotta accent blob behind type, thin grid lines, refined contact block',
];

/* NOT WIRED IN since the balanced direction pool below replaced the old
   two-random-picks default. Kept for reference while the direction set
   settles; nothing reads them. */
const DESIGN_ARCHETYPES = [
  ...LEGAL_ARCHETYPES,
  'Diagonal Geometric Split — two contrasting palette panels divided by clip-path diagonal, accent stripe at split, bold caps hierarchy, chevron or arrow SVG cluster on light panel',
  'Editorial Oversized Type — cream background, massive cropped serif display type as graphic element, organic blob accent shape, thin structural grid lines',
  'Constructivist Color Block — bold primary geometry (red/yellow/black or similar), strict orthogonal grid, white type reversed on saturated fields',
  'Fintech Dashboard Card — near-black background + vivid accent (lime/coral/violet, NOT blue), mini metric blocks with CSS borders, sparkline SVG, corner-bracket logo frame',
  'Memphis Energy — saturated contrasting shapes (triangles, circles, zigzags), dot grid pattern, playful asymmetric layout, bold geometric sans',
  'Dark Glamour Editorial — deep oxblood or charcoal + metallic gold accent, high-contrast typographic hierarchy, geometric arc SVG motifs',
  'Organic Warm Craft — terracotta + sage + warm cream, biomorphic blob shapes, rounded humanist type, fluid asymmetric layering',
];

const BOLD_ARCHETYPES = [
  'Massive Knockout Type — business name at 56–80px filling 65%+ of a saturated color panel, white or accent reversed type, cropped at canvas edge',
  'Asymmetric Dual Panel — 55/45 clip-path split with contrasting palettes, typography on lighter panel, bold accent stripe at the seam',
  'Dominant Monogram — custom inline SVG interlocked initials occupying 40–50% of canvas height, typography arranged beside/below it',
  'Pattern-Forward Background — repeating geometric SVG or CSS pattern at 10–20% opacity across full canvas, bold solid type and color block on top',
  'Photo Fusion — image bleeds one full edge with gradient fade into solid color field; type overlaps photo with mix-blend-mode or knockout panel',
  'Layered Depth Stack — 3 overlapping semi-transparent geometric shapes (circles, arcs, polygons) creating depth; type on top z-index',
  'Edge-Bleed Brutal — oversized condensed type touching or bleeding off canvas edges via overflow:hidden, raw saturated color blocks',
  'Neon Electric Contrast — near-black field + single vivid neon accent (lime #c8f542, hot coral #ff6b6b, electric violet #a855f7), glow via text-shadow/box-shadow',
  'Sculptural Minimal — 75%+ intentional negative space, one bold horizontal bar or arc spanning 70%+ width, tiny precise type in one corner',
  'Chromatic Collision — two saturated opposing hues meeting at 25–40° diagonal, halftone or dot-grid texture on one panel, knock-out caps',
  'Oversized Cropped Display — one word of business name at 72px+ partially clipped by container overflow, secondary info in small caps below',
  'Frame Within Frame — inset panel with contrasting fill, double-border or corner bracket SVG ornaments, editorial hierarchy inside panel',
];

// ── Poster / Sign archetypes — large-format design language ──────────────────
/* Also NOT WIRED IN any more: a poster with no style direction now takes a
   single direction from the balanced pool plus the large-format note, rather
   than a direction PLUS a second unrelated random archetype. Kept for the
   keyword routes' reference and for a later large-format pass. */
const POSTER_ARCHETYPES = [
  'Swiss Modernist Grid — 2–3 words of oversized display type filling 55–65% of canvas height, strict geometric shapes (filled circles, rectangles, quarter-arcs) as the compositional graphic system in exactly 3 colors, off-white or warm cream background, Swiss grid spatial discipline (Müller-Brockmann energy)',
  'Dark Cinematic Event — deep saturated background (near-black, oxblood, or midnight navy) with large atmospheric photography blended via gradient overlay or color-burn mask, bold reversed headline at 160–220px+, gold or electric accent geometry (diagonal band, arc, corner bracket), dramatic film-poster hierarchy with strong bottom information block',
  'Neo-Brutalist Festival — ultra-heavy condensed type (Bebas Neue, Anton, or Black Han Sans) at raw extreme scale filling 60%+ of canvas, stark saturated background (hot yellow, raw red, or black), irregular grid with deliberate visual aggression, secondary type at aggressively contrasting sizes, zero decorative niceties',
  'Retro Vintage Illustrated — warm sun-toned palette (amber #f5a623, rust #c45c3e, teal #2a7f7f, cream #faf6ed), radiating sunburst SVG ray pattern, banner ribbon shapes with contrasting fill, layered decorative typography at multiple scales, hand-crafted warmth of vintage market and carnival poster tradition',
  'Editorial Typographic Monument — one word or two-word headline at 200–280px as the entire hero occupying 65% of the canvas, secondary info in ultra-precise small caps at 14px, 70%+ of canvas is pure intentional negative space, gallery announcement / museum exhibition / high fashion minimalism',
  'Constructivist Diagonal Energy — bold primary color blocks (red + black + white, or red + blue + yellow) at sharp diagonal compositions, heavy condensed type running at 45° or stacked in Rodchenko-style vertical column, strong directional arrow or diagonal band dividing canvas, revolutionary poster kinetic energy',
  'Punk Collage Chaos — distressed halftone grain texture layered at 40% opacity, ripped-paper edge shapes via SVG path, neon color explosions (magenta, yellow, cyan) on near-black background, multiple typeface weights in chaotic-but-intentionally-composed hierarchy, barcode or stamp elements, concert culture raw energy',
  'Luxury Art Gala — large refined display type (Abril Fatface or Cormorant) in deep jewel tone (emerald #1a4a3a, burgundy #4a1c2e, sapphire #1a2e4a), elegant geometric ornament (thin gold rule flanking headline, corner SVG bracket), generous negative space, art auction / opera / museum gala prestige',
  'Organic Botanical Warmth — terracotta #c45c3e + sage #7d9b8a + cream + mustard palette, large flowing botanical vector illustration or biomorphic blob shapes in soft fill, layered transparency via opacity, text anchored bottom-left with warm humanist sans, farmers market / artisan / wellness warmth',
  'Art Gallery Stark Minimalist — 70%+ intentional negative space as active design element, one singular bold element (a 400px+ geometric shape OR one carefully-placed image crop OR a single giant letterform) positioned off-center in the lower or upper third, tiny ultra-precise contact type (12px) anchored in the opposing corner, maximum tension between emptiness and weight',
];

// ── Stamp archetypes — monochromatic self-inking stamp designs ───────────────
const STAMP_ARCHETYPES = [
  'Classic Double Border — solid 3px outer rectangle border + 1px inner border inset 3px, business name centered in heavy condensed caps, one thin rule below the name, 1–2 compact info lines centered underneath',
  'Top Banner Reversal — solid black bar spanning the full width at the top (~40% of height) with the business name reversed in white bold caps, clean white zone below with 1–2 black info lines centered',
  'Bottom Banner Reversal — business name in heavy black caps in the upper white zone, solid black bottom bar spanning full width with one contact line reversed in white',
  'Left Initial Block — solid black square filling the full height on the left side containing the business initial reversed in white at large bold size, right zone holds the name and 1–2 info lines left-aligned in a tidy vertical stack',
  'Rule Architecture — thick 3px horizontal rules spanning the full width at the very top and very bottom, business name large and centered between them, a single thin rule separating the name from one info line',
  'Rounded Seal Frame — one rounded-rectangle border (6–8px radius, 2–3px stroke), business name centered in bold letter-spaced caps, one smaller info line below, generous even padding all around',
  'Typographic Weight Drama — no border at all: business name at maximum bold size spanning the width, second line in much smaller widely-tracked caps below — pure scale contrast is the entire design',
  'Dashed Inner Accent — solid 2px outer border + dashed 1px inner border, business name centered in bold caps, one info line below in condensed type',
  'Full Reversal — the entire stamp is a solid black rounded rectangle with ALL text reversed in white: bold business name centered, thin white rules above and below it, one small info line at the bottom',
  'Corner Bracket Minimal — thick L-shaped bracket marks in the four corners only (no full border), business name bold and centered, one small info line below — modern minimal stamp with intentional white space',
];

const STAMP_CREATIVE_MOMENTS = [
  'Dramatic weight contrast: the business name must be at least 2.5× the size of the info lines — the size jump IS the design.',
  'Use letter-spacing as the design tool: spread the business name caps with 0.1–0.2em tracking for engraved-stamp authority.',
  'One strong solid black element (bar, block, or thick border) anchors the design — everything else stays quiet and minimal.',
  'Perfect optical balance: even margins on all sides, consistent vertical rhythm between the stacked text lines.',
  'Negative space is the luxury: fewer elements, larger margins, bolder name.',
];

// ── Reference-quality archetypes — modeled on award-winning print design ───────
const SYNTHWAVE_POSTER_ARCHETYPES = [
  'Neon Nights Festival — stacked chrome-gradient 3D headline (linear-gradient silver + text-shadow neon cyan glow stack), brush-stroke secondary word in hot pink #ff2d95, purple lightning SVG bolts framing a glowing triangle portal, layered scene: perspective grid floor (repeating-linear-gradient), striped orange sun (#ff6b35 horizontal bands), palm + pier silhouettes, cyan/magenta light-trail streaks, boxed date badges with skew transform',
  'Outrun Horizon — full-bleed sunset gradient (#1a0a2e → #ff6b35 → #ffd700), massive condensed display type with multi-layer text-shadow neon (0 0 10px #0ff, 0 0 30px #f0f), VHS scanline overlay via repeating-linear-gradient, retro grid receding to vanishing point, chrome text via background-clip:text',
  'Electric Pier — photographic pier zone with purple/pink color-burn overlay, Ferris wheel SVG silhouette with radial glow, dual-sun motif (small badge sun + large horizon sun), mixed type: Orbitron chrome + Pacifico script + Bebas date blocks',
];

const FASHION_EDITORIAL_ARCHETYPES = [
  'VELA Editorial — cream #f5f0e8 canvas, brand name in ultra-wide tracked serif spanning full width overlapping photo, asymmetric 40/60 split with architectural model photo (clip-path curved crop), italic collection line, thin tan #c4a882 rule separators, vertical edge text, 70%+ intentional whitespace',
  'Runway Monument — one word at 200px+ cropped by overflow:hidden bleeding off bottom, dusty rose #d4a5a5 semicircle behind final letters, services list in tiny tracked caps, diagonal terracotta accent line',
  'Gallery Minimal — single serif headline "A Study in Form" with italic connector word, photo occupying right 55% with soft gradient fade into cream, logo lockup in thin rounded rectangle frame, tagline in 10px spaced sans at bottom',
];

const WPA_TRAVEL_ARCHETYPES = [
  'Cascadia National Parks — double inset border with notched corners, cream paper grain via feTurbulence SVG filter, layered flat-color illustration zones (snow peak, evergreen forest, coastal cliffs, vintage camper van foreground with kayaks), script "Explore" flanked by rules, embossed serif title with text-shadow depth, compass rose SVG footer banner',
  'Vintage Road Trip — warm hazy sky gradient (#faf6ed → #e8c872), flat color plane landscape in 3 depth layers, bold serif destination name with cream stroke effect (-webkit-text-stroke), tracked sans subhead with dot separators, "ADVENTURE AWAITS" bottom banner with circular emblem',
  'Screenprint Poster — limited 5-color palette (forest, rust, cream, teal, mustard), halftone texture overlay at 15% opacity, bold geometric mountain silhouette, decorative border frame, hand-crafted travel copy blocks',
];

const SWISS_EDITORIAL_ARCHETYPES = [
  'North/South Exhibition — strict grid on cream, tall condensed sans headline split across black + saturated red (#e63946), geometric system: solid red circle, black downward triangle overlapping masked photo, horizontal stripe square block, grounding red square anchor, vertical side text in 10px caps, short horizontal rule accents only',
  'Müller-Brockmann Poster — mathematical spacing, one primary color + black + white only, display type at 180px+ filling left column, photo crop in geometric mask (circle or triangle), baseline grid visible through subtle guide lines at 5% opacity',
  'International Typographic — asymmetric but balanced, 3 font sizes only (display 160px, sub 24px, detail 12px), one bold geometric primitive as hero, zero decorative fluff',
];

const SUMMIT_CORPORATE_ARCHETYPES = [
  'Elevate Leadership Summit — diagonal navy #0a1628 + gold split, curved gold-bordered photo portal revealing architectural interior (stairs/skyline), nested gold triangle depth stack at bottom, serif ELEVATE + gold year, tracked sans summit subhead, calendar/location icon rows with gold rule separators, three-bar growth logo mark',
  'Premium Conference — dark navy field with metallic gold gradient accents (linear-gradient #c9a84c → #f5e6a3), upward-perspective photography, keynote typography hierarchy, footer tagline flanked by rules',
  'Executive Innovation — asymmetric 45/55 split, gold geometric frame device, white serif headline + gold accent subhead, vertical gold bar beside secondary message, B2B prestige palette',
];

const STUDIO_CARD_ARCHETYPES = [
  'Verve Studio — cream card, tiny tracked sans studio name top-left, services list top-right in terracotta with diagonal rule separator, massive lowercase serif wordmark cropped at bottom edge (overflow:hidden), dusty rose semicircle overlapping final letters, back: three-column grid with thin dividers + terracotta bleed block',
  'Editorial Knockout — oversized cropped display type filling 60% of card, one semicircle or blob accent behind type, minimal contact in opposing corner, high whitespace ratio',
  'Luxury Crop Type — single word at 72px+ clipped by container, secondary info in 9px tracked caps, one warm accent shape (terracotta, rose, or sand)',
];

const DATA_STUDIO_CARD_ARCHETYPES = [
  'Metric Haus Dashboard — navy #0f1729 front designed as live analytics UI: lime #c8f542 accent, metric blocks with borders, sparkline SVG, "LIVE" status dot, bar chart icons; back: navy/white split with bracketed monogram, topographic line pattern, subtle chart watermark',
  'Pulse Creative Agency — royal blue + white diagonal split with orange-red triangle, custom geometric P logo (stacked triangles + semicircle), nested chevron momentum graphic, back: diagonal split with bar chart + line graph SVG, icon contact column, vertical keyword stack (STRATEGY / CREATIVE / GROWTH)',
  'Growth Analytics Card — dark field with data visualization as primary art (bar chart, trend line, metric tiles), monospace accent numbers, corner crosshair motif, services footer bar',
];

// ── New signature styles (from user references) — light/bright/premium diversity ──
const DECKLE_PRESS_ARCHETYPES = [
  'North Torn-Paper — a dusty-rose #d9a7a0 paper layer torn away along an irregular deckle edge (rough SVG path / jagged clip-path) revealing a plum #6b3f52 textured layer beneath; an oversized refined serif wordmark (Fraunces / Cormorant / DM Serif Display) set large or vertical across the rose field in warm cream; a subtle paper-fibre grain overlay; back: warm cream #f3ece4 stock with vertical tracked-caps labels (EMAIL / PHONE / WEBSITE), a serif name, and a small serif N&Co. monogram lockup with a thin rule',
  'Letterpress Deckle — two stacked torn-paper bands (cream over blush) split by a rough torn SVG edge, an elegant high-contrast serif headline with a soft inset/emboss shadow, a single plum accent, generous editorial margins — boutique letterpress stationery',
  'Blush Editorial — a full blush paper field with a torn corner peeling to mauve, a large serif wordmark with one italic accent word, a refined small-caps role label, hand-crafted premium warmth',
];
const PRIMARY_POP_ARCHETYPES = [
  'North Color-Block — an off-white base carved into bold geometric fields: a cobalt #2f4fe0 corner triangle, a hot-pink #ff5ea8 + tangerine #ff5a1f triangle pair, a teal #16c2c2 block, and a rising yellow #ffd21f half-sun semicircle; a heavy rounded sans wordmark (Poppins / Nunito Black / Fredoka) in cobalt with a tangerine ampersand; back: flat circular icons (pink / orange / teal) for contact and a cobalt-on-pink quarter-arc corner holding a bold N& monogram',
  'Bauhaus Playground — three primary color fields meeting at sharp diagonals with a big circle and triangle, chunky rounded sans, one playful accent dot — confident, spunky, disciplined',
  'Sunrise Pop — a large half-sun semicircle rising from the bottom in sunshine yellow, cobalt and pink corner wedges, a bold friendly sans, optimistic modern-brand energy',
];
const GILDED_EMERALD_ARCHETYPES = [
  'North Emerald Foil — deep emerald #0f3d2e stock with a large tone-on-tone embossed serif monogram watermark centered, and a metallic gold #c8a44d foil serif wordmark over it (gold gradient background-clip text + subtle emboss text-shadow) with a short gold rule; back: emerald field, a stacked serif N&Co. monogram beside a thin gold vertical rule, a cream name + gold role label, and delicate gold line-icons for contact',
  'Gilt Estate — an emerald background with a symmetrical gold-foil wordmark flanked by thin gold rules and a refined stacked monogram; quiet-luxury restraint, heavyweight foil-stamped feel',
  'Jewel & Gold — deep green with metallic gold accents, an elegant high-contrast serif, and a single large embossed initial as a background motif — private-client prestige',
];
const SAGE_STANDARD_ARCHETYPES = [
  'North Sage Split — a warm cream card with one clean vertical color-block: a solid sage #a9b39a panel holding a stacked N&Co. monogram in ink charcoal #23241f, and a cream field holding a large clean-sans name (Inter / Manrope / Jost), a tracked-caps role label, thin divider rules, and small line-icons for contact; immaculate alignment and generous white space',
  'Quiet Modern — mostly cream with a single sage accent block in one corner, a precise modern sans, wide-tracked labels, one hairline rule — architecture-studio calm',
  'Meadow Minimal — soft sage + cream, a restrained monogram, abundant negative space, one hairline accent — contemporary consultancy polish',
];

const CORPORATE_ARCHETYPES = [
  'Executive Panel Split — a deep charcoal panel meeting warm white at a crisp vertical or slightly diagonal seam, a thin metallic accent line at the junction, a tracked-caps name lockup on the light panel, a compact monogram reversed out of the dark panel',
  'Boardroom Frame — warm white stock with a precise hairline border inset, a bold grotesque wordmark anchored top-left, a single accent-color bar underscoring the name, contact details in two aligned columns separated by hairline rules',
  'Skyline Ascent — a subtle tone-on-tone abstract skyline or rising-bars motif along the bottom edge, a confident name and title hierarchy above it, one saturated accent reserved for the logo mark and contact icons',
];

const PLAYFUL_ARCHETYPES = [
  'Confetti Celebration — a warm cream canvas showered with multicolor confetti dots, squiggles, and tiny stars (inline SVG) at varied sizes and rotations, a chunky rounded wordmark in bubblegum pink #ff5ea8 with a sunshine-yellow #ffd21f offset shadow, one big tilted star or smiley badge as the hero, contact lines in a tidy rounded pill',
  'Sticker Sheet — bold sticker-style elements with thick white borders and soft drop shadows scattered across a bright single-hue field, the business name as the biggest sticker in outlined chunky letters, small supporting icon stickers (star, heart, lightning bolt), one sticker peeling at a corner',
  'Bouncy Type Party — the business name in oversized rounded letters, each glyph nudged or rotated a few degrees and filled in alternating bright colors, a low-opacity dot-grid or zigzag pattern background, one large soft blob shape anchoring a corner with contact info inside',
];

const STYLE_KEYWORD_ROUTES = [
  { test: /synthwave|retrowave|vaporwave|outrun|neon.?night|80s.?night|electric.?night/i, poster: SYNTHWAVE_POSTER_ARCHETYPES, card: SYNTHWAVE_POSTER_ARCHETYPES },
  { test: /fashion|editorial|runway|luxury.?minimal|vela|haute|lookbook|autumn.?collection/i, poster: FASHION_EDITORIAL_ARCHETYPES, card: STUDIO_CARD_ARCHETYPES },
  { test: /wpa|travel.?poster|national.?park|cascadia|vintage.?travel|retro.?illustrated|screenprint/i, poster: WPA_TRAVEL_ARCHETYPES, card: WPA_TRAVEL_ARCHETYPES },
  { test: /swiss|international.?typographic|north.?south|grid.?poster|müller|brockmann/i, poster: SWISS_EDITORIAL_ARCHETYPES, card: SWISS_EDITORIAL_ARCHETYPES },
  { test: /summit|conference|leadership|elevate|corporate.?event|gala.?premium|keynote/i, poster: SUMMIT_CORPORATE_ARCHETYPES, card: SUMMIT_CORPORATE_ARCHETYPES },
  { test: /data.?studio|dashboard.?card|metric|analytics.?card|agency.?card|pulse.?creative|marketing.?moves/i, poster: DATA_STUDIO_CARD_ARCHETYPES, card: DATA_STUDIO_CARD_ARCHETYPES },
  { test: /studio.?card|verve|creative.?studio|brand.?studio/i, poster: STUDIO_CARD_ARCHETYPES, card: STUDIO_CARD_ARCHETYPES },
  { test: /deckle|torn.?paper|blush.?editorial|letterpress/i, poster: DECKLE_PRESS_ARCHETYPES, card: DECKLE_PRESS_ARCHETYPES },
  { test: /primary.?pop|colou?r.?block.?pop|playful.?primary|bauhaus.?pop|sunrise.?pop|block.?party/i, poster: PRIMARY_POP_ARCHETYPES, card: PRIMARY_POP_ARCHETYPES },
  { test: /gilded.?emerald|emerald.?(gold|foil)|gilt|gold.?foil/i, poster: GILDED_EMERALD_ARCHETYPES, card: GILDED_EMERALD_ARCHETYPES },
  { test: /sage.?standard|sage.?(minimal|modern|split)|quiet.?modern|meadow.?minimal/i, poster: SAGE_STANDARD_ARCHETYPES, card: SAGE_STANDARD_ARCHETYPES },
  { test: /playful|whimsic|bubbly|confetti|sticker|\bfun\b/i, poster: PLAYFUL_ARCHETYPES, card: PLAYFUL_ARCHETYPES },
  { test: /corporate.?professional|executive|boardroom|\bcorporate\b.+\b(clean|modern|premium)\b/i, poster: CORPORATE_ARCHETYPES, card: CORPORATE_ARCHETYPES },
];

function pickFromStyleRoute(styleText, templateType) {
  const s = (styleText || '').toLowerCase();
  const isLargeFormat = /poster|sign/i.test(templateType || '');
  for (const route of STYLE_KEYWORD_ROUTES) {
    if (route.test.test(s)) {
      const pool = isLargeFormat ? route.poster : route.card;
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return null;
}

function getCreativityDirective(creativityLevel) {
  if (creativityLevel === 'bold') {
    return `AMBITION: PORTFOLIO BOLD — push the concept to its most memorable, confident expression. Extreme scale contrast and layered atmosphere in service of the ONE idea (still keep contact info readable). Reference bar: D&AD Yellow Pencil / Cannes Lions print winners.`;
  }
  return `AMBITION: BALANCED — award-caliber craft with strong hierarchy and readable information. Still commit to one clear idea and a real hero moment; avoid template tropes.`;
}

function validateDesignSpec(spec) {
  const issues = [];
  if (!/concept/i.test(spec)) issues.push('missing CONCEPT — no single driving idea');
  if (!/hero moment/i.test(spec)) issues.push('missing HERO MOMENT');
  if (/nav-dot|three dots|single thin rule|one vertical stripe/i.test(spec)) {
    issues.push('spec leans on template decoration patterns');
  }
  return { ok: issues.length === 0, issues };
}

/* Visible chips that ARE Phase 1 directions route straight to them — same
 * brief, same density, same asset families, no duplicate style text. Resolved
 * lazily in chooseCreativeDirection because DIRECTION_BY_KEY is defined below. */
const DIRECTION_STYLE_CHIPS = {
  'Editorial Minimal':    'editorial-minimal',
  'Modern Luxury':        'modern-luxury',
  'Bold Modernist':       'bold-modernist',
  'Clean Corporate':      'clean-corporate',
  'Elegant Serif':        'elegant-serif',
  'Organic Botanical':    'organic-botanical',
  'Soft Sophisticated':   'soft-sophisticated',
  'Colourful Expressive': 'colourful-expressive',
  'Collage Editorial':    'collage-editorial',
  'Dark Luxe':            'dark-luxe',
};

const STYLE_CHIP_MAP = {
  /* ── the visible chip set (non-direction chips) ── */
  /* aliases: the visible chip label resolves to the existing internal brief */
  'Japanese Minimal': null,   // filled below from 'Japanese Minimalism'
  'Heritage Press':   null,   // filled below from 'Deckle Press'
  'Geometric Professional': 'Geometric Professional — structure as the aesthetic: a disciplined modular grid carrying a composed system of precise geometry (a filled circle, a fine ring, a bisecting rule, a quarter-arc, a solid corner block) in two or three controlled colours — deep navy, slate, graphite, or forest with one confident accent — on white or a pale architectural grey; a modern grotesque (Inter Tight, Space Grotesk, Archivo, Manrope) with tracked-caps labels, mathematically consistent spacing, and zero ornament; engineered, credible, quietly bold',
  'Playful Contemporary': 'Playful Contemporary — colour-forward and friendly, executed like a modern brand studio: a rounded-but-adult geometric sans (Outfit, Sora, Plus Jakarta Sans, DM Sans) in confident weights; a vivid contemporary palette (coral, teal, marigold, cobalt on warm off-white) used in clean fields, arcs and soft-cornered geometric shapes; ONE warm human gesture — a smile-curve arc, an oversized ampersand, or a circular badge; polished, optimistic and completely professional: NO confetti, NO squiggles, stars or sparkles, NO sticker outlines, NO blob compositions, NO cartoon or bubble typography — nothing that reads as a kids brand',
  'Swiss Grid': 'Swiss International Style — disciplined modular grid, Space Grotesk or Barlow bold sans-serif, primary color accent on stark white or black, geometric dividing lines, precise alignment',
  'Neo-Brutalism': 'Neo-Brutalism — ultra-heavy Archivo Black or Anton type at dramatic scale, asymmetric raw layout, diagonal or offset text blocks, extreme value contrast, bold background color blocks',
  'Art Deco': 'Art Deco Revival — Cinzel or Josefin Sans type; a RICH, layered Deco environment: radiating sunburst/fan rays, stepped ziggurat and chevron forms, a repeating geometric pattern field, metallic gold (#c9a84c) gradients on black or deep jewel tones, ornate corner fans and framing — opulent and detailed, NEVER just a thin border on empty black',
  'Memphis Bold': 'Memphis Design — Unbounded or Righteous type, bold triangles/circles/zigzag shapes in contrasting saturated colors (coral, cobalt, yellow, mint), energetic asymmetric composition',
  'Japanese Minimalism': 'Japanese Minimalism — DM Sans or Noto Sans JP, extreme negative space, one restrained accent color on near-white or deep charcoal, ultra-light type weights, immaculate spacing',
  'Dark Tech': 'Dark Tech / Cinematic — Rajdhani or Exo 2 type, deep black background, electric cyan or vivid accent color, geometric circuit-line details, bold spaced-caps hierarchy',
  'Organic Modernism': 'Organic Modernism — Nunito or Quicksand rounded type, large biomorphic blob shapes in terracotta/sage/warm cream, fluid asymmetric layering, nature-inspired warmth',
  'Retro-Futurism': 'Retro-Futurism — Orbitron or Oxanium type, warm amber and deep navy gradient, concentric arc or ring motifs, bold condensed retro-space aesthetic, chrome-gradient accents',
  'Psychedelic Modernism': 'Psychedelic Modernism — 1960s liquid-poster energy reimagined: melting, warping groovy display lettering that flows and bends around the composition, kaleidoscopic radial symmetry, swirling liquid-marble and paisley forms, hyper-saturated clashing palette (electric violet, hot magenta, acid lime, tangerine), concentric rippling colour bands, trippy op-art motion, Righteous or Rubik Mono display type',
  'Vaporwave': 'Vaporwave — dreamy pastel gradient wash (miami pink #ff6ad5 + electric cyan #26d0ce + soft lavender) over twilight purple, a Greek marble statue bust as hero motif, VHS scanlines with RGB glitch offset, Japanese katakana accent text, neon grid horizon with a low sun, mixed type (wide Righteous display + Space Mono labels), 80s-mall retro-computing nostalgia',
  'Y2K Chrome': 'Y2K Chrome — liquid-metal 3D chrome headline lettering with glossy reflections, iridescent holographic gradient (silver → violet → aqua), blobby bubble shapes and star-sparkle glints, lens-flare highlights, early-2000s tech-optimism, wide futuristic type (Michroma or Orbitron), high-shine glassy surfaces',
  'Pop Art Comic': 'Pop Art Comic — Lichtenstein / Warhol energy: Ben-Day halftone dot fields, thick black comic outlines, primary POW palette (comic red #e63946, cyan, sunshine yellow), explosive starburst and speech-bubble callouts, ultra-bold condensed comic type (Bangers or Anton), screen-print misregistration, high-impact and playful',
  'Cosmic Celestial': 'Cosmic Celestial — deep-space vertical gradient (midnight indigo #0b0b2d → violet), glowing nebula clouds and a scatter of stars with delicate constellation lines, luminous gold and silver foil accents, elegant high-contrast serif (Cinzel or Cormorant) with airy tracking, a crescent-moon or radiant sun-ring motif, mystical premium astral atmosphere',
  'Street Graffiti': 'Street Graffiti — raw urban wall energy: spray-paint texture and paint drips, bold wildstyle tag lettering with hard outlines and highlights, high-contrast colour on concrete grey or brick, stencil and torn-wheatpaste poster layers, marker-scrawl accents, halftone spray shading, rebellious hand-style craft',
  'Urban Industrial': 'Urban Industrial — Bebas Neue or Barlow Condensed type, dark grey and concrete palette, offset asymmetric grid, bold stencil-style headline, sharp geometric cut shapes',
  'Luxury Maximalism': 'Luxury Maximalism — Abril Fatface or Fraunces display type, opulent jewel tones (deep emerald, burgundy, sapphire), heavy decorative geometric shapes, layered theatricality',
  'Bauhaus Constructivism': 'Bauhaus Constructivism — IBM Plex Sans or Work Sans, primary color geometry (red, blue, yellow, black), strict orthogonal grid, architectural precision, functional modernism',
  'Dark Glamour': 'Dark Glamour — Oswald or Montserrat Bold type, deep oxblood or midnight navy background, metallic gold accent, high-contrast bold typographic hierarchy',
  'Bold Geometric': 'Bold Geometric Corporate — Barlow or Space Grotesk, diagonal color-block composition splitting the canvas, bold primary colors, white type reversed out on saturated fields',
  'Coastal Minimalism': 'Coastal Minimalism — Karla or Raleway Light type, deep ocean blue and warm sand, airy negative space, clean organic shapes, light atmospheric freshness',
  'Synthwave Neon': 'Synthwave / Retrowave — layered neon atmosphere on near-black (#0a0a1a), hot pink #ff2d95 + cyan #00f5ff + electric purple, chrome-gradient 3D headlines with multi-layer text-shadow glow, perspective grid floor, striped sunset sun, palm/pier silhouettes, mixed fonts (Orbitron + Pacifico script + Bebas badge type), VHS scanlines',
  'Fashion Editorial': 'High-Fashion Editorial — cream #f5f0e8 canvas, ultra-wide tracked serif brand mark, asymmetric photo crop with architectural framing, italic collection lines, thin tan rule separators, 70%+ whitespace, DM Serif Display + Jost pairing, vertical edge type',
  'WPA Travel': 'WPA / Vintage Travel Poster — flat illustrated depth layers, limited earthy palette (forest #2d5016, rust #c45c3e, cream #faf6ed, teal), double border frame, embossed serif titles, script accents, compass/emblem details, paper grain texture, National Parks poster energy',
  'Swiss Exhibition': 'Swiss International Typographic — strict grid, tall condensed sans (Barlow Condensed or Oswald), 2-color discipline (black + one saturated accent like #e63946), geometric primitives (circle, triangle, stripe block, square anchor), monumental type scale, mathematical spacing',
  'Event Summit': 'Premium Leadership Summit — navy #0a1628 + metallic gold gradient, curved gold-bordered photo portal, nested triangle depth motifs, serif+sans hierarchy, calendar/location icon rows with gold rules, B2B luxury event branding',
  'Data Studio': 'Data-Driven Creative Studio — navy dashboard UI aesthetic, lime or orange accent on dark field, metric blocks, sparkline/bar chart SVG as primary art, monospace numbers, diagonal agency split layouts, marketing analytics as visual identity',
  'Creative Studio': 'Boutique Creative Studio — cream canvas, oversized cropped serif wordmark bleeding off edge, terracotta/dusty rose accents, diagonal rule separators, three-column back grid, warm earthy palette, collectible stationery quality',
  'Deckle Press': 'Torn-Paper Editorial — a refined display serif (Fraunces, Cormorant, or DM Serif Display) as an oversized vertical or cropped wordmark; a soft tactile palette of dusty rose #d9a7a0 + mauve/plum #6b3f52 + warm cream #f3ece4; the hero is a torn/deckle paper edge (irregular clip-path or rough SVG path) dividing two paper textures, with a subtle fibre-grain overlay; elegant editorial composition, generous margins, a small serif monogram and thin rules; boutique letterpress-studio feel — soft, premium, hand-crafted, never digital',
  'Primary Pop': 'Playful Primary Color-Block — a bold rounded geometric sans (Poppins, Nunito Black, Fredoka, or Outfit) in heavy weight; a bright saturated palette of cobalt #2f4fe0 + hot pink #ff5ea8 + tangerine #ff5a1f + teal #16c2c2 + sunshine yellow #ffd21f on off-white; the canvas is divided into bold geometric color fields (triangles, a rising-sun semicircle, quarter-arcs) meeting at clean diagonals, with simple circular icons and a friendly ampersand accent; energetic, spunky, optimistic Bauhaus-pop — fun but disciplined',
  'Gilded Emerald': 'Emerald & Gold Foil — a high-contrast serif (Cormorant, Playfair Display, or Bodoni Moda); a deep emerald #0f3d2e background with metallic gold #c8a44d foil accents (gold gradient text-fill + subtle emboss via text-shadow); a large tone-on-tone embossed monogram watermark behind a centered gold wordmark, thin gold rules and a refined stacked serif monogram; restrained, symmetrical, opulent quiet-luxury — the feel of foil-stamped heavyweight stock, jeweler / private-client premium',
  'Corporate Professional': 'Executive Corporate — a confident modern grotesque (Barlow, Space Grotesk, Archivo, or IBM Plex Sans) with tracked-caps labels; a refined businesslike palette of deep charcoal #23272e + warm white + ONE considered accent (a deep professional blue #1f4e79, steel teal #2a7f8f, oxford burgundy #701f28, or brass #c9a84c) — premium and boardroom-credible, the accent chosen for this business rather than by reflex; a disciplined grid with one architectural gesture (a vertical accent band, a sharp diagonal seam, or a precise corner-bracket frame), thin hairline rules, a compact monogram lockup, and generous structured whitespace; polished, authoritative, Fortune-500 annual-report craft',
  'Playful': 'Playful & Fun — a chunky rounded sans (Fredoka, Baloo 2, Nunito Black, or Poppins) with a bouncy friendly personality; a bright happy palette (sunshine yellow #ffd21f, bubblegum pink #ff5ea8, sky blue #3aa0ff, tangerine #ff5a1f, mint #4cd6b0) on warm off-white; sticker-style graphics with bold outlines and soft shadows, confetti dots, squiggles, zigzags, stars, and blob shapes placed with intent; gently tilted headline energy and an oversized friendly ampersand or badge motif; joyful, energetic, kid-at-heart charm — fun but composed, never chaotic',
  'Sage Standard': 'Clean Sage Minimal — a precise modern sans (Inter, Manrope, Work Sans, or Jost) with wide-tracked labels; a calm muted palette of soft sage #a9b39a + warm cream #f4f1e8 + ink charcoal #23241f; a clean color-block split (a solid sage panel meeting cream) with a stacked N&Co. monogram, thin divider rules and small tracked-caps labels; abundant white space, immaculate alignment, one restrained accent — contemporary, confident, corporate-modern calm',
};STYLE_CHIP_MAP['Japanese Minimal'] = STYLE_CHIP_MAP['Japanese Minimalism'];
STYLE_CHIP_MAP['Heritage Press'] = STYLE_CHIP_MAP['Deckle Press'];


function expandStyleDirection(styleDirection) {
  const trimmed = (styleDirection || '').trim();
  if (!trimmed) return trimmed;
  return STYLE_CHIP_MAP[trimmed] || trimmed;
}

/* ── DESIGN DENSITY ────────────────────────────────────────────────────────
 *
 * How much graphic material a piece carries is a property of the DIRECTION,
 * not a house rule. An editorial-minimal card with three elements and real
 * whitespace is finished work; the same card judged against a "4–6 elements"
 * floor would be marked a failure and padded until it stopped being editorial
 * minimal. That floor is why every direction used to arrive looking layered
 * and loud. Each direction now names its own contract and the prompts follow
 * it — print fit, hierarchy, bleed and legibility rules are untouched and
 * apply identically at every density. */
const DENSITY_CONTRACTS = {
  restrained: `DESIGN DENSITY — RESTRAINED (this direction's contract):
- Few elements, chosen precisely. Typically 1–3 graphic elements beyond the type. More would weaken it.
- Whitespace is the material, not leftover space — compose it deliberately: asymmetric margins, a considered optical centre, real tension between the mark and the field.
- The typography IS the design. Scale, weight and tracking carry the piece; a single hairline rule, one small mark, or one quiet field is enough support.
- A flat or near-flat ground is CORRECT here. Do not add gradients, patterns or layered fields to reach a quota.
- Judge it by craft and confidence, not by how much is on the card.`,

  balanced: `DESIGN DENSITY — BALANCED (this direction's contract):
- A composed environment without crowding. Typically 2–4 graphic elements beyond the type, each earning its place.
- The ground may be a single considered colour, a soft two-field split, or one restrained texture — whichever the direction calls for.
- One clear hero moment, a real hierarchy, and enough breathing room that every element reads.`,

  rich: `DESIGN DENSITY — RICH (this direction's contract):
- A fully designed environment: a layered ground (2+ fields, gradient, pattern, or texture) and 4–6 integrated graphic elements.
- Every layer serves the ONE concept — cohesive richness, never decoration for its own sake.
- Dramatic scale contrast and confident, expressive typography.`,
};

/* ── The default direction pool ────────────────────────────────────────────
 *
 * ONE seed per generation, drawn from a deliberately broad set. The previous
 * default drew TWO independent random picks — a style and an unrelated bold
 * archetype — and concatenated them, so a calm style arrived with a loud
 * archetype stapled on and the model resolved the conflict toward whichever
 * half was more concrete. That is gone: a direction is a single, coherent
 * brief.
 *
 * The set spans light and dark, restrained and maximal, serif and sans, warm
 * and cool. Retro-futurist/technical and dark luxe are each ONE legitimate
 * option among twelve — reachable when drawn or asked for, never the house
 * personality. */
const DESIGN_DIRECTIONS = [
  {
    key: 'editorial-minimal', density: 'restrained',
    brief: 'Editorial Minimal — the discipline of a well-set magazine page: a warm off-white or soft paper ground, one restrained accent, and a precise modern sans or a quiet text serif (Inter, Jost, Karla, Söhne-like grotesques, or a calm serif) used at two or three sizes only; wide-tracked small caps for labels, one hairline rule as the entire ornament, generous asymmetric margins, immaculate alignment; the composition is carried by typographic scale and confident empty space rather than by graphics',
  },
  {
    key: 'modern-luxury', density: 'restrained',
    brief: 'Modern Luxury — quiet expensive restraint: a refined high-contrast serif or an elegant light grotesque wordmark set with generous tracking, a small precise monogram or mark, and one considered accent treatment (a tonal deboss, a soft metallic, or a single deep hue) on ivory, bone, warm stone, or a deep tonal ground; thin rules, symmetrical or gently offset balance, abundant margin; the luxury reads as material and spacing, not as ornament',
  },
  {
    key: 'bold-modernist', density: 'rich',
    brief: 'Bold Modernist / Geometric — Swiss and Bauhaus lineage brought forward: a strict modular grid, a heavy modern grotesque (Space Grotesk, Archivo, Barlow, Work Sans) at decisive scale, and a compositional system of pure geometry — a filled circle, a hard rectangle, a quarter-arc, a bold bar — in a tightly limited palette of two or three colours on white, off-white, or one saturated field; mathematical spacing, deliberate asymmetry, zero decorative fluff',
  },
  {
    key: 'playful-contemporary', density: 'rich',
    brief: 'Playful Contemporary — bright and friendly with real craft: a chunky rounded sans (Fredoka, Poppins, Nunito Black, Baloo 2), a happy saturated palette (sunshine yellow, bubblegum pink, sky blue, tangerine, mint) on warm off-white, sticker-style shapes with soft shadows, confetti dots, squiggles and stars placed with intent, a gently tilted headline and one oversized friendly mark; joyful and energetic, composed rather than chaotic',
  },
  {
    key: 'organic-botanical', density: 'balanced',
    brief: 'Organic / Botanical — a natural, hand-touched calm: sage, terracotta, clay, oat, and warm cream; delicate botanical line art (a leaf, a stem, a seed head) or a soft biomorphic shape as the motif; a humanist sans or a gentle rounded serif (Nunito, Quicksand, Lato, or a soft old-style serif), fluid asymmetric placement, and a paper-warm ground; wellness, artisan, and studio-florist warmth without kitsch',
  },
  {
    key: 'elegant-serif', density: 'restrained',
    brief: 'Elegant Serif — classical typographic poise: a beautiful high-contrast serif (Cormorant, Playfair Display, EB Garamond, Bodoni Moda, Fraunces, or DM Serif Display) as an unhurried wordmark, small-caps or italic supporting lines, hairline rules above and below the name, and a cream, ivory, or soft ink ground; symmetrical or classically balanced, generous leading, nothing hurried and nothing extra — the letterforms are the design',
  },
  {
    key: 'clean-corporate', density: 'restrained',
    brief: 'Clean Corporate — credible, structured, and genuinely modern: a confident grotesque (Inter, Manrope, IBM Plex Sans, Barlow, Archivo) with tracked-caps labels, a disciplined grid, hairline dividers, and ONE considered accent — a professional blue is entirely welcome here, as are steel teal, deep green, burgundy, or warm graphite; one architectural gesture only (a vertical accent band, a crisp seam, or a corner-bracket frame), aligned contact detail, and generous structured whitespace; boardroom-credible without being cold or template-like',
  },
  {
    key: 'colourful-expressive', density: 'rich',
    brief: 'Colourful Expressive — confident colour as the whole idea: three to five saturated hues meeting in bold fields, arcs, or diagonal bands, a heavy contemporary grotesque (Space Grotesk, Archivo Black, Barlow, Inter Tight) at decisive scale, knocked-out type on colour, and one unexpected chromatic pairing that makes the piece memorable; energetic, modern and ADULT — sharp geometry and strict alignment, no rounded cartoon type, no dots, squiggles, stars or blob shapes; the colour reads as intentional editorial confidence, never as a kids\' brand',
  },
  {
    key: 'collage-editorial', density: 'rich',
    brief: 'Collage / Editorial — a cut-and-pasted print sensibility: overlapping paper and photographic fragments with rough torn or cut edges, a mixture of two or three type personalities at contrasting sizes, tape, stamp, or margin-note accents, and a muted printed palette (newsprint grey, ink black, faded red, oat) with one bright interruption; layered and tactile, arranged with an editor\'s eye rather than scattered',
  },
  {
    key: 'soft-sophisticated', density: 'restrained',
    brief: 'Soft Sophisticated — low-contrast and quietly premium: a muted palette of blush, greige, sand, oat, dusty clay, or pale sage with tone-on-tone layering; a light modern sans or a delicate serif at modest scale, wide tracking, and very little else — one soft shape, one hairline, or one gentle field edge; the ground and the type sit close in value so the piece feels calm, tactile, and expensive; nothing shouts',
  },
  {
    key: 'dark-luxe', density: 'balanced',
    brief: 'Dark Luxe — depth and restraint on a dark ground: near-black, deep ink, forest, aubergine, or oxblood, with ONE refined accent (a soft metallic, bone, or a single jewel hue) used sparingly; an elegant serif or a precise light grotesque reversed out, generous margin, a small monogram or a single tonal motif; the darkness is the luxury — resist filling it, and never let the accent become the whole card',
  },
  {
    key: 'retro-futurist', density: 'rich',
    brief: 'Retro-Futurist / Technical — deliberate 70s–80s forward-look: geometric technical type (Orbitron, Oxanium, Exo 2, Space Mono), concentric arcs, ring motifs, or a perspective grid, a chrome or gradient treatment on the wordmark, and a palette built from a deep ground with one electric or warm-metal accent; confident retro-space engineering — used when the business genuinely calls for it',
  },
];

const DIRECTION_BY_KEY = DESIGN_DIRECTIONS.reduce((m, d) => { m[d.key] = d; return m; }, {});

/* Directions AUTO may draw when the user chose nothing. Playful Contemporary
 * is deliberately absent: its chunky rounded type, confetti dots, squiggles
 * and blob shapes read as a kids' brand, which no business should receive
 * UNASKED. It stays fully reachable through the explicit routes — the
 * "Playful" style chip and any typed playful/fun/kids style direction — where
 * the user actually wants that language. */
const DEFAULT_DIRECTION_POOL = DESIGN_DIRECTIONS
  .filter((d) => d.key !== 'playful-contemporary')
  .map((d) => d.key);

/* Added to an intent-narrowed pool on large format only: bold but professional
 * concepts with visibly different layout languages. */
const LARGE_FORMAT_EXTRA_DIRECTIONS = ['bold-modernist', 'colourful-expressive', 'collage-editorial'];

/* Register alternation for large-format DEFAULTS. The soft register is where
 * the sameness lives — beige/cream grounds, sage-and-rust, elegant serif
 * luxury. One soft design is a fine choice; two in a row is the monotony the
 * user sees. After a soft draw, the next default large-format draw for the
 * same brief comes from the bold register (and a bold draw prefers, but does
 * not force, a change of register the other way). */
const SOFT_REGISTER_DIRECTIONS = ['editorial-minimal', 'soft-sophisticated', 'elegant-serif',
  'organic-botanical', 'clean-corporate', 'modern-luxury'];
const lastLargeFormatRegister = new Map();

function alternateRegister(candidates, memoryKey) {
  const lastSoft = lastLargeFormatRegister.get(memoryKey);
  if (lastSoft !== true) return candidates;
  const bold = candidates.filter((k) => SOFT_REGISTER_DIRECTIONS.indexOf(k) === -1);
  return bold.length ? bold : candidates;
}

function pickDirection(keys) {
  const pool = (keys && keys.length)
    ? keys.map((k) => DIRECTION_BY_KEY[k]).filter(Boolean)
    : DESIGN_DIRECTIONS;
  const from = pool.length ? pool : DESIGN_DIRECTIONS;
  return from[Math.floor(Math.random() * from.length)];
}

/* ── Generic words carry intent ────────────────────────────────────────────
 *
 * "professional", "clean", "modern", "minimal", "elegant", "classic",
 * "corporate" used to be matched by GENERIC_STYLE and DISCARDED — the request
 * was replaced by a random draw from the full pool, so "elegant" could return
 * a primary-colour block party. These words are not empty: each names a real
 * region of the design space. They now narrow the draw to directions that
 * actually mean what was asked, and the draw stays random WITHIN that region
 * so two runs of the same word still differ. */
const GENERIC_INTENT = [
  { test: /\b(minimal|minimalist|simple|clean)\b/i,
    keys: ['editorial-minimal', 'clean-corporate', 'soft-sophisticated', 'modern-luxury'] },
  { test: /\b(elegant|classic|classical|timeless|refined|sophisticated)\b/i,
    keys: ['elegant-serif', 'modern-luxury', 'soft-sophisticated', 'editorial-minimal'] },
  { test: /\b(legal|law|attorney|counsel|litigation|barrister|solicitor)\b/i,
    keys: ['elegant-serif', 'clean-corporate', 'modern-luxury', 'dark-luxe'] },
  { test: /\b(corporate|professional|business|executive)\b/i,
    keys: ['clean-corporate', 'modern-luxury', 'editorial-minimal', 'bold-modernist'] },
  { test: /\b(modern|contemporary)\b/i,
    keys: ['bold-modernist', 'clean-corporate', 'editorial-minimal', 'colourful-expressive'] },
];

function intentKeysFor(text) {
  const t = (text || '').trim();
  if (!t) return null;
  for (const rule of GENERIC_INTENT) {
    if (rule.test.test(t)) return rule.keys;
  }
  return null;
}

/* Density for an EXPLICITLY chosen style. Unlisted styles get 'balanced' —
 * a middle that suits most, rather than the old universal maximalist floor. */
const CHIP_DENSITY = {
  'Japanese Minimal': 'restrained', 'Heritage Press': 'restrained',
  'Geometric Professional': 'balanced', 'Playful Contemporary': 'balanced',
  'Japanese Minimalism': 'restrained', 'Coastal Minimalism': 'restrained',
  'Sage Standard': 'restrained', 'Corporate Professional': 'restrained',
  'Fashion Editorial': 'restrained', 'Deckle Press': 'restrained',
  'Gilded Emerald': 'restrained', 'Swiss Grid': 'balanced',
  'Organic Modernism': 'balanced', 'Bauhaus Constructivism': 'balanced',
  'Bold Geometric': 'balanced', 'Dark Glamour': 'balanced',
  'Art Deco': 'rich', 'Memphis Bold': 'rich', 'Neo-Brutalism': 'rich',
  'Luxury Maximalism': 'rich', 'Synthwave Neon': 'rich', 'Vaporwave': 'rich',
  'Y2K Chrome': 'rich', 'Pop Art Comic': 'rich', 'Psychedelic Modernism': 'rich',
  'Cosmic Celestial': 'rich', 'Street Graffiti': 'rich', 'Urban Industrial': 'rich',
  'Dark Tech': 'rich', 'Retro-Futurism': 'rich', 'Data Studio': 'rich',
  'Primary Pop': 'rich', 'Playful': 'rich', 'Creative Studio': 'balanced',
  'WPA Travel': 'rich', 'Swiss Exhibition': 'balanced', 'Event Summit': 'balanced',
};

/* ── DESIGN ASSET LIBRARY (Phase 2A) ───────────────────────────────────────
 *
 * 80 audited PNGs live in generator/assets/design-library/ and are described by
 * generator/assets/design-asset-manifest.json. This picks AT MOST a couple of
 * them for a generation, or — often — none at all.
 *
 * Three rules shape everything below:
 *
 *   1. An asset REPLACES a generated decorative element. It is not an extra.
 *      The density contract already says how much may be on the canvas; using
 *      an asset spends one of those slots, and the prompt says so explicitly.
 *   2. Selection is by FAMILY first, then a file inside it. The library is
 *      ~18 ideas in 80 files (five watercolour washes, four blobs, three
 *      tapes…), so picking files directly would keep producing the same idea
 *      in a different colour.
 *   3. Plenty of generations must use nothing. A restrained direction is
 *      usually finished without one, and forcing an asset in to create variety
 *      is exactly the over-decoration this is meant to avoid.
 *
 * The whole-direction rotation from Phase 1 remains the primary variety system.
 * Nothing here changes it. */

/* Which families each direction may draw from, in preference order. A direction
 * absent from this table gets no assets at all. */
const DIRECTION_ASSET_FAMILIES = {
  'editorial-minimal':    ['texture-neutral', 'gold-frame'],
  'modern-luxury':        ['gold-frame', 'ring-frame', 'texture-neutral'],
  'elegant-serif':        ['gold-frame', 'ring-frame', 'texture-neutral'],
  'soft-sophisticated':   ['watercolour-wash', 'texture-neutral', 'botanical-spray'],
  'organic-botanical':    ['botanical-spray', 'watercolour-wash', 'texture-neutral', 'flat-blob'],
  'collage-editorial':    ['torn-paper', 'tape', 'brushstroke', 'texture-neutral'],
  'bold-modernist':       ['geometric-solid', 'geometric-system', 'brushstroke'],
  'playful-contemporary': ['flat-blob', 'doodle', 'geometric-solid'],
  /* Geometry and paint only: the blob and doodle families belong to the
     explicitly-requested playful language, not to default colour. */
  'colourful-expressive': ['geometric-solid', 'brushstroke'],
  'dark-luxe':            ['gold-frame', 'ring-frame', 'texture-neutral'],
  'retro-futurist':       ['glossy-3d', 'geometric-system', 'texture-neutral'],
  /* Clean Corporate is deliberately near-empty: a considered texture at most,
   * and usually nothing. A corporate card earns its credibility from the grid
   * and the typography, not from decoration. */
  'clean-corporate':      ['texture-neutral'],
};

/* How likely an asset is at all, and how many. Read as cumulative thresholds
 * against one random draw. The counts are the brief's own words: restrained
 * usually none and never more than one; balanced none or one, occasionally two;
 * rich one or two, three only rarely. */
const ASSET_BUDGET = {
  restrained: { none: 0.45, split: [1.00, 0, 0],       max: 1 },
  balanced:   { none: 0.20, split: [0.80, 0.20, 0],    max: 2 },
  rich:       { none: 0.10, split: [0.45, 0.40, 0.15], max: 3 },
};
/* Clean Corporate and Editorial Minimal stay the quietest two, because they are
 * where decoration most easily cheapens the result — but "quietest" now means
 * roughly half the time, not almost never. */
const ASSET_NONE_OVERRIDE = { 'clean-corporate': 0.60, 'editorial-minimal': 0.50 };

/* When a stock photograph is the hero, decoration steps back. Only these three
 * families may still appear, and only one of them: a quiet ground or an edge
 * treatment that a photograph can live inside. Everything loud — blobs,
 * brushstrokes, tape, doodles, florals, glossy 3D — is suppressed outright. */
const PHOTO_SAFE_ASSET_FAMILIES = ['texture-neutral', 'gold-frame', 'ring-frame'];

/* Large format is a different problem. A poster, sign or banner is read from
 * across a room and has canvas to spare, so a real piece of visual material is
 * almost always the right answer there — where a business card is often better
 * with nothing but type. The counts and the compatibility rules are identical;
 * only the chance of drawing nothing changes. */
const LARGE_FORMAT_FOR_ASSETS = /poster|sign|banner|decal|magnet/i;
const LARGE_FORMAT_NONE_CEILING = 0.08;
/* Long edge, in inches, at or above which a piece is treated as large format
 * whatever the Template Type says. This matters on web03: the live
 * designCentral-dev catalogue deliberately carries no productFamily, so
 * selecting a real sign never changes the Template Type away from Business
 * Card — the geometry is the only honest signal that it is a sign. A business
 * card is 3.5in; the smallest thing anyone would call a sign is far above 8. */
const LARGE_FORMAT_MIN_INCHES = 8;

function isLargeFormatForAssets(templateType, widthIn, heightIn) {
  if (LARGE_FORMAT_FOR_ASSETS.test(templateType || '')) return true;
  const longest = Math.max(Number(widthIn) || 0, Number(heightIn) || 0);
  return longest >= LARGE_FORMAT_MIN_INCHES;
}

/* A gated family is only reachable when the brief actually asks for it. */
const GATED_FAMILY_TRIGGERS = {
  'floral-cluster': /floral|flower|peony|hydrangea|botanic|wedding|bridal|florist|garden|bouquet/i,
  'figurative':     /portrait|figure|face|classical|bust|sculpture|editorial|fashion|gallery|art\b/i,
  'promo':          /promo|sale|discount|burst|badge|offer|market|clearance/i,
  'postal':         /postal|stamp|vintage|travel|archive|philatel/i,
  'newsprint':      /newsprint|newspaper|collage|zine|cut.?up|editorial/i,
};

let assetLibrary = null;          // { assets, byFamily } once loaded
let assetLibraryLoading = null;   // in-flight promise, so it loads once
let assetLibraryError = null;     // why it is not loaded, for the DEV indicator

/* ONE small JSON, ONCE. ~70 KB of metadata, parsed a single time and held for
 * the life of the page; selection then reads that object and nothing else. No
 * PNG is opened, listed, hashed or downloaded to choose one — the image itself
 * loads only when the generated preview renders it, like any other <img>.
 *
 * A FAILURE IS NOT CACHED. The first version stored an empty library on any
 * error, so one blocked request disabled the library for the rest of the
 * session and every generation afterwards silently said "no asset". */
function loadAssetLibrary() {
  if (assetLibrary) return Promise.resolve(assetLibrary);
  if (assetLibraryLoading) return assetLibraryLoading;
  assetLibraryLoading = fetch('assets/design-asset-manifest.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((doc) => {
      const byFamily = {};
      (doc.assets || []).forEach((a) => { (byFamily[a.family] = byFamily[a.family] || []).push(a); });
      assetLibrary = { assets: doc.assets || [], byFamily: byFamily };
      assetLibraryError = null;
      assetLibraryLoading = null;
      return assetLibrary;
    })
    .catch((e) => {
      /* Never fail a generation over decoration — but say why, and allow the
         next generation to try again. */
      assetLibraryError = (e && e.message) || 'manifest unavailable';
      assetLibraryLoading = null;
      console.warn('[generator] design asset library unavailable: ' + assetLibraryError);
      return { assets: [], byFamily: {} };
    });
  return assetLibraryLoading;
}

/* Warm it at page load so Generate never waits on the network for it. */
if (typeof window !== 'undefined') {
  try { loadAssetLibrary(); } catch (e) { /* ignore */ }
}

/* Families used by the last generations of THIS brief, so a Regenerate does not
 * come back with the same idea in a different colour. */
const recentAssetFamilies = new Map();
const ASSET_FAMILY_MEMORY = 3;

function assetCountFor(density, directionKey, largeFormat) {
  const b = ASSET_BUDGET[density] || ASSET_BUDGET.balanced;
  let none = ASSET_NONE_OVERRIDE[directionKey] !== undefined
    ? ASSET_NONE_OVERRIDE[directionKey] : b.none;
  if (largeFormat) { none = Math.min(none, LARGE_FORMAT_NONE_CEILING); }

  const r = Math.random();
  if (r < none) return 0;
  /* The remaining probability is shared between one, two and three assets by
     the density's own split, so changing how often nothing is drawn never
     changes the RATIO of one to two to three — and never the maximum. */
  let acc = none;
  for (let i = 0; i < b.split.length; i++) {
    acc += (1 - none) * b.split[i];
    if (r < acc || i === b.split.length - 1) return Math.min(i + 1, b.max);
  }
  return Math.min(1, b.max);
}

function gatedFamilyAllowed(family, brief) {
  const re = GATED_FAMILY_TRIGGERS[family];
  return re ? re.test(brief || '') : true;
}

/* The families this brief may draw from, most preferred first, with the ones
 * used recently for this same brief pushed to the back. */
function candidateFamilies(directionKey, brief, memoryKey) {
  const base = (DIRECTION_ASSET_FAMILIES[directionKey] || []).slice();
  /* A brief that names a gated family goes to the FRONT, not the back: the user
     asked for it, and with a budget of one asset anything appended after the
     direction's own preferences would never be reached. */
  Object.keys(GATED_FAMILY_TRIGGERS).forEach((f) => {
    if (!gatedFamilyAllowed(f, brief)) return;
    const at = base.indexOf(f);
    if (at !== -1) base.splice(at, 1);
    base.unshift(f);
  });
  const usable = base.filter((f) => gatedFamilyAllowed(f, brief));
  const recent = recentAssetFamilies.get(memoryKey) || [];
  const fresh = usable.filter((f) => recent.indexOf(f) === -1);
  return fresh.length ? fresh : usable;
}

/* DEV override, read at selection time. 'auto' is the shipped behaviour;
   'force' takes a compatible asset whenever one exists; 'off' takes none. */
function assetMode() {
  const m = (typeof window !== 'undefined' && window.SMPAssetMode) || 'auto';
  return (m === 'force' || m === 'off') ? m : 'auto';
}

/* Why the last selection came back empty. Reported in the DEV indicator so a
   blocked manifest is never mistaken for "the engine chose nothing". */
let lastAssetReason = '';

function pickAssets(directionKey, density, brief, memoryKey, doubleSided, templateType,
    widthIn, heightIn, photoSelected, logoSelected) {
  lastAssetReason = '';
  const mode = assetMode();
  if (mode === 'off') { lastAssetReason = 'asset mode is No Asset'; return []; }

  const lib = assetLibrary;
  /* The failure reason comes first: after a failed load there is no library
     object at all, and reporting "still loading" would hide a blocked manifest
     behind something that sounds temporary. */
  if (assetLibraryError && (!lib || !lib.assets.length)) {
    lastAssetReason = 'library did not load (' + assetLibraryError + ')';
    return [];
  }
  if (!lib) { lastAssetReason = 'library still loading'; return []; }
  if (!lib.assets.length) { lastAssetReason = 'library is empty'; return []; }
  if (/stamp/i.test(templateType || '')) { lastAssetReason = 'stamps use no assets'; return []; }
  if (!DIRECTION_ASSET_FAMILIES[directionKey]
      && !Object.keys(GATED_FAMILY_TRIGGERS).some((f) => gatedFamilyAllowed(f, brief))) {
    lastAssetReason = 'no families are compatible with this direction';
    return [];
  }
  const large = isLargeFormatForAssets(templateType, widthIn, heightIn);
  let want = mode === 'force'
    ? Math.max(1, assetCountFor(density, directionKey, large))
    : assetCountFor(density, directionKey, large);
  /* A stock photograph is a major visual element. It never stacks with loud
     decoration: at most ONE quiet texture or frame may join it. */
  if (photoSelected) want = Math.min(want, 1);
  /* A brand mark consumes a signature-element slot: it never ADDS to the
     decoration, so the asset budget gives one slot up to it. */
  if (logoSelected) want = Math.min(want, photoSelected ? 1 : 2);
  /* A generation that uses nothing must NOT wipe the memory — otherwise the run
     after it is free to repeat the family used two runs ago. */
  if (!want) { lastAssetReason = 'the density contract drew none this time'; return []; }

  let families = candidateFamilies(directionKey, brief, memoryKey);
  if (photoSelected) {
    families = families.filter((f) => PHOTO_SAFE_ASSET_FAMILIES.indexOf(f) !== -1);
    if (!families.length) {
      lastAssetReason = 'a stock photo is the hero and no quiet family suits this direction';
      return [];
    }
  }
  const chosen = [];
  const usedFamilies = [];
  for (const family of families) {
    if (chosen.length >= want) break;
    const pool = (lib.byFamily[family] || []).filter((a) => {
      if (!doubleSided && a.preferred_side === 'back') return false;
      return true;
    });
    if (!pool.length) continue;
    /* Two assets must not do the same job — the second one has to earn its
       place by being a different kind of thing. */
    chosen.push(pool[Math.floor(Math.random() * pool.length)]);
    usedFamilies.push(family);
  }
  if (!chosen.length) {
    lastAssetReason = 'no asset in the compatible families fitted this product';
  }
  if (chosen.length) {
    const recent = recentAssetFamilies.get(memoryKey) || [];
    recentAssetFamilies.set(memoryKey,
      usedFamilies.concat(recent.filter((f) => usedFamilies.indexOf(f) === -1))
        .slice(0, ASSET_FAMILY_MEMORY));
  }
  return chosen;
}

/* Only the chosen assets reach the model — never the library. */
function renderAssetBlock(assets, density) {
  if (!assets.length) return '';
  const budget = { restrained: '1–3', balanced: '2–4', rich: '4–6' }[density] || '2–4';
  const lines = assets.map((a) => {
    const behind = a.card_background_safe
      ? `MAY sit behind text, at no more than ${Math.round(a.behind_text_max_opacity * 100)}% opacity, and only if every line stays crisply legible`
      : 'must NOT sit behind text — keep it in a corner, at an edge, in a margin, or in its own clear zone';
    return `- ${a.filename}\n`
      + `    use as: ${a.family_role}\n`
      + `    src: ${a.url}  (a real file — reference it with <img src="${a.url}"> exactly as written)\n`
      + `    placement: ${a.likely_placement}\n`
      + `    colour: ${a.colour_family} · reads as: ${a.mood}\n`
      + `    behind text: ${behind}`;
  }).join('\n');
  return `SUPPLIED DESIGN ASSET${assets.length > 1 ? 'S' : ''} — ${assets.length} file${assets.length > 1 ? 's' : ''} `
    + `chosen for this direction:\n${lines}\n\n`
    + `HOW TO USE ${assets.length > 1 ? 'THEM' : 'IT'}:\n`
    + `- ${assets.length === 1 ? 'It REPLACES one' : 'They REPLACE ' + assets.length + ' of the'} graphic element${assets.length > 1 ? 's' : ''} you would otherwise have drawn. `
    + `The density contract still governs the total: build ${budget} elements INCLUDING the supplied file${assets.length > 1 ? 's' : ''}, not on top of ${assets.length > 1 ? 'them' : 'it'}.\n`
    + `- Integrate ${assets.length > 1 ? 'them' : 'it'} — crop, mask, tint, overlap or clip as the composition needs. A PNG dropped in as a plain rectangle is a failure.\n`
    + `- Keep the text-safe zone clear. Nothing supplied may cross a glyph.\n`
    + `- USING ${assets.length > 1 ? 'THEM IS' : 'IT IS'} OPTIONAL. If the design is genuinely better without, leave ${assets.length > 1 ? 'them' : 'it'} out and build the element${assets.length > 1 ? 's' : ''} yourself. Do not force ${assets.length > 1 ? 'them' : 'it'} in.`;
}

/* ── STOCK PHOTO LIBRARY (Phase 2C) ────────────────────────────────────────
 *
 * A THIRD, independent visual source. 35 audited photographs live in
 * generator/assets/stock-photo-library/ and are described by
 * generator/assets/stock-photo-manifest.json.
 *
 * It shares no pool, no budget and no selector with the design asset library
 * above, and nothing here touches the logo library. A photograph is content;
 * a design asset is decoration. Letting one selector reach both is how a
 * veterinarian ends up on a stamp.
 *
 * Five rules shape everything below:
 *
 *   1. THE CUSTOMER'S OWN PHOTOGRAPH ALWAYS WINS. If the brief carries an
 *      Image URL or an upload, stock selection does not run at all — no
 *      blending, no "supporting" stock beside it.
 *   2. INDUSTRY MATCH IS A HARD GATE, not a score. The brief must resolve to
 *      a slug that the photo itself claims. There is no nearest-neighbour
 *      fallback: an unmatched industry means NO photo, and the design falls
 *      back to the approved design-asset path.
 *   3. ONE photograph per design. Ever.
 *   4. The photo's measured composition decides the layout. 30 of the 35 have
 *      no clean horizontal band, so the prompt carries the band grades, the
 *      scrim requirement and the recommended text colour, and a photo that
 *      cannot be placed safely on THIS product is skipped instead.
 *   5. A photo is the hero. When one is placed, decorative design-asset usage
 *      drops to at most one quiet texture or frame.
 */

/* Terms that resolve free-typed industry wording onto the manifest's slugs.
 * The slug's own words are always a term ("real-estate" matches "real estate"),
 * so this table only carries what the slug does not say for itself. */
const STOCK_INDUSTRY_SYNONYMS = {
  'real-estate':        'realtor|realty|estate agent|listing agent',
  'commercial-property':'commercial real estate|commercial property|leasing|landlord',
  'mortgage':           'mortgage broker|lending|lender|loan',
  'home-staging':       'staging|stager',
  'legal':              'law|law firm|lawyer|attorney|solicitor|litigation|paralegal|barrister',
  'notary':             'notary public|commissioner of oaths',
  'accounting':         'accountant|cpa|chartered accountant',
  'bookkeeping':        'bookkeeper|books',
  'tax':                'taxation|tax prep|tax preparation',
  'finance':            'financial|wealth|investment|investing',
  'financial-planning': 'financial planner|financial advisor|financial adviser|wealth management',
  'insurance':          'insurance broker|insurer|underwriter',
  'insurance-health':   'health insurance|group benefits|employee benefits',
  'consulting':         'consultant|advisory|advisor',
  'corporate':          'enterprise|head office',
  'technology':         'tech',
  'software':           'saas|app development|developer|web development',
  'it-services':        'it support|managed services|msp|computer repair|network support',
  'startup':            'start up',
  'co-working':         'coworking|shared office|office space',
  'medical-clinic':     'clinic|medical|doctor|physician|walk in|walk in clinic|healthcare|health care',
  'family-practice':    'family doctor|family physician|general practice',
  'specialist':         'specialist clinic|referral clinic',
  'nursing':            'nurse|registered nurse|rn',
  'pharmacy':           'pharmacist|drugstore|drug store|apothecary',
  'dental':             'dentist|dentistry|dental office',
  'orthodontics':       'orthodontist|braces|invisalign',
  'physiotherapy':      'physio|physiotherapist|physical therapy|physical therapist',
  'chiropractic':       'chiropractor',
  'massage':            'massage therapy|massage therapist|rmt',
  'rehab':              'rehabilitation|recovery clinic',
  'sports-medicine':    'sports med|athletic therapy',
  'mental-health':      'counselling|counseling|counsellor|counselor|therapist|psychotherapy|psychology|psychologist',
  'hearing':            'hearing aid|hearing aids|audiology|audiologist',
  'home-care':          'homecare|caregiver|personal support|in home care',
  'retirement-living':  'retirement|senior living|seniors|assisted living|long term care|retirement home',
  'veterinary':         'vet|veterinarian|animal hospital|animal clinic',
  'pet-grooming':       'pet groomer|dog grooming|dog groomer',
  'pet-retail':         'pet store|pet shop|pet supply|pet supplies',
  'hair-salon':         'hair|hairdresser|hairstylist|hair stylist|salon',
  'barber':             'barbershop|barber shop',
  'beauty':             'beautician|nail|nails|makeup|lash|lashes|brow|brows|cosmetology',
  'spa':                'day spa',
  'medspa':             'med spa|medical spa',
  'skincare':           'skin care|esthetics|esthetician|aesthetician|facial|facials',
  'gym':                'fitness|fitness centre|fitness center|crossfit|weights|health club',
  'personal-training':  'personal trainer|pt studio|strength coach',
  'studio-fitness':     'fitness studio|barre|spin studio|bootcamp',
  'yoga':               'yoga studio',
  'wellness':           'wellbeing|well being|holistic',
  'construction':       'builder|building|framing|concrete|excavation|site work',
  'general-contractor': 'contractor|contracting',
  'engineering':        'engineer|engineers',
  'industrial':         'industry|plant|works',
  'safety':             'workplace safety|occupational|ppe|site safety',
  'plumbing':           'plumber|drain|drains|pipefitting',
  'hvac':               'heating|cooling|furnace|air conditioning|ac repair|ductwork',
  'home-repair':        'handyman|repairs|fix it',
  'appliance-service':  'appliance repair|appliance service',
  'roofing':            'roofer|roof|roofs|shingle|shingles|eavestrough',
  'home-builder':       'custom home|custom homes|homebuilder|new build',
  'home-renovation':    'renovation|renovations|reno|renos|remodel|remodelling|remodeling',
  'landscaping':        'landscaper|landscape|hardscape',
  'lawn-care':          'lawn|lawncare|mowing|turf',
  'garden-centre':      'garden center|gardening|greenhouse',
  'property-maintenance':'groundskeeping|snow removal|grounds care',
  'cleaning':           'cleaner|cleaners|janitorial|maid|housekeeping',
  'interior-design':    'interior designer|interiors|decorator|decorating|home decor',
  'architecture':       'architect|architects|architectural',
  'furniture-retail':   'furniture|furnishings',
  'auto-repair':        'mechanic|auto shop|automotive|car repair|auto service|garage',
  'tire-service':       'tire|tires|tyre|tyres|wheel alignment',
  'auto-detailing':     'detailing|car wash|auto detail',
  'fleet-service':      'fleet|fleet maintenance',
  'restaurant':         'bistro|eatery|diner|grill|dining|gastropub',
  'catering':           'caterer|catered',
  'food-service':       'food services',
  'culinary-school':    'culinary',
  'cafe':               'coffee|coffee shop|espresso|coffeehouse|coffee house',
  'coffee-roaster':     'roaster|roastery|coffee roasting',
  'bakery':             'baker|bakeshop|bake shop|patisserie|pastry|bread',
  'artisan-food':       'artisanal|small batch',
  'farmers-market':     'farmers market|farmer s market',
  'florist':            'flower|flowers|floral|bouquet|flower shop',
  'events-weddings':    'wedding|weddings|bridal|event planning|event planner',
  'gift-retail':        'gift|gifts',
  'gift-shop':          'gift store',
  'boutique-retail':    'boutique',
  'fashion':            'apparel|clothing|clothier|menswear|womenswear',
  'small-business':     'shop local|independent shop',
  'school':             'elementary school|high school|academy|schools',
  'tutoring':           'tutor|tutors|test prep|test preparation',
  'education-non-profit':'education charity|literacy program',
  'daycare':            'day care|childcare centre|childcare center',
  'preschool':          'pre school|montessori|kindergarten|early learning',
  'childcare':          'child care|nanny|babysitting',
  'library':            'libraries',
  'family-services':    'family support|family centre|family center',
  'funeral-memorial':   'funeral|funeral home|memorial|cremation|cemetery',
  'non-profit':         'nonprofit|charity|charitable|foundation|volunteer',
  'environment':        'environmental|conservation|sustainability',
  'tourism':            'tourist|visitor centre|visitor center',
  'travel':             'travel agency|tour|tours|trip planning',
  'outdoor-recreation': 'outdoors|hiking|camping|adventure|paddling',
  'sports':             'athletics|sports club|sports team',
  'photography':        'photographer|photo studio',
  'urban-services':     'city services|municipal services',
  'payroll':            'payroll services',
  'pilates':            'reformer pilates',
};

/* Broad parent categories. A specific trade NEVER falls back to one of these:
 * matching takes the most specific tier that has a depicting photograph and
 * stops there. This is what stops "dentist" — which also contains the word
 * "clinic" in most briefs — from reaching a general medical or lifestyle shot.
 * Everything not listed here is treated as a specific trade. */
const BROAD_STOCK_SLUGS = ['medical-clinic', 'wellness', 'corporate', 'small-business',
  'family-services', 'urban-services', 'environment', 'tourism', 'travel', 'safety',
  'food-service', 'home-repair', 'animal-services', 'property-maintenance',
  'artisan-food', 'education-non-profit', 'consulting', 'finance'];

function stockSlugTier(slug) {
  return BROAD_STOCK_SLUGS.indexOf(slug) === -1 ? 1 : 2;
}

let stockLibrary = null;        // { photos, byId, terms } once loaded
let stockLibraryLoading = null; // in-flight promise, so it loads once
let stockLibraryError = null;   // why it is not loaded, for the DEV indicator

/* Words a slug is matched on: its own words, plus the synonyms above. Both are
 * normalised the same way the brief is, so "co-working" and "co working" and
 * "Co-Working" are one term. */
function stockTermsFor(slug) {
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const out = [norm(slug)];
  const extra = STOCK_INDUSTRY_SYNONYMS[slug];
  if (extra) extra.split('|').forEach((t) => { const n = norm(t); if (n) out.push(n); });
  return out.filter((t, i, a) => t && a.indexOf(t) === i);
}

/* ONE small JSON, ONCE — the same contract as the design asset library. No PNG
 * is opened, listed, hashed, downloaded or base64'd to make a choice; the file
 * loads only when the generated preview renders it, like any other <img>.
 * A FAILURE IS NOT CACHED, so one blocked request does not disable the library
 * for the rest of the session. */
function loadStockPhotoLibrary() {
  if (stockLibrary) return Promise.resolve(stockLibrary);
  if (stockLibraryLoading) return stockLibraryLoading;
  stockLibraryLoading = fetch('assets/stock-photo-manifest.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((doc) => {
      const photos = doc.photos || [];
      const byId = {};
      /* The matcher knows the FULL trade vocabulary, not only the trades the
         library can serve. A slug that is recognised but undepicted has to be
         recognised anyway — that is what lets "hearing clinic" be understood as
         a hearing clinic and refused, instead of falling through the word
         "clinic" into a general medical photograph. */
      const slugs = doc.known_industries || Object.keys(doc.industry_index || {});
      const terms = [];
      photos.forEach((p) => { byId[p.id] = p; });
      slugs.forEach((slug) => stockTermsFor(slug).forEach((t) => terms.push([t, slug])));
      /* Longest term first, so "real estate" is tested before "estate" would be
         and a two-word trade never loses to a one-word substring of it. */
      terms.sort((a, b) => b[0].length - a[0].length);
      stockLibrary = { photos: photos, byId: byId, slugs: slugs, terms: terms };
      stockLibraryError = null;
      stockLibraryLoading = null;
      return stockLibrary;
    })
    .catch((e) => {
      stockLibraryError = (e && e.message) || 'manifest unavailable';
      stockLibraryLoading = null;
      console.warn('[generator] stock photo library unavailable: ' + stockLibraryError);
      return { photos: [], byId: {}, slugs: [], terms: [] };
    });
  return stockLibraryLoading;
}

/* Warm it at page load so Generate never waits on the network for it. */
if (typeof window !== 'undefined') {
  try { loadStockPhotoLibrary(); } catch (e) { /* ignore */ }
}

/* Which library slugs this brief actually names. Whole-word matching on a
 * normalised string — a slug is either named or it is not, and nothing here
 * scores, ranks or approximates. */
function matchStockIndustries(text, lib) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  if (t.trim() === '') return [];
  const hit = [];
  (lib.terms || []).forEach(function (pair) {
    if (hit.indexOf(pair[1]) !== -1) return;
    const term = pair[0];
    /* Plain plurals and -y/-ies, so "florists" and "bakeries" match too. */
    const forms = [term, term + 's', term + 'es'];
    if (/y$/.test(term)) forms.push(term.slice(0, -1) + 'ies');
    for (let i = 0; i < forms.length; i++) {
      if (t.indexOf(' ' + forms[i] + ' ') !== -1) { hit.push(pair[1]); return; }
    }
  });
  return hit;
}

/* The photograph's orientation does NOT have to match the product's. A photo
 * is composed INTO the design — a portrait file is a vertical side panel, a
 * tall inset or a vertical hero on a landscape business card or sign, and a
 * landscape file is a horizontal band across a portrait piece. What the
 * orientation DOES decide is how the prompt tells the model to build the
 * photo area, via the manifest's suitable_roles. */
function stockRolesFor(photo) {
  const declared = Array.isArray(photo && photo.suitable_roles)
    ? photo.suitable_roles : [];
  if (declared.length) return declared;
  return (photo && photo.orientation) === 'landscape'
    ? ['horizontal-band', 'wide-hero', 'full-width-background']
    : ['vertical-side-panel', 'tall-inset', 'vertical-hero'];
}

/* 30 of the 35 photographs have no clean horizontal band, so "has a quiet band"
 * is far too strict a test to put on a card — it would ban photography from
 * business cards outright, which is not the policy. What a small format cannot
 * survive is genuine visual chaos: a frame busy edge to edge, where even a
 * scrim leaves the type fighting the image. That is measured, not graded — the
 * quietest horizontal band's busyness has to be within reach. Large format has
 * the room to give type its own zone, so nothing is excluded there. */
const SMALL_FORMAT_MAX_BUSYNESS = 0.25;

function stockCompositionOk(photo, largeFormat) {
  if (largeFormat) return true;
  const r = (photo && photo.regions) || {};
  const bands = ['top', 'middle', 'bottom'].map((b) => (r[b] ? r[b].busyness : 1));
  return Math.min.apply(null, bands) <= SMALL_FORMAT_MAX_BUSYNESS;
}

/* ── Product policy ───────────────────────────────────────────────────────
 *
 * Photography is decided per product class, not per pixel count:
 *
 *   stamp      no photography at all, and no design assets either — the stamp
 *              rules forbid colour, imagery and overlapping shapes outright.
 *              (Logo assets will be allowed here when that library lands.)
 *   nameplate  no photography. A name badge or nameplate is a name, read at
 *              arm's length. Design assets stay allowed.
 *   card       ~14%. Photography on a business card is the exception; most
 *              cards are better with type and space.
 *   general    ~80%. Signs, posters, banners, flyers, brochures and the rest
 *              of normal printed material — where a real photograph earns its
 *              place, WHENEVER a genuinely matched one exists. When none does,
 *              the answer is no photo, never a loosely related one. */
const STOCK_PRODUCT_POLICY = {
  stamp:     { none: 1, reason: 'stamps never use photography' },
  nameplate: { none: 1, reason: 'name badges and nameplates never use photography' },
  card:      { none: 0.86 },
  /* With the never-two-consecutive-misses guard below, the long-run photo rate
     on general printed material is 1/(1+none): 0.24 -> 80.6%. */
  general:   { none: 0.24 },
};

/* Whether the LAST generation of each brief drew no photo despite a valid
 * pool. Repeated large-format generations must never miss twice in a row —
 * two consecutive photo-less signs reads as "the photos stopped working". */
const lastStockDrawMissed = new Map();
const STOCK_STAMP_RE     = /stamp/i;
const STOCK_NAMEPLATE_RE = /nameplate|name\s*badge|name\s*tag|badge/i;
const STOCK_CARD_RE      = /business\s*card|calling\s*card/i;

/* The product class this brief is being designed for. The Template Type is now
 * fed from the product's own database classification, so the NAME is the
 * authoritative signal. Geometry is the fallback, in exactly two places: an
 * empty/unknown type (the source did not say) is classified by size alone,
 * and a named card whose physical size is unmistakably large format is
 * treated as what it physically is. */
function stockProductClass(templateType, widthIn, heightIn) {
  const t = (templateType || '').trim();
  if (STOCK_STAMP_RE.test(t)) return 'stamp';
  if (STOCK_NAMEPLATE_RE.test(t)) return 'nameplate';
  if (STOCK_CARD_RE.test(t)) {
    return isLargeFormatForAssets(t, widthIn, heightIn) ? 'general' : 'card';
  }
  if (!t) {
    /* No authoritative type at all: size decides, and small pieces take the
       conservative card policy rather than the 80% general one. */
    return isLargeFormatForAssets('', widthIn, heightIn) ? 'general' : 'card';
  }
  return 'general';
}

/* Photos used by the last generations of THIS brief, so a Regenerate does not
 * come back with the same photograph. An unrelated photo is NEVER substituted
 * to create variety — if the only valid match is the one just used, it is used
 * again. */
const recentStockPhotos = new Map();
const STOCK_PHOTO_MEMORY = 3;

/* DEV override, read at selection time. 'auto' is the shipped behaviour;
   'force' skips only the frequency draw — every hard gate still applies, so it
   can never reach an unrelated photo; 'off' takes none. */
function stockPhotoMode() {
  const m = (typeof window !== 'undefined' && window.SMPStockPhotoMode) || 'auto';
  return (m === 'force' || m === 'off') ? m : 'auto';
}

/* Why the last selection came back empty, reported in the DEV indicator. */
let lastStockReason = '';

function pickStockPhoto(opts) {
  lastStockReason = '';
  const mode = stockPhotoMode();
  const templateType = opts.templateType || '';

  /* ── Absolute gates. Force does not lift any of these. ── */
  if (opts.hasCustomerPhoto) {
    lastStockReason = 'the customer supplied their own photograph';
    return null;
  }
  const productClass = stockProductClass(templateType, opts.widthIn, opts.heightIn);
  const policy = STOCK_PRODUCT_POLICY[productClass] || STOCK_PRODUCT_POLICY.general;
  if (policy.none >= 1) { lastStockReason = policy.reason; return null; }
  if (mode === 'off') { lastStockReason = 'stock photo mode is No Photo'; return null; }

  const lib = stockLibrary;
  if (stockLibraryError && (!lib || !lib.photos.length)) {
    lastStockReason = 'library did not load (' + stockLibraryError + ')';
    return null;
  }
  if (!lib) { lastStockReason = 'library still loading'; return null; }
  if (!lib.photos.length) { lastStockReason = 'library is empty'; return null; }

  /* ── The industry gate, in three strictly ordered stages. ──
     Matching reads depicts[] — what the photograph actually SHOWS — and never
     the audit's looser associations.

       1. The whole brief text (the Industry field, plus the business name and
          special instructions) is put through the SAME strict whole-word
          matcher. A hit — typed or confidently inferred from "Chen Family
          Dental" in the business name — selects from that trade's own pool,
          with specific-beats-broad tiers exactly as before.
       2. A recognised trade with no depicting photograph gets NOTHING. An
          unrelated trade photo is never a fallback, and neither is the
          general pool: the trade was determined, the library cannot serve it.
       3. Only when NO industry can be determined at all — and only when the
          Industry field itself is blank — the pool becomes the photos the
          manifest explicitly flags general_purpose: neutral professional
          people, generic workspace, neutral architecture and interiors,
          broad lifestyle, nature. An explicitly typed industry that matches
          nothing still gets no photo: the user said what the business is,
          and a generic photo would be wrong on purpose. */
  const explicitIndustry = String(opts.explicitIndustry || '').trim() !== '';
  const slugs = matchStockIndustries(opts.industryText, lib);
  let pool, tierSlugs, generalPool = false;
  if (slugs.length) {
    /* SPECIFIC WINS OUTRIGHT. If the brief names a specific trade at all, that
       tier is the only tier considered — and if nothing depicts it, the answer
       is no photo. The broad tier is reachable only by a brief that names
       nothing more specific than a broad category. */
    tierSlugs = slugs.filter((sl) => stockSlugTier(sl) === 1);
    if (!tierSlugs.length) tierSlugs = slugs.filter((sl) => stockSlugTier(sl) === 2);
    pool = lib.photos.filter((p) =>
      (p.depicts || []).some((sl) => tierSlugs.indexOf(sl) !== -1));
    if (!pool.length) {
      lastStockReason = 'no photograph in the library depicts this industry';
      return null;
    }
  } else if (explicitIndustry) {
    lastStockReason = 'no industry match in the stock library';
    return null;
  } else {
    tierSlugs = [];
    generalPool = true;
    pool = lib.photos.filter((p) => p.general_purpose === true);
    if (!pool.length) {
      lastStockReason = 'no industry given and the library has no general-purpose photos';
      return null;
    }
  }

  /* ── Format gate. Orientation is deliberately NOT one: the layout builds a
        photo area to suit the file, so only measured visual chaos disqualifies
        a photo from a small piece. ── */
  const largeFormat = isLargeFormatForAssets(templateType, opts.widthIn, opts.heightIn);
  const safe = pool.filter((p) => stockCompositionOk(p, largeFormat));
  if (!safe.length) {
    lastStockReason = 'no matching photo composes safely at this size';
    return null;
  }

  /* ── Frequency. The only thing Force skips. On general printed material a
        miss is never repeated: if the previous generation of this same brief
        drew none from a valid pool, this one takes a photo. Business cards
        keep their pure ~14% draw. ── */
  if (mode !== 'force') {
    const missedLastTime = productClass === 'general'
      && lastStockDrawMissed.get(opts.memoryKey) === true;
    if (!missedLastTime && Math.random() < policy.none) {
      lastStockDrawMissed.set(opts.memoryKey, productClass === 'general');
      lastStockReason = productClass === 'card'
        ? 'business cards use photography sparingly; this generation drew none'
        : 'a match existed; this generation drew none';
      return null;
    }
    lastStockDrawMissed.set(opts.memoryKey, false);
  }

  /* ── Variety, never at the cost of relevance. ── */
  const recent = recentStockPhotos.get(opts.memoryKey) || [];
  const fresh = safe.filter((p) => recent.indexOf(p.id) === -1);
  /* Once every valid match has been used, the memory has to relax — but never
     so far that the immediately previous photo comes back twice in a row while
     a different valid match exists. An unrelated photo is still never
     substituted: a one-photo industry legitimately repeats. */
  const notLast = safe.filter((p) => p.id !== recent[0]);
  const finalPool = fresh.length ? fresh : (notLast.length ? notLast : safe);
  const photo = finalPool[Math.floor(Math.random() * finalPool.length)];
  recentStockPhotos.set(opts.memoryKey,
    [photo.id].concat(recent.filter((id) => id !== photo.id)).slice(0, STOCK_PHOTO_MEMORY));

  const matched = (photo.depicts || []).filter((sl) => tierSlugs.indexOf(sl) !== -1);
  return {
    photo: photo,
    industry: generalPool ? 'general-purpose' : (matched[0] || tierSlugs[0]),
    generalPurpose: generalPool,
    matchedIndustries: matched,
    briefIndustries: tierSlugs,
    productClass: productClass,
    largeFormat: largeFormat,
    roles: stockRolesFor(photo),
    mode: mode,
  };
}

/* Only the chosen photograph reaches the model — a URL and a few measured
 * numbers. Never the library, never a listing, never base64. */
function renderStockPhotoBlock(sel) {
  if (!sel || !sel.photo) return '';
  const p = sel.photo;
  const g = p.overlay_guidance || {};
  const r = p.regions || {};
  const grade = (b) => (r[b] && r[b].text_safety) || 'unknown';
  const poor = ['top', 'middle', 'bottom'].filter((b) => grade(b) === 'poor');
  const best = g.best_horizontal_band || 'bottom';
  const bestColour = (r[best] && r[best].recommended_text_colour) || 'light';
  const scrim = g.requires_scrim_for_text
    ? `REQUIRED. Before any headline, sub-head or contact line crosses the photograph, lay a solid or `
      + `gradient overlay in a palette colour at about ${Math.round((g.scrim_opacity_if_used || 0.45) * 100)}% `
      + `over the area the text occupies. Text straight onto this photograph is not legible enough to print.`
    : 'not required — this photograph has a band quiet enough to carry type directly.';
  const roles = (sel.roles && sel.roles.length ? sel.roles : stockRolesFor(p)).join(', ');
  const areaRule = p.orientation === 'portrait'
    ? `This file is PORTRAIT (${p.width}×${p.height}). Build a VERTICAL photo area for it — a left or `
      + `right side panel, a tall inset, or a vertical hero column — whatever suits the composition. `
      + `Do NOT stretch, squash or letterbox it to the canvas orientation: the photo area matches the `
      + `FILE, and the rest of the layout is built around that area.`
    : `This file is LANDSCAPE (${p.width}×${p.height}). Build a HORIZONTAL photo area for it — a `
      + `full-width band, a wide hero, or a broad background zone — and build the rest of the layout `
      + `around that area. Do NOT stretch or squash it to the canvas orientation.`;
  return `SUPPLIED PHOTOGRAPH — one real image file chosen for this brief:\n`
    + `- ${p.file}\n`
    + `    src: ${p.url}  (a real file — reference it with <img src="${p.url}"> exactly as written)\n`
    + `    shows: ${p.subject}\n`
    + `    ${p.orientation} ${p.width}×${p.height}, reads as ${p.mood}, ${p.brightness} overall\n`
    + `    works as: ${roles}\n`
    + `    band grades — top: ${grade('top')}, middle: ${grade('middle')}, bottom: ${grade('bottom')}\n`
    + `    quietest band: ${best} (set type there in ${bestColour} type where the layout allows)\n\n`
    + `HOW TO USE IT:\n`
    + `- It is this design's hero image, and it is the ONLY photograph in the design. `
    + `Do not add, invent, reference or link any other image file.\n`
    + `- PHOTO AREA: ${areaRule}\n`
    + `- Place it with intent: crop with clip-path or object-fit cover inside its area, mask it into a shape, `
    + `duotone or tint it into the palette, bleed it off an edge, or give it its own full panel. `
    + `A plain unstyled rectangle is a failure — and so is distorting the image's aspect ratio.\n`
    + `- SCRIM: ${scrim}\n`
    + (poor.length
        ? `- Regions graded poor (${poor.join(', ')}) must not carry important text unless the scrim above covers them.\n`
        : '')
    + `- Keep headlines over the image ${g.max_headline_over_image || 'short'} — this photograph is busy enough `
    + `that a long line breaks up against it.\n`
    + `- Readability wins over coverage. If the only way to fit the photo is to crush the type, use less of the `
    + `photo — a band, a panel, a corner crop — not less of the type.`;
}

/* ── LOGO LIBRARY (Phase 2D) ───────────────────────────────────────────────
 *
 * The third and last independent visual source: 30 transparent black
 * silhouette marks in generator/assets/logo-library/, described by
 * generator/assets/logo-asset-manifest.json. Separate manifest, loader,
 * selector and budget — a logo is IDENTITY, not decoration and not content.
 *
 *   1. THE CUSTOMER'S OWN LOGO ALWAYS WINS. A supplied SVG (or logo image)
 *      disables library selection entirely, in every mode.
 *   2. Tier B marks are literal (a tooth, scales, a spine): HARD-gated to
 *      their own industries through the same matcher the stock photos use.
 *      Tier A marks are abstract and may serve any brief. A wrong-industry
 *      literal mark is never a fallback — a neutral Tier A mark is.
 *   3. ONE mark per design, and it consumes a signature-element slot in the
 *      existing visual budget — it never widens it.
 *   4. Every product class may carry a mark, stamps included (a black
 *      silhouette is exactly what a stamp can print).
 */
let logoLibrary = null;
let logoLibraryLoading = null;
let logoLibraryError = null;

function loadLogoLibrary() {
  if (logoLibrary) return Promise.resolve(logoLibrary);
  if (logoLibraryLoading) return logoLibraryLoading;
  logoLibraryLoading = fetch('assets/logo-asset-manifest.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((doc) => {
      logoLibrary = { logos: doc.logos || [] };
      logoLibraryError = null;
      logoLibraryLoading = null;
      return logoLibrary;
    })
    .catch((e) => {
      logoLibraryError = (e && e.message) || 'manifest unavailable';
      logoLibraryLoading = null;
      console.warn('[generator] logo library unavailable: ' + logoLibraryError);
      return { logos: [] };
    });
  return logoLibraryLoading;
}
if (typeof window !== 'undefined') {
  try { loadLogoLibrary(); } catch (e) { /* ignore */ }
}

/* A mark should appear when the composition benefits from one — roughly half
 * the time — never in every design. Force skips only this draw. */
const LOGO_NONE = { stamp: 0.50, nameplate: 0.45, card: 0.50, general: 0.50 };

const recentLogos = new Map();
const LOGO_MEMORY = 2;

function logoMode() {
  const m = (typeof window !== 'undefined' && window.SMPLogoMode) || 'auto';
  return (m === 'force' || m === 'off') ? m : 'auto';
}

let lastLogoReason = '';

function pickLogo(opts) {
  lastLogoReason = '';
  const mode = logoMode();
  if (opts.hasCustomerLogo) {
    lastLogoReason = 'the customer supplied their own logo';
    return null;
  }
  if (mode === 'off') { lastLogoReason = 'logo mode is No Logo'; return null; }
  const lib = logoLibrary;
  if (logoLibraryError && (!lib || !lib.logos.length)) {
    lastLogoReason = 'library did not load (' + logoLibraryError + ')';
    return null;
  }
  if (!lib) { lastLogoReason = 'library still loading'; return null; }
  if (!lib.logos.length) { lastLogoReason = 'library is empty'; return null; }

  const productClass = stockProductClass(opts.templateType, opts.widthIn, opts.heightIn);
  if (mode !== 'force') {
    const none = LOGO_NONE[productClass] !== undefined ? LOGO_NONE[productClass] : 0.5;
    if (Math.random() < none) {
      lastLogoReason = 'this composition draws no mark';
      return null;
    }
  }

  /* Tier B first, through the SAME strict matcher as the stock photos: a
     literal mark only for its own trade. No B match -> the neutral A pool. */
  const stock = stockLibrary;
  const slugs = (stock && stock.terms) ? matchStockIndustries(opts.industryText, stock) : [];
  const bPool = lib.logos.filter((l) => l.tier === 'B'
    && (l.industries || []).some((sl) => slugs.indexOf(sl) !== -1));
  const aPool = lib.logos.filter((l) => l.tier === 'A');
  let pool = bPool.length ? bPool : aPool;
  let tier = bPool.length ? 'B' : 'A';
  if (!pool.length) { lastLogoReason = 'no suitable mark in the library'; return null; }

  const recent = recentLogos.get(opts.memoryKey) || [];
  const fresh = pool.filter((l) => recent.indexOf(l.filename) === -1);
  const notLast = pool.filter((l) => l.filename !== recent[0]);
  const finalPool = fresh.length ? fresh : (notLast.length ? notLast : pool);
  const logo = finalPool[Math.floor(Math.random() * finalPool.length)];
  recentLogos.set(opts.memoryKey,
    [logo.filename].concat(recent.filter((f) => f !== logo.filename)).slice(0, LOGO_MEMORY));
  return { logo: logo, tier: tier, matchedIndustries: slugs, mode: mode };
}

/* Only the chosen mark reaches the model — a URL and a few words. */
function renderLogoBlock(sel, isStamp) {
  if (!sel || !sel.logo) return '';
  const l = sel.logo;
  const colour = isStamp
    ? '- STAMP: keep it PURE BLACK (#000000) — the silhouette as shipped is exactly what a stamp prints. No recolouring, no grey.'
    : '- COLOUR: the file is a solid black silhouette on transparency. Recolour it to the palette when black conflicts: '
      + 'wrap it in a div sized to the mark and use the mask technique — '
      + 'style="background:[palette colour];-webkit-mask:url([the src]) center/contain no-repeat;mask:url([the src]) center/contain no-repeat" '
      + '— or keep <img> as-is for black, or add filter:invert(1) for white. Never a colour that disappears into the ground.';
  return 'SUPPLIED BRAND MARK — one logo file chosen for this brief:\n'
    + '- ' + l.filename + '\n'
    + '    src: ' + l.url + '  (a real file — reference it with this exact path)\n'
    + '    shows: ' + l.symbol_type + ' · reads as: ' + l.mood + '\n'
    + '    natural use: ' + l.best_role + '\n\n'
    + 'HOW TO USE IT:\n'
    + '- It is this design\'s brand mark — use it as the primary mark, a monogram/symbol area, a secondary signature, or a small icon, whichever the composition wants. AT MOST ONE appearance as the hero mark (a small repeated watermark is not this file\'s job).\n'
    + colour + '\n'
    + '- Preserve its aspect ratio and transparency exactly — contain, never stretch, never crop through the silhouette.\n'
    + '- It CONSUMES one signature/graphic-element slot in the density contract — it does not extend the budget. If the design already has a strong hero (a photograph, a dominant asset), the mark steps down to a small signature.\n'
    + '- USING IT IS OPTIONAL: if the composition is genuinely better as pure typography, leave it out.';
}

/* ── Direction rotation for the DEFAULT path ───────────────────────────────
 *
 * A direction is a complete, internally coherent concept — its typography,
 * palette, density and composition language all belong to it. Repeated clicks
 * were free to land on the same one, so the same brief kept producing the same
 * concept. Rotation happens at the CONCEPT level and nowhere else: nothing
 * inside a direction is randomised, and a direction the user chose explicitly
 * is never rotated away from.
 *
 * Regenerate resends an identical payload, so the memory is keyed on the brief
 * itself. Up to three recent directions are remembered per brief; the next draw
 * excludes as many of them as it can while still leaving a real choice — three,
 * then two, then just the immediately previous one. */
const RECENT_LIMIT = 3;
const recentDirections = new Map();

function rotateDirection(candidates, memoryKey) {
  const recent = recentDirections.get(memoryKey) || [];
  let pool = candidates;
  /* Widen the exclusion only while at least two options survive it, so a
   * narrow intent set (say "elegant" -> four directions) still rotates instead
   * of collapsing onto one. */
  for (let depth = Math.min(RECENT_LIMIT, recent.length); depth >= 1; depth--) {
    const avoid = recent.slice(0, depth);
    const filtered = candidates.filter((k) => avoid.indexOf(k) === -1);
    if (filtered.length >= 2) { pool = filtered; break; }
    if (depth === 1 && filtered.length === 1) { pool = filtered; }
  }
  const direction = pickDirection(pool);
  recentDirections.set(memoryKey,
    [direction.key].concat(recent.filter((k) => k !== direction.key)).slice(0, RECENT_LIMIT));
  return direction;
}

function chooseCreativeDirection(styleDirection, industry, templateType, creativityLevel,
    variationKey, doubleSided, widthIn, heightIn, stockSelection, logoSelection) {
  const raw = (styleDirection || '').trim();
  const creativityDirective = getCreativityDirective(creativityLevel || 'balanced');

  // ── Stamps: monochromatic only — special archetype pool ─────────────────
  const isStamp = /stamp/i.test(templateType || '');
  if (isStamp) {
    const archetype = STAMP_ARCHETYPES[Math.floor(Math.random() * STAMP_ARCHETYPES.length)];
    const moment    = STAMP_CREATIVE_MOMENTS[Math.floor(Math.random() * STAMP_CREATIVE_MOMENTS.length)];
    /* No library asset on a stamp: the stamp rules below forbid colour,
       imagery and overlapping shapes outright. */
    lastAssetReason = 'stamps use no assets';
    lastStockReason = lastStockReason || 'stamps never use photography';
    const stampLogoBlock = renderLogoBlock(logoSelection, true);
    return { text: (stampLogoBlock ? stampLogoBlock + '\n\n' : '') + `STAMP DESIGN — monochromatic black ink on white ONLY, SUPER SIMPLE flat layout. EXECUTE ARCHETYPE: ${archetype}. CREATIVE MANDATE: ${moment} ABSOLUTE STAMP RULES: (1) Only #000000 and #ffffff permitted — zero color, zero grey; (2) Bold/heavy type weights only — thin fonts blur in stamp impression; (3) Text is a simple vertical stack of straight horizontal lines — NO arced text, NO curved text, NO rotated text, NO circular text paths, NO radial bursts, NO ovals, NO icons or shapes overlapping type; (4) Simple clean geometry only: straight borders, solid bars, thin horizontal rules; (5) Every element must survive actual rubber stamp impression quality. ${creativityDirective}`, direction: null, assets: [], assetReason: lastAssetReason,
      assetSelectMs: 0, largeFormat: false, assetMode: assetMode() };
  }

  /* Large format is decided by geometry as well as by name, so a real sign or
   * banner is treated as one even when the live catalogue leaves Template Type
   * saying Business Card. Business cards are untouched by everything here. */
  const isLargeFormat = isLargeFormatForAssets(templateType, widthIn, heightIn);
  const formatNote = isLargeFormat
    ? 'Design at true poster scale — monumental display type (120px+), one dominant visual covering ≥40% of the canvas, edge-to-edge composition. A poster, not a scaled-up business card.\n\n'
      + 'DISTANCE IMPACT — this piece is read from across a room, not held in the hand. Commit to it: '
      + 'fewer and LARGER colour fields, one colour owning a decisive share of the canvas, and hard contrast '
      + 'between that field and the type carried on it. Half-tints, thin rules and delicate spacing that read '
      + 'beautifully at 3.5 inches simply disappear at ten feet. '
      + 'Strength is not brightness: reach it through saturation, depth, scale and contrast — a refined, '
      + 'luxury or editorial direction stays refined and gets there with deep ink, warm neutrals and one '
      + 'confident accent. Do NOT default to neon, and do NOT spread the palette into a rainbow — two or '
      + 'three colours doing decisive work beats six competing.'
    : 'Design at portfolio quality — one clear idea, real craft, and a print-shop finish appropriate to this direction.';

  const memoryKey = variationKey || `${templateType}|${raw}|${industry}`;
  const briefText = [raw, industry, templateType].filter(Boolean).join(' ');

  const compose = (brief, density, reference, directionKey) => {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const assets = pickAssets(directionKey, density, briefText, memoryKey, !!doubleSided,
      templateType, widthIn, heightIn, !!(stockSelection && stockSelection.photo),
      !!(logoSelection && logoSelection.logo));
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return { text: [
      brief,
      reference ? `INSPIRATION DIRECTION (a reference to riff on — take its spirit, do not copy it): ${reference}` : '',
      DENSITY_CONTRACTS[density] || DENSITY_CONTRACTS.balanced,
      renderStockPhotoBlock(stockSelection),
      renderLogoBlock(logoSelection, false),
      renderAssetBlock(assets, density),
      `${formatNote} ${creativityDirective}`,
    ].filter(Boolean).join('\n\n'),
      direction: directionKey,
      assets: assets,
      assetReason: assets.length ? '' : lastAssetReason,
      assetSelectMs: Math.round((t1 - t0) * 1000) / 1000,
      largeFormat: isLargeFormatForAssets(templateType, widthIn, heightIn),
      assetMode: assetMode(),
    };
  };



  // ── An explicit, non-generic style direction: the user's words lead ──────
  if (raw && !GENERIC_STYLE.test(raw)) {
    /* A visible chip that IS a Phase 1 direction resolves straight to it —
       deterministically: same brief, same density, same asset families. */
    if (DIRECTION_STYLE_CHIPS[raw]) {
      const d = DIRECTION_BY_KEY[DIRECTION_STYLE_CHIPS[raw]];
      return compose(d.brief, d.density, null, d.key);
    }
    const expanded = expandStyleDirection(raw);
    /* Chips resolve DETERMINISTICALLY: an exact chip name gets its brief and
       nothing else. A typed free-text style keeps the route behaviour — a
       reference archetype is added only when the words actually route to a
       matching pool (an unrouted style used to receive a RANDOM bold pick,
       which is how "Japanese Minimalism" once arrived carrying a neon field). */
    const isChip = Object.prototype.hasOwnProperty.call(STYLE_CHIP_MAP, raw);
    const reference = isChip ? null
      : (pickFromStyleRoute(raw, templateType) || pickFromStyleRoute(expanded, templateType));
    return compose(expanded, CHIP_DENSITY[raw] || 'balanced', reference, null);
  }

  // ── Generic or empty: intent first, then a rotated draw ──────────────────
  const keys = intentKeysFor(raw) || intentKeysFor(industry);
  let candidates = (keys && keys.length) ? keys : DEFAULT_DIRECTION_POOL.slice();
  /* On LARGE FORMAT, an industry-narrowed pool is the repetition the user
     sees: "legal" or "professional" collapses to four quiet, near-identical
     directions, and rotation inside that set just shuffles the same look. A
     sign has the distance and the canvas to carry a stronger concept, so the
     intent pool is widened — never replaced — with the assertive directions
     that still read as professional. The quiet directions stay in the pool,
     so nothing is forced loud; consecutive generations simply have somewhere
     genuinely different to go. Small formats are untouched. */
  const largeDefault = isLargeFormatForAssets(templateType, widthIn, heightIn);
  if (keys && keys.length && largeDefault) {
    LARGE_FORMAT_EXTRA_DIRECTIONS.forEach((k) => {
      if (candidates.indexOf(k) === -1) candidates = candidates.concat(k);
    });
  }
  if (largeDefault) candidates = alternateRegister(candidates, memoryKey);
  const direction = rotateDirection(candidates, memoryKey);
  if (largeDefault) {
    lastLargeFormatRegister.set(memoryKey,
      SOFT_REGISTER_DIRECTIONS.indexOf(direction.key) !== -1);
  }
  return compose(direction.brief, direction.density, null, direction.key);
}

/* The string form, for callers and tests that only need the prompt text. */
function resolveCreativeDirection(styleDirection, industry, templateType, creativityLevel,
    variationKey, doubleSided) {
  return chooseCreativeDirection(styleDirection, industry, templateType, creativityLevel,
    variationKey, doubleSided).text;
}


// ── Industry palette hints when user leaves colors empty ─────────────────────
const INDUSTRY_COLOR_POOLS = {
  legal: [
    'Charcoal #1c1c1e + warm parchment #f5f0e8 + antique gold #b8956a + deep burgundy accent',
    'Slate #3d4f5c + cream #faf8f5 + copper #b87333 + forest green accent',
    'Deep oxblood #4a1c2e + ivory #f8f4ef + brushed brass #c9a84c + muted sage accent',
    'Warm black #2a2a2a + stone #e8e4df + terracotta #c45c3e + teal accent',
  ],
  dental: [
    'Warm white #faf9f7 + coral #e8725a + soft sage #8fa68a + deep charcoal text',
    'Mint #d4ede4 + terracotta #d4725a + cream #fffbf5 + navy text (not background)',
    'Blush #f5e6e0 + teal #2a9d8f + warm grey #6b6b6b + gold accent',
  ],
  healthcare: [
    'Sage #7d9b8a + warm cream #f7f3ed + coral #e07a5f + deep teal accent',
    'Soft lavender #c4b5d4 + white + plum #6b4c7a + mint accent',
    'Warm grey #5c5c5c + peach #f4c4a0 + forest #3d5a45 + cream background',
  ],
  tech: [
    'Electric violet #7c3aed + near-black #0f0f12 + lime #c8f542 + cool grey',
    'Deep charcoal #1a1a2e + hot coral #ff6b6b + white + cyan accent',
    'Midnight #121826 + amber #f59e0b + slate text + mint accent',
  ],
  default: [
    'Terracotta #c45c3e + warm cream #faf6f1 + forest #2d5016 + mustard accent',
    'Deep plum #4a1942 + blush #f2d7d9 + gold #d4a853 + charcoal text',
    'Burnt orange #cc5500 + sand #e8dcc8 + teal #1a6b6a + charcoal',
    'Olive #6b7c3e + cream #f5f0e1 + rust #a0522d + dark brown text',
    'Charcoal #2d2d2d + saffron #f4c430 + warm white + emerald accent',
  ],
};

/* ── Large-format colour stances ──────────────────────────────────────────
 *
 * With no user colours and no chosen style, large format kept arriving in the
 * same tasteful mid-register: the industry pools are deliberately refined and
 * the model settles into them. A sign is read at ten feet — the palette is a
 * decision made once, loudly. One stance is drawn per generation and ROTATED
 * per brief, so consecutive defaults commit to visibly different colour moves.
 * Each stance stays professional; none of them is neon, and none is a rainbow.
 * User colours and explicitly chosen styles never reach this code. */
const LARGE_FORMAT_COLOR_STANCES = [
  'COLOUR STANCE — SATURATED FIELD: one fully saturated brand colour owns 60%+ of the canvas as a solid field; type reverses out of it in white or near-black. No pastel version of it — the colour at full strength.',
  'COLOUR STANCE — DEEP GROUND, HOT ACCENT: a deep, dark ground (ink navy, forest, aubergine, charcoal) across the whole canvas with ONE hot accent (coral, amber, chartreuse, cyan) doing every highlight. Two colours, total commitment.',
  'COLOUR STANCE — HIGH-KEY WARMTH: a bright warm ground (sun yellow, warm cream pushed to saturation, orange-leaning) with dense near-black type at maximum contrast. Cheerful, confident, unmissable.',
  'COLOUR STANCE — DUOTONE CLASH: two saturated colours of similar weight split the canvas in large geometric zones (60/40 or bolder). The pair should be unexpected but harmonious — teal/tangerine, cobalt/lime, plum/gold.',
  'COLOUR STANCE — REFINED CONTRAST: a luxury register at display scale — deep ink or espresso ground, generous light field, and one metallic or jewel accent — but with the value contrast pushed HARD so it carries across a room. Refined never means faint.',
  'COLOUR STANCE — COLOUR-BLOCK GRID: three or four flat saturated blocks organise the whole layout into zones, one block per message. Think transit poster: each zone a different colour, type sized to the block.',
];
const recentColorStances = new Map();
const COLOR_STANCE_MEMORY = 3;

function rotateColorStance(memoryKey) {
  const recent = recentColorStances.get(memoryKey) || [];
  const pool = LARGE_FORMAT_COLOR_STANCES
    .map((t, i) => i)
    .filter((i) => recent.indexOf(i) === -1);
  const idx = (pool.length ? pool : LARGE_FORMAT_COLOR_STANCES.map((t, i) => i))[
    Math.floor(Math.random() * (pool.length || LARGE_FORMAT_COLOR_STANCES.length))];
  recentColorStances.set(memoryKey,
    [idx].concat(recent.filter((i) => i !== idx)).slice(0, COLOR_STANCE_MEMORY));
  return LARGE_FORMAT_COLOR_STANCES[idx];
}

function getColorGuidance(industry) {
  const key = (industry || '').toLowerCase();
  let pool = INDUSTRY_COLOR_POOLS.default;
  if (/legal|law|attorney|counsel/.test(key)) pool = INDUSTRY_COLOR_POOLS.legal;
  else if (/dental|dentist|orthodont/.test(key)) pool = INDUSTRY_COLOR_POOLS.dental;
  else if (/health|medical|clinic|hospital|pharma/.test(key)) pool = INDUSTRY_COLOR_POOLS.healthcare;
  else if (/tech|software|saas|digital|startup/.test(key)) pool = INDUSTRY_COLOR_POOLS.tech;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  /* A starting point, not a funnel. The previous version forbade blue outright
     and then named a replacement list that was mostly dark + metallic, which is
     how nearly every unprompted design arrived dark with a gold accent. */
  return `No colors specified — invent a distinctive, premium palette that suits this business and the chosen direction. One idea to start from: ${pick}. Light, warm, soft, saturated, deep and metallic palettes are all legitimate, and a considered professional blue is welcome where it genuinely fits (it is a reflex to avoid, not a colour to ban). Whatever you choose, make it a decision — not the same default applied to every brief.`;
}

function toPx(value, unit) {
  if (unit === 'px') return Math.round(value);
  if (unit === 'mm') return Math.round(value * (96 / 25.4));
  if (unit === 'in') return Math.round(value * 96);
  return Math.round(value);
}

// ── Print bleed ──────────────────────────────────────────────────────────────
// Products that ship to a commercial printer need a 0.125" bleed on every edge.
const BLEED_IN = 0.125;
const BLEED_PRODUCTS = ['Business Card', 'Poster', 'Brochure'];

function getBleedPx(templateType) {
  return BLEED_PRODUCTS.includes(templateType) ? Math.round(BLEED_IN * 96) : 0; // 12px @ 96dpi
}

function getBleedNote(bleedPx, canvasW, canvasH, trimW, trimH) {
  if (!bleedPx) return '';
  const safe = bleedPx * 2; // recommended safe margin from the canvas edge
  return `
PRINT BLEED — this is a print-ready file with ${BLEED_IN}" bleed on every edge:
- Total canvas is ${canvasW}×${canvasH}px and ALREADY INCLUDES a ${bleedPx}px bleed margin on all four edges. Size the outer container to exactly ${canvasW}×${canvasH}px.
- The trim/cut line sits ${bleedPx}px inside each edge; the finished (post-cut) size is ${trimW}×${trimH}px.
- ALL background colors, color fields, gradients, images, and full-bleed shapes MUST extend to the very edge of the ${canvasW}×${canvasH}px canvas so there is no white gap after cutting — bleed the background fully.
- Keep ALL critical content (headline, body text, logos, icons, faces, contact info) inside the SAFE AREA: at least ${safe}px in from the canvas edge on every side, so nothing important is trimmed off.
- Do NOT draw visible crop marks, trim guides, or a border line at the trim edge — bleed is expressed only through full-bleed backgrounds.`;
}

function getLayoutBudget(width, height, unit, templateType, bleedPx = 0, businessName = '') {
  const h = toPx(height, unit || 'px') + bleedPx * 2;
  const w = toPx(width, unit || 'px') + bleedPx * 2;

  if (/stamp/i.test(templateType || '')) {
    const nameMax = Math.max(14, Math.min(26, Math.round(h * 0.33)));
    const maxLines = h <= 96 ? 4 : 6;
    return `STAMP LAYOUT BUDGET (${w}×${h}px) — RIGID SIMPLICITY MANDATORY:
- ALL text lives in ONE flex column: .zone-copy { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; height:100%; box-sizing:border-box; padding:6px 10px; }
- NO position:absolute on any text element. NO transform:rotate anywhere. NO arced, curved, vertical, or circular text. NO SVG text elements.
- Text stack: business name (${Math.round(nameMax * 0.6)}–${nameMax}px bold caps, ONE line that must fit the width) + up to ${maxLines - 1} shorter info lines at 7–10px
- Maximum ${maxLines} total text lines
- Decoration is ONLY: a CSS border on the card (solid/double/dashed, straight or rounded corners), OR one solid black bar (top, bottom, or left block), OR 1–3px horizontal rules between text lines
- Decorations NEVER overlap or intersect text — bars sit strictly above/below/beside the text column
- Every element fits inside ${w}×${h}px with at least 5px padding on all sides; nothing may clip or touch the canvas edge unless it is a full-bleed bar`;
  }

  // ── Nameplates / name badges: a person-identity plate, NOT a business card ──
  if (/nameplate|name badge|name tag/i.test(templateType || '')) {
    const words = String(businessName || '').split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x));
    const longestWord = words.length ? Math.max(...words.map((x) => x.length)) : 8;
    const safeW = Math.max(120, w - 64);                       // ~32px inset each side
    const fitCap = Math.floor(safeW / (0.85 * longestWord));   // px at which the longest name word still fits one line
    const ceiling = h <= 130 ? 40 : h <= 200 ? 64 : h <= 320 ? 96 : 140;
    const nameMax = Math.max(28, Math.min(ceiling, fitCap));
    const titleMax = Math.max(11, Math.round(nameMax * 0.26));
    return `NAMEPLATE LAYOUT BUDGET (${w}×${h}px, landscape desk/door plate) — NAME-FIRST, RICH BACKGROUND:
- CONTENT MODEL (this is NOT a business card): the ONLY foreground content is (1) a PERSON'S NAME as the hero, (2) their JOB TITLE / role, and (3) a small business LOGO or wordmark. NO contact lines (no phone, email, website, address), NO tagline, NO paragraphs, NO body copy anywhere.
- HERO = the person's NAME, set BOLD and LARGE — up to ${nameMax}px at this width — the single dominant element. It MUST fit fully inside the ${safeW}px safe width; if it will not fit on one line, reduce the size or break "First / Last" onto two lines. Never let a glyph touch an edge. line-height 0.98–1.06.
- JOB TITLE sits directly under or beside the name at ${Math.round(titleMax * 0.7)}–${titleMax}px in a quieter weight/color or tracked caps — clearly subordinate (name ≥ 2.2× the title).
- LOGO: place the business logo/wordmark small and tidy in one corner or flanking the name (≈12–22% of canvas width) — user SVG if provided, otherwise a compact monogram/wordmark of the business name. The logo is an accent, never the hero.
- RICH BACKGROUND (maximalism still applies): fill the plate with a layered, designed background — 2+ color fields, a gradient, a motif, ornament, a rule/frame system, or a pattern — so it reads as a premium object, never a flat fill with a name on it. But every decorative layer lives BEHIND/AROUND the text and must never reduce the legibility or dominance of the NAME.
- LAYOUT: a landscape composition with intent — name+title on one side with the logo opposite; or logo in a top corner with name+title anchored beside it; or a vertical accent band next to a name block. Never a dead-centered stack on a flat fill.
- TEXT STRUCTURE (prevents clipping): put the name + title in ONE flex block — .zone-copy { display:flex; flex-direction:column; gap:6px } — inside a .content { position:absolute; inset:0; display:flex; align-items:center; padding:~20px; box-sizing:border-box }. Do NOT give the name or title its own position:absolute or hardcoded top. Everything fits inside ${w}×${h}px with ≥12px clearance on every side.`;
  }

  const isLargeFormat = /poster|sign/i.test(templateType || '') || h > 600;

  if (isLargeFormat) {
    return `LARGE FORMAT POSTER/SIGN CANVAS: ${w}×${h}px

THIS IS A POSTER/SIGN — NOT A BUSINESS CARD. Design language must be theatrical, editorial, and bold.

COMPOSITIONAL STRUCTURE (mandatory — pick one):
  A) Horizontal Thirds: top band (hero display type or dominant image, ~45% height) + middle band (subhead + event info, ~35%) + bottom band (fine details + contact, ~20%)
  B) Two-Column Grid: left column (large graphic or color field, 45–55% width) + right column (stacked hierarchy of type zones)
  C) Diagonal/Dynamic Split: clip-path diagonal dividing two color fields, type anchored to the lighter panel
  D) Full-Bleed Hero: photographic or illustrated base covering 100% of canvas, typography overlaid in distinct zones with contrast backgrounds or overlays

TYPOGRAPHY SCALE (these are the CORRECT sizes for this canvas):
  • Display / Hero headline: 120px–300px — monumental, commanding
  • Subhead / Event title: 36px–72px — clear second tier
  • Body / Supporting info: 18px–28px — legible at reading distance
  • Fine detail (date, location, URL): 14px–18px — precise and small
  FORBIDDEN: typography capped at business-card sizes (28px, 36px) on a ${w}×${h}px canvas

GRAPHIC ELEMENTS:
  • One dominant element MUST cover ≥40% of canvas area (color field, geometric shape, image zone)
  • At least one element must touch or bleed off a canvas edge — no floating-island layouts
  • Background: multi-stop gradient, layered clip-path color fields, or designed atmospheric layer — NEVER flat single color

FORBIDDEN ON LARGE FORMAT:
  - Photo column on right + text column on left (this is a scaled-up business card — REJECTED)
  - Centered text stack with flat background (PowerPoint quality — REJECTED)
  - Business-card-size typography (28–52px headlines on a ${h}px tall canvas — REJECTED)
  - Four text elements in a .zone-copy flex column as the primary composition (card layout — REJECTED)`;
  }

  // Fit-aware headline cap: as LARGE as fits the safe width, so display type is bold AND never clips.
  const words = String(businessName || '').split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x));
  const longestWord = words.length ? Math.max(...words.map((x) => x.length)) : 8;
  const safeW = Math.max(80, w - 56);                          // ~28px inset on each side
  const fitCap = Math.floor(safeW / (0.85 * longestWord));     // px at which the longest word still fits one line (with tracking margin)
  const ceiling = h <= 160 ? 44 : h <= 220 ? 76 : 104;         // allow genuinely bold display type on cards
  const headlineMax = Math.max(24, Math.min(ceiling, fitCap));
  const zoneMaxWidth = Math.round(w * 0.55);
  const textMaxHeight = h - 16;

  return `SMALL-FORMAT LAYOUT BUDGET (${w}×${h}px) — GRAPHICS RICH, TEXT MUST FIT:
- RICHNESS: fill the canvas with layered background and graphic design (color fields, ornament, motifs, patterns, emblems). This budget disciplines TEXT sizing/placement only — it is NOT a licence to leave the canvas sparse. A near-empty card is a failure.
- HERO NAME: the business name may be BOLD and large — up to ${headlineMax}px at this width — but it MUST fit fully inside the ${safeW}px safe width. If it will not fit on one line at your chosen size, REDUCE the size or break it onto two lines; never let a letter touch or cross any edge. line-height 0.95–1.05.
- Person name max 13px, tagline max 11px at this canvas height.
- TEXT LAYOUT (prevents overlap AND clipping): put ALL text in ONE flex container — .content { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:space-between; padding:~24px; box-sizing:border-box; z-index:20 } — holding .zone-copy (name + tagline) at the top and .zone-contact (person, title, contact lines) at the bottom, each a flex column with gap 6–8px. NEVER give an individual text line its own position:absolute or hardcoded top; flex flow then makes overlap and bottom-clipping impossible.
- One contact/icon system only — never both a .contact-group inside .zone-copy AND a separate .icon-row.
- Total text height (copy + contact) must fit inside ${textMaxHeight}px with the padding above — if it doesn't, reduce the display size until it does. Nothing clips, top or bottom.
- .zone-copy max-width: ${zoneMaxWidth}px when a graphic/photo occupies the other side.
- Tagline color must contrast with its background — never use --primary text on a --primary shape.
- A large monogram/emblem is welcome as a hero; if it sits BEHIND text keep it at opacity ≤ 0.25 so the headline stays readable.`;
}

// ── Pass 1: Creative director spec ──────────────────────────────────────────
const SPEC_PROMPT = `You are a world-class creative director. Define a precise visual specification for the brief below. This spec will be handed directly to a front-end developer — be specific, decisive, and measurable.

BRIEF
Industry: {{INDUSTRY}}
Product: {{PRODUCT_TYPE}}
Dimensions: {{DIMENSIONS}}
Colors: {{COLORS}}
Business Name: {{BUSINESS_NAME}}
Style Direction: {{STYLE_DIRECTION}}
Special Instructions: {{SPECIAL_INSTRUCTIONS}}
Image URL: {{IMAGE_URL}}
User SVG: {{SVG_CONTENT}}

{{LAYOUT_BUDGET}}

HOW TO APPROACH THIS:
1. Start with ONE idea. Before anything else, decide the single memorable concept that drives this piece — something you could say in one sentence, specific to THIS business, not a generic template. Every field below serves it. This is the most important decision.
2. Honor the Style Direction — it is the primary creative driver, and it includes a DESIGN DENSITY contract you must follow. Choose typography that belongs to that direction rather than a habitual favourite. (Editorial/luxury/elegant → Cormorant, Playfair Display, EB Garamond, Bodoni Moda, Fraunces, DM Serif Display; Swiss/Bauhaus/modernist → Space Grotesk, Barlow, Archivo, Work Sans; clean corporate → Inter, Manrope, IBM Plex Sans; organic/craft → Nunito, Quicksand, Lato; playful → Fredoka, Poppins, Baloo 2; retro-future/technical → Orbitron, Exo 2, Space Mono.) Size display type for the direction — dramatic where that is the point, restrained where it is not — and always within the safe width given in the layout budget, reducing size or breaking to two lines rather than clipping.
3. Pick a distinctive palette that genuinely fits this business, this industry and this direction. If Colors is empty, invent one — light, warm, soft, saturated, deep or metallic, whichever the direction calls for, and a considered professional blue when that is the right answer. What to avoid is the unconsidered default: the same palette reached for regardless of brief. The background must suit the direction (dark directions → dark ground; restrained directions → a calm or paper ground; bold directions → saturated).
4. Compose with intent — asymmetry, strict grid, or diagonal as the concept demands; never a centered stack on a flat fill. Keep decorative shapes out of the text-safe zone.
5. Build the design at the DENSITY the Style Direction's contract specifies. A rich contract wants a layered background and 4–6 integrated graphic elements; a restrained contract wants a calm ground, 1–3 precise elements, and whitespace composed with real tension. Either way the craft is the same: a dominant hero, a real hierarchy, and nothing present merely to fill space.
6. If an Image URL is provided, describe its crop/frame/overlay and how it connects to type (IMAGE INTEGRATION). If a User SVG is provided, describe its exact placement, size, and relationship to the composition (SVG INTEGRATION).

Return ONLY the spec in this exact format — no explanation, no code, no preamble:

CONCEPT
[one sentence: the single memorable idea driving this design, specific to this business — decide this FIRST; everything below serves it]

PALETTE
Background: #______
Primary: #______
Secondary: #______
Accent: #______
Text: #______
Text-muted: #______

TYPOGRAPHY
Headline: [Google Font] | [weight] | [px size] | [letter-spacing e.g. -0.02em or 0.15em]
Sub: [Google Font] | [weight] | [px size] | [letter-spacing]
Body: [Google Font] | [weight] | [px size] | [letter-spacing]

LAYOUT
[2–3 sentences: exact compositional strategy — how the canvas is divided, where key elements are anchored, how visual weight and hierarchy flow. Describe any asymmetric, diagonal, offset, or architectural layout decisions. Be specific about which quadrants are occupied by what elements.]

BACKGROUND
[The ground and how it is arranged across the canvas. At a rich density: the layered environment — 2+ color fields / gradient / pattern / texture. At a restrained density: a calm or single considered ground is correct — say so plainly and do not invent layers to fill the field.]

TEXT ZONES
[Two zones only, flowed by a flex container — NO per-line pixel positions. State which text sits in .zone-copy (top: business name + tagline) vs .zone-contact (bottom: person name, title, contact lines), and whether the copy block is top-anchored or vertically centered. The build flexes these so lines can never overlap or clip.]

TEXT-SAFE ZONE
[Define the rectangular region (left, top, width, height in px) where ALL typography lives — decorative shapes must not intersect this rectangle]

MOTIF
[1–2 sentences: the specific visual element(s) — shape type (diagonal band, blob, arc, polygon, circuit line, dot grid, wave), scale relative to the canvas (e.g. "covers 60% of background"), fill treatment (solid, gradient, transparent), and exact position on the canvas]

HERO MOMENT
[The one unforgettable element that embodies the CONCEPT — its shape/type, exact size, fill treatment, and position. On posters it should command ≥40% of the canvas; on cards it is typically ≥30%, though a restrained direction may instead make a perfectly set wordmark the hero at a smaller footprint. This is what a viewer remembers.]

SUPPORTING ELEMENTS
[The concrete, placed graphic elements around the hero — INCLUDING any design asset supplied in the Style Direction, described by filename and exact placement if you use it — geometric systems, ornament, iconography, rules, framing, patterns, motifs — each specific (e.g. "circular SVG icon row for contact, bottom-left" not "some icons"). HOW MANY is set by the density contract: 4–6 for a rich direction, 2–4 for balanced, 1–3 for restrained. Listing fewer because the direction is restrained is correct, not a shortfall.]

CSS TECHNIQUES
[Only the techniques this design actually uses — from: clip-path, conic-gradient, radial-gradient, multi-stop linear-gradient, mix-blend-mode, inline SVG path, CSS filter, multi-layer box-shadow, backdrop-filter, ::before/::after shapes]

ATMOSPHERE
[1 sentence: overall mood and one specific design reference — a brand, publication, designer, or real-world example — that captures this direction precisely]

IMAGE INTEGRATION
[Only if an Image URL is provided: 2–3 sentences on crop shape, frame treatment, overlay/tint, and how the photo connects to adjacent typography and color fields. Write "N/A" if no image URL provided.]

SVG INTEGRATION
[Only if User SVG Logo is provided: 2–3 sentences on exact logo placement (e.g. top-left corner, bottom-right, centered above headline), size as a percentage of canvas width, and how it connects to the surrounding palette and typography. Write "N/A" if no SVG provided.]

{{DS_SPEC_NOTE}}`;

// ── Pass 2: Developer implements spec as HTML ────────────────────────────────
const HTML_PROMPT = `You are an elite front-end developer AND award-winning graphic designer implementing a precise creative brief as print-ready HTML/CSS. The output must look like a premium print shop business card ($500+ quality) — comparable to D&AD-winning stationery design. Execute the spec exactly.

DESIGN SPEC
{{DESIGN_SPEC}}

INPUTS
Product: {{PRODUCT_TYPE}}
Dimensions: {{DIMENSIONS}}
Business Name: {{BUSINESS_NAME}}
Industry: {{INDUSTRY}}
Colors: {{COLORS}}
Style Direction: {{STYLE_DIRECTION}}
Special Instructions: {{SPECIAL_INSTRUCTIONS}}
Image URL: {{IMAGE_URL}}
User SVG: {{SVG_CONTENT}}

{{LAYOUT_BUDGET}}

BUILD THE IDEA — exactly what the spec describes, at the density its Style Direction sets:
- Build the BACKGROUND the spec specifies. If it describes a layered ground, build every layer. If it describes a calm or single considered ground, build THAT — do not add gradients, patterns or extra fields the spec did not ask for.
- Make the HERO MOMENT unmistakable at the size and treatment the spec gives it.
- Implement the spec's SUPPORTING ELEMENTS — all of them, and ONLY them — monograms/emblems/icons as inline SVG, splits as clip-path panels, ornament and rules via CSS/pseudo-elements, patterns via gradients/repeating-linear-gradient. Adding elements the spec did not list is as wrong as dropping ones it did.
- Confident scale contrast: the hero/headline is clearly dominant (typically ≥2.5× the body/contact text).
- FIT IS MANDATORY: size display type so every glyph sits fully inside the safe width with margin. If the business name is too wide at your chosen size, REDUCE the size or break it onto two lines — never let a letter clip an edge, and never hide overshoot with overflow:hidden. Reserve vertical room for every line so nothing cuts off at the bottom.

TECHNICAL REQUIREMENTS
- Outer container fixed to exact pixel dimensions (1in = 96px, 1mm = 3.7795px — round to integer)
- LAYER MODEL:
  • Background layer (z-index 0–1): position:absolute background color, decorative shapes, bands, motifs, patterns — ALL the rich graphics live here, behind the text.
- NOTHING CROSSES TEXT (critical legibility rule): NO element — decorative shape, oversized number/letter, monogram/emblem, metric tile, badge, chip, or icon — may overlap or cross ANY text (business name, tagline, person, title, or contact line) in a way that reduces legibility. Give large graphics and UI tiles (stat cards, badges, big numbers) their OWN clear region, separated from all text by a gap. A large monogram/emblem placed behind text must be low-opacity (≤0.15) or offset so no stroke crosses a glyph. Every word — name, tagline, and each contact line — stays crisply legible.
  • Image wrapper (z-index 10) if a photo is present.
  • Text layer (z-index 20): a SINGLE flex container holding all copy — see TEXT LAYOUT.
- TEXT LAYOUT — this structure makes text overlap and clipping STRUCTURALLY IMPOSSIBLE; use it exactly:
  • Wrap ALL text in ONE flex container filling the card: .content { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; justify-content:space-between; padding:[safe inset ~22-28px]px; box-sizing:border-box; }
  • Inside .content, use at most TWO flex blocks: .zone-copy (business name + tagline) at the top, and .zone-contact (person name, title, contact lines) at the bottom. Each is display:flex; flex-direction:column; gap:6–8px.
  • Because flex flows these, text can NEVER overlap or clip as long as it fits. Do NOT give individual text lines (name, tagline, person, title, contact) their own position:absolute or a hardcoded top — let flex place them. NEVER absolutely-position a text block at a middle/low top value.
  • For asymmetric or offset placement, use align-items (flex-start/center/flex-end), padding, gap, or max-width on the zones — NEVER by absolutely positioning individual lines.
  • One contact/icon system only — never both a .contact-group and a separate .icon-row.
  • NEVER apply margin-top/margin-bottom over ~16px, or transform:translateY, to .zone-copy/.zone-contact — a big margin (e.g. margin-top:130px to clear a centered emblem) pushes the text off the card and clips it. Vertical placement is done ONLY by .content's justify-content plus small gaps.
  • On cards ≤240px tall, do NOT stack a large emblem/medallion directly ABOVE a multi-line business name — there is not enough height and the name will clip. Make the wordmark itself the hero, or keep the emblem in the background layer behind/beside the text (small or offset), never stacked above it in the flow.
  • line-height ≥1.05 for display headlines, ≥1.35 for body/contact.
- Honor the spec's zone plan (which text sits in .zone-copy vs .zone-contact, and whether copy is top-anchored or centered) — but always via the flex .content structure above, never per-line absolute tops.
- CSS custom properties (--var) for every color, font stack, and key measurement from the spec
- Google Fonts @import in <head> for all fonts named in TYPOGRAPHY
- @media print: margin:0; and @page { size: [W]px [H]px; margin: 0; }
- Pure HTML and CSS only — no JavaScript. Inline SVG is allowed. <img> is allowed for a user-provided Image URL, for a supplied photograph, for a supplied brand mark, and for any supplied design asset, and for nothing else.
- Implement the techniques listed under CSS TECHNIQUES in the spec
- Large-scale shapes MUST be built with CSS clip-path, SVG path elements, or pure CSS geometry
- Typography MUST match the spec font exactly — do not substitute a different font family
- The layout MUST honor the LAYOUT direction from the spec — do not default to centered-text stacks

SUPPLIED BRAND MARK — when the Style Direction supplies one:
- Reference the file with its exact given path. Use it as <img> when it stays black (or filter:invert(1) for white); to recolour it to the palette, use a div sized to the mark with style="background:[colour];-webkit-mask:url([src]) center/contain no-repeat;mask:url([src]) center/contain no-repeat"
- Preserve its aspect ratio and transparency — contain, never stretch
- ONE appearance as the design's mark; it consumes a graphic-element slot in the density contract
- Leaving it out is legitimate if pure typography serves the design better

SUPPLIED PHOTOGRAPH — when the Style Direction supplies one:
- Reference it with <img src="[the exact src given]"> — the path is relative to this page and resolves as written. Do not rename it, do not inline it, do not invent a different file
- It is the hero image and the ONLY photograph in the design — never add, invent or link a second image
- Build the photo AREA to suit the FILE, not the canvas: a portrait file gets a vertical side panel, tall inset or vertical hero even on a landscape product; a landscape file gets a horizontal band or wide hero even on a portrait product. Size the area to the file's aspect and use object-fit: cover (or an equivalent clip) inside it — never stretch or squash the image
- Integrate it: crop with clip-path, mask into a shape, duotone/tint into the palette, bleed it off an edge, or give it a full panel. Never a plain unstyled rectangle
- Obey the band grades it carries. Important text must NOT sit on a band graded poor unless you first lay the scrim the Style Direction specifies over that area
- Where a scrim is marked REQUIRED, no headline, sub-head or contact line may touch the photograph without one

SUPPLIED DESIGN ASSETS — when the Style Direction lists one:
- Reference it with <img src="[the exact src given]"> — the path is relative to this page and resolves as written. Do not rename it, do not inline it, do not invent a different file
- It counts AGAINST the density contract, it does not extend it — one supplied asset means one fewer element you draw
- Integrate it: crop with clip-path, mask, tint with a filter or a blended overlay, overlap a colour field, or bleed it off an edge. Never a plain unstyled rectangle
- Behind text ONLY if the Style Direction says it may, and then at or below the opacity it names, with every line still crisply legible
- Otherwise keep it in a corner, at an edge, in a margin, or in its own clear zone, never crossing a glyph
- Leaving it out is a legitimate choice if the composition is genuinely better without it

EXTERNAL IMAGES — when an Image URL is provided:
- Use <img src="URL"> for that user-provided image (this overrides the default no-external-images rule)
- NEVER place a raw unstyled rectangle. Integrate the photo using at least TWO of: clip-path crop, border-radius, gradient/color overlay on a wrapper ::after, mix-blend-mode tint matching the palette, decorative SVG frame, offset box-shadow panel, overlap with an adjacent color field, or masked bleed into a shape
- The image must feel designed-in — cropped with intent, aligned to the grid, and visually connected to surrounding typography and color blocks
- Follow IMAGE INTEGRATION from the spec if provided

{{DS_HTML_NOTE}}

USER SVG LOGO — when User SVG markup is provided, treat it as the brand logo:
- Embed the SVG inline exactly as provided (preserve viewBox and paths). Do NOT recreate, simplify, or alter the paths
- Always position it as the primary logo — typically top-left or top-center, following standard print layout conventions for the template type
- Follow SVG INTEGRATION from the spec for exact placement, size, and relationship to other elements
- Size it proportionally — typically 15–25% of canvas width unless the spec directs otherwise
- Apply CSS fill/stroke color overrides ONLY if needed to ensure contrast against the background; otherwise preserve original colors
- Do NOT use external references inside the SVG — inline only

ANTI-PATTERNS — NEVER DO THESE:
- Do NOT produce a careless single-color card — an unconsidered ground with text dropped on it and no compositional thinking. (A DELIBERATE calm ground specified by a restrained spec is a different thing and is correct.)
- Do NOT invent decoration the spec did not call for, and do NOT reduce what it did
- Do NOT substitute a palette of your own for the one the spec names
- Do NOT stack multiple text elements at the same top coordinate
- Do NOT absolutely-position taglines/subheads over headlines
- Do NOT let diagonal bands, lines, or shapes cross through text
- Do NOT ignore the provided Image URL or User SVG
- Do NOT drop the HERO MOMENT or the SUPPORTING ELEMENTS the spec lists
- Do NOT put contact info inside .zone-copy on small cards (height ≤ 240px)
- Do NOT use gap:0 on .zone-copy
- Do NOT duplicate icon rows (.contact-group + .icon-row)
- Do NOT let any text clip or fall off ANY edge (top, bottom, left, right) — every glyph must sit fully inside the canvas with ≥10px padding; scale display type down or break lines to fit rather than clipping
- Do NOT set the business name as vertical/rotated text unless it clearly fits the card's HEIGHT — a rotated wordmark longer than the card's shorter dimension clips top and bottom. Prefer horizontal display type; use vertical text only for a short word that fits with margin

RECIPES FOR RESTRAINED DIRECTIONS (editorial minimal, elegant serif, clean corporate, soft sophisticated, modern luxury — reach for these there):
- Hairline rule system: border-top:1px solid var(--rule) with generous margin, or a 1px ::after spanning a set fraction of the width
- Tracked small caps: text-transform:uppercase; letter-spacing:.18em; font-size:9–11px; font-weight:500
- Composed whitespace: an asymmetric padding scale (e.g. 28px 28px 24px 40px) and a max-width on the copy block so the field around it is deliberate
- Paper ground: a single warm off-white (#faf7f2 / #f4f1e8) with no gradient — flat is correct here
- Optical wordmark: one family, two sizes, precise letter-spacing (-0.01em display, +0.14em labels) — the setting is the design
- Tone-on-tone mark: a monogram at 4–8% opacity in the ground, or a mark in the same hue one step darker

ADVANCED EFFECT RECIPES (reach for these ONLY when the concept genuinely calls for them — skip entirely for restrained directions):
- Neon glow: text-shadow: 0 0 7px #0ff, 0 0 20px #0ff, 0 0 40px #f0f on the headline
- Chrome type: background: linear-gradient(180deg,#fff,#aaa 45%,#fff 50%,#888); -webkit-background-clip:text; -webkit-text-fill-color:transparent
- Paper grain / halftone: SVG feTurbulence, or radial-gradient(circle,#000 .5px,transparent .5px) background-size 4px, at ~10% opacity
- Dashboard block: border:1px solid rgba(255,255,255,.15); border-radius:4px; label in 8px caps + value in bold monospace
- Sparkline / bar chart: inline SVG polyline or rects with stroke/fill var(--accent)
- Curved photo portal / nested depth: clip-path on the image wrapper, or stacked SVG polygons at decreasing opacity

SHAPE IMPLEMENTATION GUIDE (use the right technique for the aesthetic):
- Diagonal color bands → clip-path: polygon() on a full-bleed div (e.g. "polygon(0 0, 70% 0, 55% 100%, 0 100%)")
- Organic blobs → clip-path with rounded polygon or inline SVG <path> with bezier curves
- Geometric arcs → inline SVG <circle> or <arc> with stroke or fill
- Circuit / grid lines → inline SVG <line> or <polyline> elements
- Dot grids → radial-gradient pattern or inline SVG <circle> repeats
- Hard geometric blocks → clip-path: polygon() with sharp angles for cut shapes

CODE RULES
Compact, non-repetitive CSS. Use shorthand and CSS variables throughout. No duplicate declarations. No inline styles unless unavoidable. Use ::before/::after pseudo-elements for atmospheric shapes. Express gradients, clip-paths, and SVG motifs efficiently.

Return in this exact order with nothing else before, between, or after:

One \`\`\`html code block containing the complete self-contained file.

DESIGN SUMMARY
A 2–3 sentence description of the artistic direction and visual strategy.`;

// ── JSON schema prompt ───────────────────────────────────────────────────────
const JSON_SCHEMA_PROMPT = `You are a design system architect. Given the print-ready HTML design template below, generate its complete JSON schema.

Return a valid JSON object with these top-level keys:
- template_metadata (product_type, industry, dimensions, units, sides, bleed, safe_area)
- color_palette
- typography
- editable_fields
- layers (each with: id, side, type, name, x, y, width, height, rotation, opacity, z_index, editable, locked, styles, content)
- export_settings

Layer types: text, shape, decorative_element, background, image_placeholder, logo_placeholder, qr_placeholder.

Return ONLY the JSON inside one json code block. No explanation, no other text.

HTML:
\`\`\`html
{{HTML}}
\`\`\``;

async function handleGenerate(body, send) {
  const {
    templateType,
    width,
    height,
    unit,
    industry,
    businessName,
    colors,
    styleDirection,
    specialInstructions,
    imageUrl,
    svgContent,
    doubleSided,
    creativityLevel,
    referenceImage,
    referenceImageUrl,
    referenceMode,
    orientation,
  } = body;

  if (!templateType) { send({ error: 'Template type is required.' }); return; }
  if (!width || !height) { send({ error: 'Width and height are required.' }); return; }

  // ── Print bleed: expand the canvas so backgrounds can bleed past the trim ──
  const bleedPx = getBleedPx(templateType);
  const trimWpx = toPx(width, unit);
  const trimHpx = toPx(height, unit);
  const canvasWpx = trimWpx + bleedPx * 2;
  const canvasHpx = trimHpx + bleedPx * 2;

  /* Orientation is stated explicitly, and the width/height passed in are
   * already ordered for it — the composition is CREATED for this orientation,
   * never generated one way and rotated afterwards. */
  const orientationWord = orientation === 'portrait' ? 'PORTRAIT (vertical)'
    : orientation === 'landscape' ? 'LANDSCAPE (horizontal)'
    : (trimHpx > trimWpx ? 'PORTRAIT (vertical)' : 'LANDSCAPE (horizontal)');
  const orientationNote = ` — ${orientationWord} orientation: compose FOR this `
    + `aspect; width and height above are final and must not be swapped`;
  const dimensions = (bleedPx > 0
    ? `${canvasWpx} x ${canvasHpx} px (includes ${BLEED_IN}" bleed on all sides; trim/finished size ${trimWpx} x ${trimHpx} px)`
    : `${width} x ${height} ${unit || 'px'}`) + orientationNote;

  const colorParts = [];
  const colorLabels = ['Primary', 'Secondary', 'Tertiary', 'Quaternary'];
  const colorKeys  = ['primary', 'secondary', 'tertiary', 'quaternary'];
  if (colors && typeof colors === 'object') {
    colorKeys.forEach((key, i) => {
      if (colors[key]) colorParts.push(`${colorLabels[i]}: ${colors[key]}`);
    });
  }
  // When the user gives no colors: if they chose a real style, that style's signature palette
  // must win (never override it with a random industry palette). Only fall back to industry
  // guidance when there is no style direction at all.
  /* A REFERENCE BEING RECREATED IS THE VISUAL AUTHORITY. Known before any
     selector runs, because every automatic choice below must stand down for
     it: a rotated direction, a hero stock photo, a library mark or a
     decorative asset each carries its own strong prompt language, and letting
     them compose ahead of the recreate note is exactly how an uploaded retro
     arc card came back as a teal corporate layout with a stock photograph.
     The customer's own supplied photo (imageUrl) still flows through the
     normal EXTERNAL IMAGES path — that is the "user explicitly supplied
     photography" case and it is welcome in a recreation. */
  const willRecreate = referenceMode === 'recreate'
    && !!((referenceImage && referenceImage.data && referenceImage.mediaType)
          || (referenceImageUrl || '').trim());

  const hasChosenStyle = (styleDirection || '').trim() && !GENERIC_STYLE.test((styleDirection || '').trim());
  const userSetColors = colorParts.length > 0;
  const colorScheme = colorParts.length > 0
    ? `${colorParts.join(', ')} — USER-SELECTED PALETTE, MANDATORY: build the design's palette from EXACTLY these hex values (plus black/white/neutrals as needed). They take priority over any signature palette named in the Style Direction — do not substitute different hues.`
    : (hasChosenStyle
        ? 'No colors specified — use the signature palette described in the Style Direction. Do NOT substitute a different palette; stay true to the style\'s named colors. (If the Style Direction truly implies no palette, invent a distinctive premium one that suits the industry and the direction.)'
        : getColorGuidance(industry));
  /* Large-format DEFAULTS commit to a colour move. Only when the user set no
     colours AND chose no style: their choices always win untouched. The stance
     rotates per brief, so repeated generations land on visibly different
     palettes instead of six variations of the same tasteful mid-register. */
  let colorSchemeFinal = colorScheme;
  {
    const lfTrimWin = toPx(width, unit) / 96;
    const lfTrimHin = toPx(height, unit) / 96;
    if (!userSetColors && !hasChosenStyle && !willRecreate
        && isLargeFormatForAssets(templateType, lfTrimWin, lfTrimHin)
        && !/stamp/i.test(templateType || '')) {
      const stanceKey = JSON.stringify([templateType, industry || '', businessName || '']);
      /* The stance LEADS. Trailing it after the industry pool's refined
         suggestion let the model settle into the tasteful mid-register anyway;
         at display scale the stance is the palette decision and the industry
         reads as context, not as the starting point. */
      colorSchemeFinal = rotateColorStance(stanceKey)
        + '\nThe stance above is the palette decision for this piece — commit to it. '
        + 'Suit it to the industry without retreating to a default beige, cream, or sage-and-rust scheme.';
    }
  }

  // Resolve creative direction — replace generic "corporate" with portfolio archetypes
  /* Identifies THIS brief. Regenerate resends the identical payload, so this is
     what lets the default path recognise a repeat and rotate to a different
     concept instead of drawing the same one again. */
  const variationKey = JSON.stringify([
    templateType, industry || '', businessName || '', styleDirection || '',
    specialInstructions || '', colors || null, !!doubleSided, orientation || '',
  ]);
  /* Both libraries load once and never block a generation: if a manifest cannot
     be fetched, the selector simply returns nothing and says why. They are
     separate files, separate caches and separate selectors — a stock photo is
     content, a design asset is decoration, and neither can reach the other's
     pool. The logo library is not touched by any of this. */
  await Promise.all([loadAssetLibrary(), loadStockPhotoLibrary(), loadLogoLibrary()]);
  /* Trim size in inches, so a real sign is recognised as large format even when
     the Template Type still says Business Card — which is exactly what happens
     on web03, where the live catalogue supplies no productFamily. */
  const trimWin = trimWpx / 96;
  const trimHin = trimHpx / 96;
  /* THE CUSTOMER'S OWN PHOTOGRAPH ALWAYS WINS. imageUrl carries both a typed
     URL and an upload (app.js substitutes a placeholder URL for the uploaded
     file), so one truthy value means the brief already has its photography and
     the stock library must stay out of it entirely. */
  const hasCustomerPhoto = !!((imageUrl || '').trim());
  const tStock0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const stockSelection = willRecreate
    ? (lastStockReason = 'a reference design is being recreated', null)
    : pickStockPhoto({
    /* Inference material, in one string through one matcher: the Industry
       field leads, and the business name and special instructions let a blank
       field still resolve "Chen Family Dental" to dentistry. Template Type is
       already a separate input to the product policy. */
    industryText: [industry, businessName, specialInstructions].filter(Boolean).join(' '),
    explicitIndustry: industry,
    templateType: templateType,
    widthIn: trimWin,
    heightIn: trimHin,
    hasCustomerPhoto: hasCustomerPhoto,
    memoryKey: variationKey,
  });
  const tStock1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const stockSelectMs = Math.round((tStock1 - tStock0) * 1000) / 1000;

  /* THE CUSTOMER'S OWN LOGO ALWAYS WINS: a supplied SVG is the brand mark and
     the library stays out of it entirely, in every mode. */
  const hasCustomerLogo = !!((svgContent || '').trim());
  const tLogo0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const logoSelection = willRecreate
    ? (lastLogoReason = 'a reference design is being recreated — its own mark leads', null)
    : pickLogo({
    industryText: [industry, businessName, specialInstructions].filter(Boolean).join(' '),
    templateType: templateType,
    widthIn: trimWin,
    heightIn: trimHin,
    hasCustomerLogo: hasCustomerLogo,
    memoryKey: variationKey,
  });
  const tLogo1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const logoSelectMs = Math.round((tLogo1 - tLogo0) * 1000) / 1000;

  /* RECREATION REPLACES the creative direction outright — this is the proven
     pre-Phase-1 shape of the prompt, where the recreate note WAS the style
     direction instead of trailing a full competing brief (rotated direction,
     density contract, photo/mark/asset blocks, colour stance). An explicitly
     typed Style Direction survives as a modifier, since the user asked for it. */
  const creative = willRecreate
    ? (function () {
        const rawStyle = (styleDirection || '').trim();
        const explicitStyle = rawStyle && !GENERIC_STYLE.test(rawStyle)
          ? expandStyleDirection(rawStyle) : '';
        return {
          text: explicitStyle
            ? 'USER STYLE MODIFIER — applies ON TOP of the reference recreation below, without replacing its composition: ' + explicitStyle
            : '',
          direction: null, assets: [],
          assetReason: 'a reference design is being recreated',
          assetSelectMs: 0,
          largeFormat: isLargeFormatForAssets(templateType, trimWin, trimHin),
          assetMode: assetMode(),
        };
      }())
    : chooseCreativeDirection(styleDirection, industry, templateType,
        creativityLevel, variationKey, doubleSided, trimWin, trimHin, stockSelection, logoSelection);
  let styleDirFinal = creative.text;
  const chosenAssets = creative.assets || [];
  console.info('[generator] direction: ' + (creative.direction || 'user-chosen')
    + ' | ' + (creative.largeFormat ? 'large-format' : 'small-format')
    + ' | assets: ' + (chosenAssets.map((a) => a.family + '/' + a.filename).join(', ')
        || 'none (' + (creative.assetReason || 'unknown') + ')')
    + ' | selection took ' + creative.assetSelectMs + 'ms');
  console.info('[generator] stock photo: '
    + (stockSelection ? stockSelection.photo.file + ' (industry: ' + stockSelection.industry + ')'
        : 'none (' + (lastStockReason || 'unknown') + ')')
    + ' | selection took ' + stockSelectMs + 'ms');

  /* Published for the DEV asset indicator in app.js. Read-only reporting of a
     decision already made — nothing here influences selection, the prompts, or
     the generated design, and the page decides whether to show it. */
  window.SMPLastAssetSelection = {
    direction: creative.direction || null,
    assets: chosenAssets.map((a) => ({
      filename: a.filename, family: a.family, family_role: a.family_role, url: a.url,
      card_background_safe: a.card_background_safe,
    })),
    reason: creative.assetReason || '',
    selectMs: creative.assetSelectMs,
    largeFormat: creative.largeFormat,
    mode: creative.assetMode,
    format: creative.largeFormat ? 'large-format' : 'small-format',
  };
  try {
    window.dispatchEvent(new CustomEvent('smp:assets-selected',
      { detail: window.SMPLastAssetSelection }));
  } catch (e) { /* older browsers — the global is still there */ }

  /* Published for the DEV stock-photo indicator in app.js. Read-only reporting
     of a decision already made — a separate global and a separate event from
     the design assets, because they are separate libraries. */
  window.SMPLastStockPhoto = stockSelection
    ? {
        file: stockSelection.photo.file,
        id: stockSelection.photo.id,
        url: stockSelection.photo.url,
        subject: stockSelection.photo.subject,
        industry: stockSelection.industry,
        matchedIndustries: stockSelection.matchedIndustries,
        orientation: stockSelection.photo.orientation,
        roles: stockSelection.roles,
        requiresScrim: !!(stockSelection.photo.overlay_guidance || {}).requires_scrim_for_text,
        reason: '',
        selectMs: stockSelectMs,
        format: stockSelection.largeFormat ? 'large-format' : 'small-format',
        productClass: stockSelection.productClass,
        mode: stockSelection.mode,
      }
    : {
        file: null,
        reason: lastStockReason || 'unknown',
        selectMs: stockSelectMs,
        format: isLargeFormatForAssets(templateType, trimWin, trimHin) ? 'large-format' : 'small-format',
        productClass: stockProductClass(templateType, trimWin, trimHin),
        mode: stockPhotoMode(),
      };
  try {
    window.dispatchEvent(new CustomEvent('smp:stock-photo-selected',
      { detail: window.SMPLastStockPhoto }));
  } catch (e) { /* older browsers — the global is still there */ }

  /* Published for the DEV logo indicator — read-only reporting, like the rest. */
  window.SMPLastLogoSelection = logoSelection
    ? { file: logoSelection.logo.filename, name: logoSelection.logo.name,
        url: logoSelection.logo.url, tier: logoSelection.tier,
        type: logoSelection.logo.symbol_type, reason: '',
        selectMs: logoSelectMs, mode: logoSelection.mode }
    : { file: null, reason: lastLogoReason || 'unknown',
        selectMs: logoSelectMs, mode: logoMode() };
  try {
    window.dispatchEvent(new CustomEvent('smp:logo-selected',
      { detail: window.SMPLastLogoSelection }));
  } catch (e) { /* older browsers — the global is still there */ }

  const hasRefUpload = referenceImage?.data && referenceImage?.mediaType;
  const hasRefUrl = (referenceImageUrl || '').trim();
  const recreateRef = referenceMode === 'recreate';
  let refImageForGen = null;   // shown to the spec/HTML models in recreate mode
  let recreatingRef = false;   // true once a reference is analysed for recreation

  if (hasRefUpload || hasRefUrl) {
    send({ phase: 0 });
    try {
      const img = hasRefUpload
        ? referenceImage
        : await fetchReferenceImageFromUrl(referenceImageUrl.trim());
      const inspiration = await analyzeReferenceImage(img, recreateRef ? 'recreate' : 'inspire');
      if (recreateRef) {
        recreatingRef = true;
        refImageForGen = img;
        styleDirFinal += `\n\nREFERENCE DESIGN TO RECREATE — the user uploaded an existing design and wants it reproduced as an editable template, NOT reinterpreted. The reference is the PRIMARY VISUAL AUTHORITY for this generation: reproduce its overall composition, its major shapes at their approximate proportions, its visual hierarchy and alignment, its typography personality, its colour relationships, its spacing, its borders and frames, its texture treatment, any image placement, and its distinctive effects — curved or arc-following text, oversized concentric arcs, grain, and the like — using editable HTML/CSS/inline-SVG. CONTENT: where the user supplied their own business name or details, place THEIR content in the SAME typographic role the reference gives its own; where they supplied none, keep the reference's. If the reference shows a FRONT and a BACK, reproduce BOTH sides. Adapt intelligently to this product's real dimensions, bleed and safety margins if the aspect ratio differs — preserve the composition, never letterbox or distort it. This note OVERRIDES every generic instruction elsewhere in this prompt where they conflict: ignore any default direction, density, palette-stance, format-style or "invent an original design" guidance. Match what you see.\n\n${inspiration}`;
      } else {
        styleDirFinal += `\n\nSTYLE REFERENCE INSPIRATION (channel this creative energy for an ORIGINAL design — do NOT clone or recreate the reference image literally):\n${inspiration}`;
      }
    } catch (err) {
      console.warn('Reference image analysis skipped:', err.message);
    }
  }

  const layoutBudget = getLayoutBudget(width, height, unit, templateType, bleedPx, businessName)
    + getBleedNote(bleedPx, canvasWpx, canvasHpx, trimWpx, trimHpx);

  const imageUrlValue   = imageUrl?.trim()   || 'None';
  const svgContentValue = svgContent?.trim() || 'None';
  // In recreate mode, defer brand to the reference unless the user typed one.
  const brandValue = businessName || (recreatingRef ? 'Use the EXACT brand/company name from the REFERENCE DESIGN above' : 'Create tasteful placeholder branding');

  // ── Large-format poster/sign notes injected into prompts ─────────────────
  const isLargeFormat = /poster|sign/i.test(templateType || '');
  const isStamp       = /stamp/i.test(templateType || '');
  const isNameplate   = /nameplate|name badge|name tag/i.test(templateType || '');
  const pxW = canvasWpx;
  const pxH = canvasHpx;

  let posterSpecNote = '';
  let posterHtmlNote = '';

  if (isLargeFormat) {
    posterSpecNote = `
FORMAT OVERRIDE — LARGE FORMAT ${templateType.toUpperCase()} (${pxW}×${pxH}px):
This is NOT a business card. Reference quality: award-winning theatrical posters, gallery announcements, festival bills, editorial magazine covers.
- TYPOGRAPHY SCALE for this canvas: headline 140–280px, subhead 36–72px, body info 18–28px, fine detail 14–18px
- SPEC TYPE POSITIONS must use these large-format px values — not business-card values
- One element in the spec must be described as covering ≥40% of canvas (e.g. a 900px color field, a full-width image zone, a 500px geometric shape)
- HERO MOMENT must read from 15 feet away — a massive typographic form, a dramatic color collision, or a full-bleed compositional moment
- LAYOUT must specify one of: horizontal thirds, two-column grid, diagonal split, or full-bleed layered composition
- SUPPORTING ELEMENTS must scale to large format — no "80–140px monogram" or "48px lettermark" — think 300–600px for hero shapes`;

    posterHtmlNote = `
LARGE FORMAT POSTER/SIGN IMPLEMENTATION (${pxW}×${pxH}px) — MANDATORY OVERRIDES:
- font-size values of 120px–300px are CORRECT and EXPECTED for display type on this canvas
- DO NOT produce a "scaled-up business card" — photo on right + text stack on left = AUTOMATIC FAIL
- STRUCTURE: Use CSS grid rows or absolute-positioned zones to create horizontal bands or column grid
- HERO ELEMENT: One element dominates — a massive headline, a full-width color field, a 400px+ geometric shape, or an image zone
- SHAPES at poster scale: circles at 300–600px diameter, diagonal clip-path bands spanning full canvas width, color field panels covering 40–60% of canvas height
- TYPOGRAPHY: three visible tiers — display (140px+), subhead (40–70px), detail (14–20px) — all must be visible and clearly differentiated
- BLEEDING EDGES: at least one shape or color field must touch the canvas edge on 2+ sides
- BACKGROUND: Use at least 2 color zones — top and bottom bands, diagonal split, or layered gradients — never a single flat fill with text dropped on it
- .zone-copy four-item limit and .zone-contact separation rules DO NOT APPLY to large format posters — use whatever HTML structure best serves the design
- FORBIDDEN on this canvas: typography below 120px for any headline element, business-card-style layout at any scale, centered text stack on plain background`;
  }

  // ── Stamp: override color scheme to monochromatic ───────────────────────
  let effectiveColorScheme = colorSchemeFinal;
  if (isStamp) {
    effectiveColorScheme = 'STAMP MONOCHROMATIC MANDATORY: Background #ffffff (white paper), all ink #000000 (pure black). NO other colors, NO grey tones, NO rgba opacity tricks. Self-inking stamps print black ink only.';
  }
  // In recreate mode, use the reference's own colours unless the user set a palette (stamps stay mono).
  const colorsValue = (recreatingRef && !userSetColors && !isStamp)
    ? 'Use the EXACT colours from the REFERENCE DESIGN above — match the hex values given for background, primary, accent and text. Do NOT substitute a different palette.'
    : effectiveColorScheme;

  // ── Double-sided notes injected into prompts ─────────────────────────────
  const isBrochure = templateType === 'Brochure';
  let dsSpecNote = posterSpecNote;
  let dsHtmlNote = posterHtmlNote;

  if (doubleSided) {
    if (isBrochure) {
      dsSpecNote += `
DOUBLE-SIDED BROCHURE (tri-fold, letter size) — SPEC FOR BOTH SIDES REQUIRED:

FRONT SIDE (outside) — three panels:
  • Right panel (Front Cover): hero panel — main business name, logo mark, hero visual or photo, tagline
  • Center panel (Inside Flap): teaser panel — one strong hook statement, 2–3 value icons with labels
  • Left panel (Back Cover): contact panel — phone, email, address with icon row, small logo, subtle texture

INSIDE SPREAD — three panels forming one cohesive editorial interior:
  • Left inside panel (Panel 1): Brand story or "About Us" — large display quote or mission statement (32–40px), 2–3 short body paragraphs, accent color field covering top 35–40% of panel height
  • Center inside panel (Panel 2): Services or Offerings — headline, 4–6 service items each with a small inline SVG icon and 1-line description, cream or light background for readability
  • Right inside panel (Panel 3): Call-to-action — bold CTA headline (28–36px), 3–4 bullet-point reasons to choose this business, prominent button-style CTA block, contact info repeat, logo

Both sides share the same palette, typography, and decorative language. Inside panels must be fully designed — same visual quality as the outside. No blank panels.

After your standard spec sections (PALETTE through SVG INTEGRATION), add:

INSIDE SPREAD LAYOUT
[2–3 sentences: describe how the 3 interior panels flow as a connected editorial spread — visual direction, color field distribution, and typographic hierarchy across panels]

INSIDE PANEL DETAILS
Panel 1 (left — About/Story): [specific headline text suggestion, color treatment for top accent field, body copy style]
Panel 2 (center — Services): [specific service category names to use as placeholders, icon style, background color]
Panel 3 (right — CTA): [CTA headline text, button copy, accent treatment, how contact info is displayed]`;

      dsHtmlNote += `
DOUBLE-SIDED BROCHURE HTML STRUCTURE — MANDATORY: OUTPUT EXACTLY TWO COMPLETE .card ELEMENTS:

═══ CARD 1 — OUTSIDE SPREAD ═══
<div class="card card--front">  ← outside, three-panel grid
  display:grid; grid-template-columns:repeat(3,1fr); width:[fullW]px; height:[fullH]px;
  Left column (.panel-back): back cover — icon contact row (SVG circle icons for phone/email/address), logo, decorative texture
  Center column (.panel-flap): inside flap — hook headline, 3 value-prop icons with labels below each
  Right column (.panel-front): front cover — business name at 48–64px, tagline, hero graphic treatment, photo if provided

═══ CARD 2 — INSIDE SPREAD ═══
<div class="card card--back" style="display:none">  ← inside, same grid structure
  display:grid; grid-template-columns:repeat(3,1fr); width:[fullW]px; height:[fullH]px;

  PANEL 1 — Left inside (.panel-inside-left):
    • Accent color field (top 38% of panel height) — solid panel using var(--accent) or var(--secondary)
    • "About Us" or brand story section label (10px, spaced caps, var(--accent))
    • Large display pull-quote or mission statement (28–36px, headline font)
    • 2–3 paragraphs of body copy (13px, var(--body) font, 1.6 line-height)
    • Small logo or lettermark at bottom

  PANEL 2 — Center inside (.panel-inside-center):
    • Light/cream background for maximum readability
    • "Our Services" or equivalent section headline (22–28px)
    • 4–6 service items, each as a flex row: [32px SVG circle icon in var(--secondary)] + [service name bold 12px + descriptor 11px]
    • Thin border separator between items (1px, rgba of var(--secondary))
    • Optional: inset border frame matching outside flap style

  PANEL 3 — Right inside (.panel-inside-right):
    • Dark or saturated background (matching front cover palette)
    • Bold CTA headline (26–32px, accent color) — "Ready to Get Started?" or equivalent
    • 3–4 bullet points with small SVG dot markers and 13px body text
    • CTA button-style block: solid background var(--secondary), white text 11px spaced caps, 14px padding
    • Contact repeat: phone + email + website in small accent-colored text
    • Business name / logo lockup at bottom

FOLD LINES: subtle 1px dashed rgba(0,0,0,0.12) right-border on each .panel (except last)
@media print: show BOTH cards; page-break-after:always on .card--front; .card--back{display:grid!important;}
VISIBILITY RULE: hide the back card ONLY via the inline style attribute (style="display:none") on the .card--back div. NEVER write "display:none" for .card--back inside any <style> stylesheet rule — the app toggles visibility by changing the inline style, and a stylesheet rule would keep it permanently hidden.
Do NOT add JavaScript toggle — the app handles switching.
CRITICAL: .card--back MUST contain fully designed, visually rich HTML. An empty or near-empty .card--back is a FAILURE.`;
    } else if (templateType === 'Business Card') {
      dsSpecNote += `
DOUBLE-SIDED BUSINESS CARD — contact/details on FRONT, brand identity on BACK (this matches how users preview and hand out cards):
  FRONT (card--front): person name + title + ALL contact lines (phone, email, website, address) + a clean secondary graphic. This is the details side users see first.
  BACK (card--back): brand identity ONLY — business name (hero), tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines on the back.
Both sides share the same palette and typography. The person appears ONCE, on the front — do NOT invent a different name for each side.
If an Image URL is provided, the photo MUST be integrated on at least one side — typically as (part of) the BACK's hero graphic, or as the FRONT's secondary graphic — following IMAGE INTEGRATION. "Brand identity ONLY" refers to text content and NEVER excludes the user's photo.
If the user provided Colors, BOTH sides must be built from exactly those hex values as the dominant palette.`;

      dsHtmlNote += `
DOUBLE-SIDED BUSINESS CARD HTML STRUCTURE:
Output EXACTLY TWO .card containers in one HTML file:
1. <div class="card card--front"> — CONTACT / DETAILS SIDE (shown first in preview): person name + title + ALL contact lines (phone, email, website, address) + secondary graphic treatment.
2. <div class="card card--back" style="display:none"> — BRAND SIDE: business name, tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines here.
Both .card elements must be fixed to the exact same pixel dimensions, each using its own .content flex layer. The person's name and all contact info appear only on card--front.
Hide the brand side ONLY via the inline attribute style="display:none" on the .card--back div — do NOT put display:none in a <style> stylesheet rule.
@media print: show BOTH cards; add page-break-after:always on .card--front.
Do NOT add any JavaScript toggle — the app handles front/back switching externally.
If an Image URL is provided, embed it with <img> on at least one of the two cards (typically the back's hero graphic or the front's secondary graphic), integrated per the EXTERNAL IMAGES rules — omitting the provided photo is WRONG.
If the Colors input lists user-selected hex values, both cards' CSS custom properties MUST be built from exactly those values.`;
    } else {
      dsSpecNote += `
DOUBLE-SIDED ${templateType.toUpperCase()} — SPLIT THE CONTENT so neither side is crowded (like premium cards: brand on the front, person + details on the back):
  FRONT: brand identity ONLY — business name (hero), tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines on the front.
  BACK: the person — their name + title — plus ALL contact lines (phone, email, website, address) and a secondary/complementary graphic treatment.
Both sides share the same palette and typography but differ in layout and focus. The person appears ONCE, on the back — do NOT invent a different name for each side. Keeping the person and contact off the front gives the hero room to breathe.`;

      dsHtmlNote += `
DOUBLE-SIDED HTML STRUCTURE:
NON-NEGOTIABLE SPLIT: the FRONT card is brand-only and the BACK card holds the person + all contact. If any phone/email/website/address or the person's name appears on the FRONT, the output is WRONG. Do NOT compress everything onto one card — build two distinct cards.
Output EXACTLY TWO .card containers in one HTML file:
1. <div class="card card--front"> — brand side: business name, tagline, logo/emblem, hero graphic. NO person name, NO title, NO contact lines here.
2. <div class="card card--back" style="display:none"> — details side: person name + title + ALL contact lines (phone, email, website, address) + a secondary graphic.
Both .card elements must be fixed to the exact same pixel dimensions, each using its own .content flex layer. The person's name appears only on the back.
If an Image URL is provided, embed it with <img> on at least one of the two cards, integrated per the EXTERNAL IMAGES rules — omitting the provided photo is WRONG.
Do NOT crowd the front — moving the person and contact to the back is what keeps the front clean and clip-free.
Hide the back ONLY via the inline attribute style="display:none" on the .card--back div — do NOT put display:none in a <style> stylesheet rule.
@media print: show BOTH cards; add page-break-after:always on .card--front.
Do NOT add any JavaScript toggle — the app handles front/back switching externally.`;
    }
  }

  // ── Stamp: append monochromatic override notes ───────────────────────────
  if (isStamp) {
    dsSpecNote += `
STAMP DESIGN OVERRIDE — NON-NEGOTIABLE:
This is a self-inking rubber stamp (${pxW}×${pxH}px). Physical stamps print in ONE COLOR — black ink on paper.

PALETTE OVERRIDE (hard rule — no exceptions):
Background: #ffffff
Primary: #000000
Secondary: #000000
Accent: #000000
Text: #000000
Text-muted: #000000
(Reversed text on filled shapes: white #ffffff on black #000000 fill — permitted)

DESIGN CONSTRAINTS:
- MAX 6 LINES of text total — self-inking stamps have a physical line limit
- SIMPLE BOLD GEOMETRY ONLY: straight borders, horizontal rules, solid bars, corner brackets — no gradients, no shadows, no complex illustration
- Type must be BOLD or HEAVY weight — light/thin fonts blur in stamp impression
- Every design element must survive actual rubber stamp impression quality (high contrast, clean edges, no fine detail)
- Be CREATIVE within monochrome: use reversal (white-on-black), border variation, weight drama, rule patterns
- The design should feel like a premium custom rubber stamp — intentional, not default

SIMPLICITY OVERRIDE — supersedes ALL generic complexity rules in this brief:
- SUPPORTING ELEMENTS: list only 2–3 simple elements — (1) the border/frame or bar treatment, (2) one rule or divider system, (3) the typography treatment. Any "add more elements" pressure DOES NOT APPLY to stamps.
- HERO MOMENT = bold typography or one solid reversed black bar. Nothing else.
- STRICTLY FORBIDDEN in this spec: arced text, curved text, rotated text, text on a circular path, ovals, radial bursts, starbursts, ornamental notches, decorative icons, monograms overlapping text, ANY element that intersects the text column
- TYPE POSITIONS: a simple vertical stack of straight horizontal text lines, every line fully inside the canvas with clear separation — nothing else`;

    dsHtmlNote += `
STAMP MONOCHROMATIC IMPLEMENTATION — ABSOLUTE RULES:
- CSS color values: ONLY #000000 and #ffffff permitted — zero exceptions
- background-color: #ffffff on the outer card; all shapes/borders/type: #000000
- Reversed elements: color:#fff on elements with background-color:#000 — allowed and encouraged for hero elements
- FORBIDDEN: any hex color other than #000 / #fff, any rgba(), any opacity less than 1, any gradient of any kind, any box-shadow, any text-shadow, any filter
- border: use solid 2px+ black lines — no grey, no colored borders
- font-weight: 700 or 800 or 900 ONLY — no light or regular weights
- Maximum 6 text-rendering lines in the output
- The design must be CLEAN, BOLD, and LEGIBLE at actual stamp impression size

STAMP LAYOUT IMPLEMENTATION — SIMPLICITY OVERRIDES (supersede all generic complexity mandates above):
- Implement ONLY the 2–3 supporting elements from the spec — no "add more elements" pressure applies to stamps
- ALL text goes in ONE flex column (.zone-copy) centered in the card — no .zone-contact, no absolutely-positioned text
- FORBIDDEN: transform:rotate on anything, <svg> text or textPath, arced/curved text, letter-by-letter positioning, circles or ovals, radial/starburst shapes, icons overlapping text
- Decoration is ONLY straight-edged: card border, solid black bar (top/bottom/left), or horizontal rules — and it must never intersect a text line
- Result must read instantly: business name dominant, info lines small and clean below it`;
  }

  // ── Nameplate / Name Badge: person-identity content model (no contact info) ──
  if (isNameplate) {
    const nameNote = `
NAMEPLATE / NAME BADGE — READ THIS FIRST. IT OVERRIDES EVERY "business name is the hero" INSTRUCTION ANYWHERE ABOVE.
This is a PERSON'S desk/door plate, NOT a business card. The hierarchy is INVERTED from a business card:
- THE HERO IS THE PERSON'S NAME — it is the single LARGEST element on the plate (the monument). Size it at the big display/headline size from the layout budget.
- THE JOB TITLE is a quiet secondary line directly under or beside the name, clearly smaller (person name ≥ 2.2× the title).
- THE BUSINESS NAME IS ONLY A SMALL LOGO / WORDMARK — no larger than ~40% of the person-name size — tucked into a corner or flanking the name. It is NEVER the hero and NEVER the centered main event. Use the user's SVG logo if one is provided.
- FOREGROUND TEXT IS EXACTLY THREE THINGS: person name (hero) + job title + a small business wordmark/logo. NOTHING ELSE — NO tagline, NO industry descriptor line (e.g. "ATTORNEYS AT LAW"), NO phone, email, website, address, NO body copy.
- NAME SOURCE: use the person name and title from Special Instructions if given; otherwise invent ONE tasteful placeholder name + a fitting senior title. Do NOT reuse the business name as the person's name.
- The CONCEPT for this piece must be built around making the PERSON'S NAME unforgettable, with the business reduced to a quiet mark. Keep the BACKGROUND rich and designed (layered fields, gradient, motif, ornament, frame, pattern) so the plate reads as a premium object — but every decorative layer stays BEHIND/AROUND the text and never competes with the name.
WRONG (a business-card layout — REJECT it): the business wordmark large or centered as the hero with the person's name small at the bottom, or any tagline / industry line present. RIGHT: the person's NAME is the biggest text on the plate; the business is a small logo; the title is a quiet subordinate line; everything else is background ornament.`;
    dsSpecNote += nameNote + `
In the SPEC: CONCEPT and HERO MOMENT must both be the PERSON'S NAME (give it the largest px size); the business name appears only in SUPPORTING ELEMENTS as a small logo/wordmark. TEXT ZONES contain ONLY the person name + job title (one .zone-copy block) — do NOT specify a .zone-contact, contact lines, or a tagline.`;
    dsHtmlNote += nameNote + `
HTML STRUCTURE: one .content flex layer holding a single .zone-copy whose FIRST and LARGEST child is the person NAME, then the smaller JOB TITLE; the business logo/wordmark sits small in the background/accent layer or a corner. Do NOT output a .zone-contact, .contact-group, .icon-row, a tagline element, any phone/email/website/address, and do NOT invent contact details. If the business name's font-size is ever ≥ the person name's font-size, you have failed — make the person name larger.`;
  }

  if (creativityLevel === 'bold') {
    dsHtmlNote += `
PORTFOLIO BOLD — make the CONCEPT and HERO MOMENT unmistakable and the canvas richly designed:
- The hero dominates — ≥30% of canvas on cards, ≥40% on posters
- Layered background (2+ fields / gradient / texture / pattern), never a single flat fill
- Implement ALL the spec's supporting elements at full weight — cohesive richness (4–6 integrated elements) that reinforces the concept, never a sparse card
- Dramatic scale contrast and confident use of the CSS techniques the spec names
- Mixed typography where the aesthetic allows (2 contrasting families). Commission-worthy, not template-safe — and every glyph fits inside the canvas`;
  }

  try {
    // ── Pass 1: Creative director generates visual spec ──────────────────────
    send({ phase: 1 });

    const specContent = SPEC_PROMPT
      .replace('{{PRODUCT_TYPE}}',         templateType)
      .replace('{{DIMENSIONS}}',           dimensions)
      .replace('{{INDUSTRY}}',             industry            || 'Not specified')
      .replace('{{BUSINESS_NAME}}',        brandValue)
      .replace('{{COLORS}}',              colorsValue)
      .replace('{{STYLE_DIRECTION}}',      styleDirFinal)
      .replace('{{SPECIAL_INSTRUCTIONS}}', specialInstructions || 'None')
      .replace('{{IMAGE_URL}}',            imageUrlValue)
      .replace('{{SVG_CONTENT}}',          svgContentValue)
      .replace('{{LAYOUT_BUDGET}}',        layoutBudget)
      .replace('{{DS_SPEC_NOTE}}',         dsSpecNote);

    // In recreate mode, show the reference image to the model so it can match it.
    const specMessage = refImageForGen
      ? [{ type: 'image', source: { type: 'base64', media_type: refImageForGen.mediaType, data: refImageForGen.data } }, { type: 'text', text: specContent }]
      : specContent;

    const specResponse = await anthropic.messages.create({
      model: MODEL_SPEC,
      system: SYSTEM_DESIGNER,
      messages: [{ role: 'user', content: specMessage }],
      max_tokens: doubleSided ? 2800 : (isLargeFormat ? 2200 : 1800),
      ...tempParam(MODEL_SPEC, 1),
    });

    let designSpec = getTextContent(specResponse);

    const specValidation = validateDesignSpec(designSpec);
    if (!specValidation.ok) {
      designSpec += `\n\nSPEC CORRECTION — before implementation, fix: ${specValidation.issues.join('; ')}. Lead with a bold one-sentence CONCEPT specific to this business, and a HERO MOMENT covering ≥30% of the canvas that embodies it.`;
    }

    // ── Pass 2: Developer implements spec as streaming HTML ──────────────────
    send({ phase: 2 });

    const htmlContent = HTML_PROMPT
      .replace('{{DESIGN_SPEC}}',          designSpec)
      .replace('{{PRODUCT_TYPE}}',         templateType)
      .replace('{{DIMENSIONS}}',           dimensions)
      .replace('{{BUSINESS_NAME}}',        brandValue)
      .replace('{{INDUSTRY}}',             industry            || 'Not specified')
      .replace('{{COLORS}}',               colorsValue)
      .replace('{{STYLE_DIRECTION}}',      styleDirFinal)
      .replace('{{SPECIAL_INSTRUCTIONS}}', specialInstructions || 'None')
      .replace('{{IMAGE_URL}}',            imageUrlValue)
      .replace('{{SVG_CONTENT}}',          svgContentValue)
      .replace('{{LAYOUT_BUDGET}}',        layoutBudget)
      .replace('{{DS_HTML_NOTE}}',         dsHtmlNote);

    // In recreate mode, also show the reference image to the implementer model.
    const htmlMessage = refImageForGen
      ? [{ type: 'image', source: { type: 'base64', media_type: refImageForGen.mediaType, data: refImageForGen.data } }, { type: 'text', text: htmlContent }]
      : htmlContent;

    const stream = anthropic.messages.stream({
      model: MODEL_HTML,
      system: SYSTEM_DESIGNER,
      messages: [{ role: 'user', content: htmlMessage }],
      max_tokens: 16000,
      ...tempParam(MODEL_HTML, 0.95),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text || '';
        if (text) send({ t: text });
      }
    }

    send({ done: true });

  } catch (err) {
    console.error('Anthropic error:', err);
    const message =
      err?.error?.message ||
      err?.message ||
      'Anthropic API request failed. Check your API key and try again.';
    send({ error: message });
  }
}

async function handleGenerateJson(body) {
  const { html } = body;
  if (!html) throw new Error('HTML is required.');

  const jsonContent = JSON_SCHEMA_PROMPT.replace('{{HTML}}', html);

  try {
    const completion = await anthropic.messages.create({
      model: MODEL_JSON,
      messages: [{ role: 'user', content: jsonContent }],
      max_tokens: 6000,
    });

    const raw = getTextContent(completion);
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
    const jsonStr   = jsonMatch ? jsonMatch[1].trim() : null;

    if (!jsonStr) {
      throw new Error('Could not extract JSON from response. Please try again.');
    }

    return { json: jsonStr };
  } catch (err) {
    console.error('Anthropic error (generate-json):', err);
    const message = err?.error?.message || err?.message || 'Anthropic API request failed.';
    throw new Error(message);
  }
}

window.handleGenerate = handleGenerate;
window.handleGenerateJson = handleGenerateJson;
})();
