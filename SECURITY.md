# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | yes       |

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
  escaped before it reaches the DOM (`esc()` in `src/app_core.js`, `escH()` in `src/report_gen.js`). Markdown in
  briefings is rendered with `marked` after `<script>` removal. Report anything that renders as HTML.
- **Content-Security-Policy.** `index.html` sets a CSP meta tag: scripts only from the page's own origin, no inline
  scripts, no `eval`, `object-src 'none'`, images only from the page, `data:`/`blob:` and the EOX Sentinel-2 tile host.
- **Links.** External links open with `rel="noopener"`.
- **Local storage.** Settings, workspace and the "intro seen" flag are kept in `localStorage` only.
- **Private data.** `data/private/` is git-ignored. Never commit NUFORC or other unlicensed rows.
