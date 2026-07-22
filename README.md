# Template Generator → Sterling Designer Integration Demo

A **static, browser-only proof of concept** showing the planned integration between the
AI Design Template Generator and Sterling's product designer:

**Generate → Push to Designer → editable Fabric.js objects → product recommendations →
duplicate & resize for other products.**

Live site: published via GitHub Pages from this repository (`.github/workflows/pages.yml`).

## What this is — and is not

- The "designer" here is a purpose-built **test harness** using the same canvas engine as
  Sterling's live designer (Fabric.js 4.4.0) and the same template data format (the
  "version 1.2" envelope produced by the designer's template APIs). It was written from
  scratch for this demo; **no production designer source code is included**.
- All products are **fictional demonstration records** (`DEMO-` numbers) in
  `data/test-products.json`. There is no cart, checkout, customer data, upload, proof
  generation, database, or any connection to Sterling servers.
- `demo-guard.js` is loaded first on every page: it **blocks any network request to
  Sterling production domains** (fetch/XHR/sendBeacon) and logs a console warning, and it
  keeps the test-demonstration banner visible on every page.
- The generator copy ships **without any API key**. The "Load sample design" demo buttons
  exercise the full workflow with no key; real AI generation requires visitors to supply
  their own Anthropic key via the app's API-key button.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | Landing page |
| `catalogue.html` | Demonstration product catalogue viewer |
| `generator/` | Test copy of the Design Template Generator + Push to Designer button |
| `designer/` | Fabric.js 4.4.0 test designer harness |
| `data/test-products.json` | Fake products (all `DEMO-` numbers) |
| `data/test-templates.json` | Fake sample designs for no-API-key testing |
| `demo-guard.js` | Production-domain request blocker + banner |
| `scripts/test-demo.mjs` | Automated end-to-end checks (playwright-core) |

## Running the automated tests

```bash
npm i --no-save playwright-core
node scripts/test-demo.mjs                       # serves the repo locally and tests it
node scripts/test-demo.mjs https://<pages-url>/  # tests the deployed site
```

## Relationship to the real integration

The conversion module (`generator/push-to-designer.js`) emits the same version 1.2 JSON the
real designer loads through its existing `?design=` flow, so this front end can later be
pointed at a Sterling-hosted staging designer without changes to the format. The staging
plan lives in the `templateGenerator` repository (`docs/INTEGRATION_PLAN.md`, branch
`claude/admiring-rubin-srryij`).

## `/realdesigner/` — static test copy of the real designer interface

Added after IT confirmed `oldDesigner` is the live designer. This folder contains the
**genuine designer front-end** (the same `SMPdesigner.js`, `fabricMods.js`, curved-text
plugin, and stylesheets that sterling.ca serves publicly to every visitor) with its
ColdFusion backend replaced by `mock-backend.js` + `fixtures.js` — embedded test data for
one product (6505, a 3.5″×2″ full-colour business card) captured from the public endpoints.
`transfer-loader.js` feeds pushed designs into the designer's own `parseTemplate()`.
Server-side ColdFusion source is NOT included; saving, carts, uploads, proofs, and QR are
disabled; all assets are vendored so no request leaves the page to any Sterling system.
Sterling's font pack is not bundled (licensing) — text renders with system-font fallbacks.
