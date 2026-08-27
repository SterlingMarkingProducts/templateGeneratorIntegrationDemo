/* ═══════════════════════════════════════════════════════════════════════════
   DEV-ONLY ANTHROPIC API KEY — web03 dev clone only.  ***PASTE YOUR KEY BELOW***

   ───────────────────────────────────────────────────────────────────────────
   READ THIS FIRST

   A key pasted here is COMMITTED TO GITHUB and is readable by anyone with
   access to this repository, and by GitHub's own secret scanning. It is also
   downloaded by the browser on the dev clone, so anyone who can open that page
   can read it.

   That is a deliberate, accepted trade for this isolated dev environment: it
   removes the need to configure the Lucee service on web03. Treat the key as
   DISPOSABLE — use one you are willing to expose, and revoke it when this dev
   work is finished.

   The secure path still wins automatically: aiProxy.cfm uses the server-side
   ANTHROPIC_API_KEY whenever one is configured, and only falls back to this.

   This file must never be merged to main.
   ───────────────────────────────────────────────────────────────────────────

   It is fetched ONLY by web03-dev-bootstrap.js, and only when the Generator is
   being served from the /generator-web03-dev-e2e/ clone folder. No other
   deployment downloads it.                                                    */

window.SMPWeb03DevApiKey = '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';   /* ← paste the key between the quotes, e.g. 'sk-ant-api03-…' */
