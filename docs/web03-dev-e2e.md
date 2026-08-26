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

## No API key

Nothing in this path calls Anthropic. The Axiom demo is a committed sample, so
the whole walkthrough runs with no key configured anywhere.
