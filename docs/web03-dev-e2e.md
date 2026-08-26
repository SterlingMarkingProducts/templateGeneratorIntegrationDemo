# Running the Generator against the web03 dev endpoint

One URL on web03 takes a design from the real Generator, through the real
`templateImport.cfm`, into a new draft in `designCentral-dev`, and opens that
draft in the DEV Template Designer.

```
https://web03.sterling.ca/git/generator-web03-dev-e2e/generator/index.html
```

## Deploy

Add ONE repository entry on `https://web03.sterling.ca/git`, alongside the
existing `web03-dev-e2e` entry, then click **Pull Updates**:

| | |
|---|---|
| repository | `SterlingMarkingProducts/templateGeneratorIntegrationDemo` |
| branch | `claude/generator-web03-dev-e2e` |
| folder | `generator-web03-dev-e2e` |

The folder name matters — it is the switch. `web03-dev-bootstrap.js` activates
only when the page's own path contains `/generator-web03-dev-e2e/`, so the same
build served from anywhere else (GitHub Pages, a laptop, any other clone
folder) is byte-identical and behaves exactly as it always has.

Both clones must be present, because the Generator posts to the other one:

```
/git/generator-web03-dev-e2e/   this repository
/git/web03-dev-e2e/            oldDesigner, branch claude/web03-dev-e2e
```

## The walkthrough

1. Open the URL above — the real Generator, unchanged.
2. Click the **Axiom** demo button. It selects BCDP-CM (product 6505) and
   loads the demo design.
3. Click **Push to Designer**.
4. The browser POSTs the design same-origin to
   `/git/web03-dev-e2e/tests/web03-dev-e2e/templateImport.cfm` — the real
   endpoint, with its internal-IP gate, its security provider and its CSRF
   check all still in force.
5. On HTTP 201 the DEV Template Designer opens automatically at
   `templateDesignerDev.cfm?template=<the id the server returned>&product=6505`.

The draft is created with `live = 0` and no rows in `productTemplateMap`,
`siteFamilyTemplateMap` or `verticalTemplateMap`, so it is structurally
invisible to every gallery — those all inner-join a mapping table.

## What the browser cannot choose

`importBase`, `designerPage` and the dev CSRF token are constants in
`web03-dev-bootstrap.js`. Nothing is read from the URL, the query string or
any other client input, so a crafted link cannot point the page at production,
at another datasource or at another asset root. Those remain the server's
rules, and the dev clone's `Application.cfc` still enforces them.

The hand-off URL is built from the numeric `templateId` the endpoint returns —
never a hardcoded id, and never `response.openUrl`, which names the production
page.

## When the import fails

The Generator stays where it is. No window opens, and the toast shows the real
outcome — for example `Push to Designer failed (HTTP 403): missing or invalid
CSRF token`. It never falls back to the localStorage hand-off: a failed import
has to read as a failure.

## If web03 will not serve `../data/*.json`

`product-select.js` and `demo-samples.js` each fetch a file from the clone's
`data/` folder. On web03 those requests fail, and both features fail quietly as
a result: the picker falls into its own catch and reads "Product catalogue
unavailable", and the demo shortcuts — Axiom included — are never built at all,
because `demo-samples.js` builds them inside the fetch's `.then`.

The files are committed, plain and present in the clone, so this is the server
declining to serve them rather than a build problem. Instead of guessing at
web03's static-file configuration, the dev clone stops depending on it: the real
fetch is still tried first and still wins whenever it works, and only a failed
or non-JSON response falls back to `generator/web03-dev-data.js`, generated from
those same committed files by `scripts/build-web03-dev-data.mjs`.

When that happens the picker's own status line says so, and it will hold the one
CMS-verified record — BCDP-CM / 6505 — rather than the full list. The 800 KB
spreadsheet-inferred TEST inventory is deliberately not embedded; it is not
needed to select BCDP-CM. `window.SMPWeb03Dev.dataFallback` names each file that
fell back and the real reason.

Off the dev clone folder none of this runs and the fallback file is never even
downloaded.

## No API key

Nothing in this path calls Anthropic. The Axiom demo is a committed sample, so
the whole walkthrough runs with no key configured anywhere.
