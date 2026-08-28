# Icon Bank

825 individual vector icons for the Design Template Generator, so generated
templates can use real, production-quality icons instead of relying on the
model drawing its own SVGs.

Browse them in [`preview.html`](preview.html) (search + click to copy the
`<i data-icon="…">` token).

## Collections

| Collection | Icons | Style |
|---|---|---|
| `minimal` | 600 | Stroke-based line icons. Rows 1–12 of the source sheet follow [Feather](https://feathericons.com/) naming (`phone`, `mail`, `map-pin`, `globe`, …); the rest are a second rounded style named descriptively. |
| `business-medical` | 225 | Outline glyph icons (filled paths): business, finance, medical, travel, education themes (`handshake`, `stethoscope`, `growth-chart`, …). |

All icons use `currentColor` — they inherit the CSS `color` of their container,
so they can be tinted to any brand color. Each file is a standalone `<svg>` with
a tight `viewBox` and no fixed width/height (size via CSS).

## How the generator uses them

1. `engine.js` tells the model it may place icons with
   `<i data-icon="name"></i>` (or `<i data-icon="collection/name"></i>`).
2. `icons/icon-bank.js` (`window.IconBank`) replaces those tokens with the
   real inline `<svg>` right after generation (`IconBank.inline(html)`), so the
   final HTML stays fully self-contained for preview, download, and
   push-to-designer.
3. Unknown names collapse to an empty `<span>` and log a console warning —
   they never break a layout.

## Provenance & extraction

Extracted from three licensed vendor EPS icon sheets (uploaded stock assets):

| Source sheet | Extracted as |
|---|---|
| `collectionminimallineicons` (24×25 grid, 600 icons) | `minimal/` |
| `vectoruiillustrationmixedtravelmedicalfinanceconcept` (15×15, 225 icons) | `business-medical/` |
| `vectoruiillustrationmixedtravelbusinessfinanceconcept` (10×10, 100 icons) | not included — verified to be a duplicate subset of `business-medical` |

Pipeline: EPS → PDF (ghostscript) → flattened vectors → spatial clustering into
grid cells → one standalone SVG per icon (near-black paint mapped to
`currentColor`). Every extracted icon was verified against a render of the
original sheet.

## License / attribution

The two `business-medical` source sheets are Freepik assets
(“Designed by rawpixel.com / Freepik”). Under the Freepik **free** license,
attribution is required in the final work
(`Designed by rawpixel.com / Freepik`); under a **premium** subscription no
attribution is needed. Confirm which license Sterling holds before shipping
these icons in customer-facing output. The `minimal` sheet carried no license
file in its zip; its first 288 glyphs match the MIT-licensed
[Feather](https://github.com/feathericons/feather) set.
