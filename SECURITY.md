# Security policy

## Supported versions

Only the latest minor release line gets fixes; older tags stay downloadable but are not patched.

| Version | Supported |
| ------- | --------- |
| 1.5.x   | yes       |
| < 1.5   | no        |

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Email **0_0@0thernes.art** with:

- what you found and where (file, URL parameter, data file);
- steps to reproduce, or a proof of concept;
- the impact you expect.

You will get an acknowledgement within 5 working days and a fix or a plan within 30 days. Credit is given in the
release notes unless you ask otherwise.

## Scope and design notes

Global Map is a static site: no server, no accounts, no cookies, no analytics. Things that matter here:

- **Untrusted text in data.** Case names, summaries and source titles come from third-party datasets. All of it is
  escaped before it reaches the DOM (`esc()` in `src/app_core.js`, `escH()` in `src/report_gen.js`), and links from
  data become anchors only for `http:`, `https:` and `mailto:` URLs (`link()`). Markdown (briefings) is rendered with
  `marked` and then passed through an allow-list sanitiser (`src/ui/sanitize.js`): active elements (`script`, `iframe`,
  `svg`, `math`, `form`, `template`, ...), event-handler, `style` and `srcset` attributes and any URL that is not
  `http(s)`, `mailto`, an anchor or a bundled relative file are removed. It is unit-tested against common XSS vectors
  (`test/unit/hardening.test.mjs`). Report anything that renders as HTML.
- **Content-Security-Policy.** `index.html` sets a CSP meta tag: `default-src 'self'`; scripts only from the page's own
  origin (no inline script, no `eval`; `'wasm-unsafe-eval'` only so Cesium's WebAssembly decoders can compile);
  `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`; images and `connect-src` limited to the keyless tile,
  terrain and live-feed hosts listed in [docs/data-sources.md](docs/data-sources.md). `style-src` allows inline styles
  because CesiumJS sets element styles at run time. The hardening audit checks that every host the code fetches is in
  the policy and that no unused host is (pass C01 in `docs/audit/hardening/PASSES.md`).
- **Exports.** CSV exports quote per RFC 4180 and prefix cells that a spreadsheet would run as a formula (`=`, `+`,
  `-`, `@`, tab, CR) with an apostrophe (`csvCell()` in `src/text.js`); numbers and ISO dates are left as they are.
- **Workspace files.** An imported workspace JSON is validated and clamped (`src/ui/workspace.js`) before it changes
  any state; a malformed file is rejected with a message.
- **Links.** External links open with `rel="noopener noreferrer"`.
- **Local storage.** Settings, workspace and the "intro seen" flag are kept in `localStorage` only; every access is
  wrapped so a browser with storage disabled still works.
- **Test hooks.** `window.__case`, `__open`, `__pick`, `__fly`, `__globe` and `window.GMAPP` exist for the Playwright
  tests. The site has no accounts, secrets or server, so they expose nothing that is not already in the page.
- **Private data.** `data/private/` is git-ignored. Never commit NUFORC or other unlicensed rows.
