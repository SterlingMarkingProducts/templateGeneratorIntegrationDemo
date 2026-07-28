# Designer patch for the Design Template Generator integration

**File touched:** `hteng/js/SMPdesigner.js` (one file)
**Size:** +64 lines, **0 deletions** (purely additive)
**Patch:** [`SMPdesigner.integration.patch`](./SMPdesigner.integration.patch) — a standard `git`/`patch` unified diff
**Applies against:** the current production `SMPdesigner.js` (baseline captured from the live `oldDesigner`)

This supersedes the earlier Tier‑1‑only notes ([`TIER1_NATIVE_SHAPES.md`](./TIER1_NATIVE_SHAPES.md), [`DESIGNER_TIER1.patch`](./DESIGNER_TIER1.patch)) — it now covers **Tier 1 + Tier 2** together.

---

## Why

The Design Template Generator pushes a finished design into the designer as a standard **version 1.2 template** (`canvasProperties` + `pages[].canvasData.objects`). The objects it sends are ordinary Fabric objects tagged with `sterlingType` (`"textObject"`, `"shape"`, `"backgroundArt"`, `"vectorArt"`).

Out of the box, `parseObjectsFromCanvas()` only files a subset of object types into the editable collections (`textObjects`, `imageObjects`, `shapeObjects`, …). Several types the generator emits — polygons, paths, ellipses, triangles, lines, and SVG vector artwork — **fell through untracked**, so the customer couldn't select/recolour them and they weren't guaranteed in output. This patch teaches the designer to file those as first‑class editable objects, so a pushed design arrives as an **editable, print‑ready** template rather than a partly‑flattened one.

## What the patch does (two additions)

### Tier 1 — native editable shapes
`parseObjectsFromCanvas()` now files these as first‑class **`shapeObjects`** (the collection the shape tools already operate on):
- imported **solid circles** (previously created but not tracked), and
- **`polygon` / `path` / `ellipse` / `triangle` / `line`**, plus anything explicitly tagged `sterlingType: "shape"`.

`nonPrintedObject`‑tagged instances are still removed exactly as before. `objectCaching` is disabled on these so recolour/transform repaints correctly — matching how the designer already treats its own shapes.

### Tier 2 — native SVG vector import (`importVectorArt`)
When a pushed object is an image tagged `sterlingType: "vectorArt"` carrying an **SVG data URI**, the new `importVectorArt()` helper decodes the SVG and converts it — via the designer's existing Fabric APIs (`fabric.loadSVGFromString` + `fabric.util.groupSVGElements`) — into an **editable vector group**, positioned/scaled/rotated to match the placeholder, registered in `shapeObjects`, replacing the flat image. Logos/icons therefore transfer as **real editable vector paths** (crisp at any size, recolourable, movable) rather than a rasterised picture.

It is **fail‑safe**: if the SVG can't be decoded or produces no objects, the original placeholder image is left in place (the design still renders). The swap is asynchronous — the placeholder image paints immediately, then is replaced when parsing finishes.

## Risk assessment

- **Additive only** — 0 lines removed. No existing branch, signature, or behaviour is changed; new logic runs only in `else`/guarded branches that previously did nothing for these types.
- **Gated on generator content** — Tier 2 runs *only* for `sterlingType === "vectorArt"` images (a tag only the generator emits). Normal designer usage, saved designs, and the shape library are untouched.
- **Uses APIs already in this build** — `fabric.loadSVGFromString`, `fabric.util.groupSVGElements` (Fabric 4.4.0, already loaded and already used elsewhere in `SMPdesigner.js`, e.g. the SVG‑image loader near `groupSVGElementsAsGroup`).
- **Graceful fallback** — any decode/parse failure returns without throwing and keeps the placeholder image.
- **No network, storage, auth, pricing, or cart code touched.**

## Testing performed (in a static copy of the designer)

- Pushed designs load natively via `parseTemplate` → `loadFromJSON` → `parseObjectsFromCanvas`; text arrives as editable `i-text`, solids as native shapes, all registered in the correct collections.
- A design with a multi‑path inline SVG logo transfers as an **editable vector group** at the correct position (automated assertion: object becomes a `group`, the flat SVG image is gone, it's a selectable registered shape — plus a visual check).
- Single‑ and double‑sided (front/back) transfers, and multiple product sizes (business card 3.5×2″, sign 12×16″), boot with **no console errors** and correct page counts.
- Existing (non‑generator) template loads are unaffected.

## How to apply

```bash
# from the designer repo root, against the file's directory layout
git apply docs/SMPdesigner.integration.patch      # or:  patch -p1 < docs/SMPdesigner.integration.patch
```
The diff header path is `realdesigner/hteng/js/SMPdesigner.js`; adjust `-p` / the path prefix to match the production tree (the edited function is `parseObjectsFromCanvas`, with the new `importVectorArt` inserted just above it).

## Rollback

Revert the single file (`git checkout -- <path>/SMPdesigner.js`) or `git apply -R docs/SMPdesigner.integration.patch`. Because the change is additive and gated, reverting fully restores prior behaviour with no data migration.

## Not included (by design)

- The generator side (push conversion, rasterisation of gradients/shadows, bleed handling) lives entirely in the Design Template Generator and needs **no** designer change.
- Large full‑card decorative SVGs are intentionally still rasterised on the generator side (only logo/icon‑sized SVG is sent as `vectorArt`); extending vector transfer to large decorative artwork is a possible follow‑up, gated the same way.
