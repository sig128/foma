# FOMA

A memecoin trading network where every call comes with receipts. This repo holds the FOMA prototype app, its documentation site and the brand files.

> **Prototype.** Creators, wallets, ideas and fills are simulated. Real-token prices are a CoinGecko snapshot from 7 Nov 2026, 22:00 CET. No real funds move.

## What's here

| Path | What it is |
| --- | --- |
| `src/` | App source: styles, market data, rendering, execution engine, Claude helpers, boot |
| `docs/` | Docs source: `content.md` (every page), styles, runtime and the interactive explainers |
| `brand/` | The magnet mark, app icon and logo lockup |
| `dist/` | Built single-file pages for Claude artifacts: `foma.html` (app) and `docs.html` (docs) |
| `public/` | The built website: the app at `/`, the docs at `/docs`, icons and the social preview image |
| `logos.json` | Token and wallet logos as data URIs, bundled into the app |
| `tools/make_logos.py` | Rebuilds `logos.json` from source logos |

## Build

Python 3.9 or later, no dependencies:

```
python3 build.py        # app  -> dist/foma.html and dist/app.js
python3 build_docs.py   # docs -> dist/docs.html
python3 build_web.py    # website -> public/
```

The `dist/` pages are written for Claude artifacts. They have no `<html>` or `<head>` wrapper, load Geist from Google Fonts, and use the artifact runtime (`window.claude`) when it's present for Claude answers, synced settings and downloads. Without it, the app keeps its state in the browser and the docs search falls back to plain results.

## Website and deploys

`build_web.py` turns both pages into full HTML documents in `public/`, points the app and docs at each other (`/` and `/docs`), and adds the favicon, touch icon and social preview image from `brand/`. Vercel serves `public/` as is (see `vercel.json`), so every push to `main` goes live. Off Claude, the app's assistant answers from the record without AI and says so, share cards download directly, and the docs offer search without Claude answers.

## Writing docs

Every page lives in `docs/content.md`:

- `@page id | Title | Section | read time` starts a page; the next `> ` line is its lede
- `##` and `###` headings get anchors such as `#fees--what-you-pay`
- `:::note`, `:::safety`, `:::principle` or `:::proto` plus a title opens a callout, closed by `:::`
- `:::steps` holds a numbered walkthrough
- `@@widget-name` embeds an explainer from `docs/docs-widgets.js`; `@@cards:a,b` adds page cards
- `term :: definition` lines make the glossary; `??? Question` lines start FAQ entries

## Brand

| Token | Value |
| --- | --- |
| Magnet red (accent) | `#FF3B47` |
| Button red, with white text | `#E11D2C` |
| Silver (magnet tips) | `#DCE0E7` |
| Background | `#0B0A09` |
| Gain / loss | `#3CDDA0` / `#FF6B62` |
| Type | Geist, Geist Mono |

Token logos come from the Trust Wallet assets repository and wallet logos from web3icons; both are MIT licensed.
