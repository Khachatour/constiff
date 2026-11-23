# constiff

**Constitution diff**: a GitHub-style diff viewer that compares Armenia's **current Constitution** (official consolidated text, 2015 as amended 2020) with the **draft new Constitution** the government published for public discussion in November 2026 on [yourconstitution.am](https://yourconstitution.am/hy).

> ⚠️ The draft is **not** an adopted constitution. It is under public discussion, then goes to the Government, the National Assembly and a referendum. This is an independent, unofficial tool. The only official text is on yourconstitution.am.

## What it does

- A unified or split (side-by-side) diff of every article, with word-level highlights, like GitHub's PR "Files changed" view.
- A sidebar listing every article by draft chapter with **M**odified / **A**dded / **D**eleted status and +/− line counts. You can filter by text or article number and toggle each status.
- Unchanged runs fold away and expand on click. A "Viewed" checkbox (remembered in your browser) collapses an article once you've read it.
- Armenian UI by default, with an English toggle. The texts themselves are Armenian only, as published.
- Deep links: `#p-20` opens draft article 20, `#c-160` an old article removed in the draft, `#preamble` the preamble.

## How old and new articles are matched

The draft is a restructure, not an amendment: 220 articles in 16 chapters become 89 articles in 12 chapters. Old articles are matched to new ones automatically:

1. **TF-IDF cosine similarity** over crude word stems (first 6 letters). If an old article's best match scores ≥ 0.20, it goes there.
2. **Containment fallback.** Many short old articles were folded into one long new article. For example, about 25 separate rights articles became the list in draft Article 20. For those, if ≥ 55 % of the old article's (idf-weighted) vocabulary appears in a new article, it is attached there and marked `~`.
3. **Manual overrides** in [`data/mapping.json`](data/mapping.json) win over both and are marked `*`.

Anything left unmatched is shown as **removed**. The matching can be wrong, so corrections to `mapping.json` are welcome. The format is `{ "<draft article>": ["<current article>", ...] }`.

## Data

`data/constitution.json` is a snapshot built by [`scripts/fetch-data.mjs`](scripts/fetch-data.mjs) from the site's public JSON endpoints (`/api/content/hy/current`, `/api/content/hy/proposed`). The **Update constitution texts** workflow refreshes it daily and commits only when the texts change, so the git history doubles as a record of edits to the draft.

```sh
node scripts/fetch-data.mjs   # Node 18+, no dependencies
```

## Run locally

It is a static site with no build step. Serve the folder (opening `index.html` directly blocks `fetch` in most browsers):

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Make sure `data/constitution.json` exists. If not, run **Actions → Update constitution texts → Run workflow**.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions → Deploy to GitHub Pages → Run workflow.** The site appears at `https://<user>.github.io/constiff/`.
4. Optional: uncomment the `push` trigger in `.github/workflows/deploy-pages.yml` to redeploy on every change, including each daily data update.

## Files

| Path | What |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The viewer (vanilla JS) |
| `vendor/diff.min.js` | [jsdiff](https://github.com/kpdecker/jsdiff) 5.2.2, BSD-3-Clause (`vendor/diff.LICENSE`) |
| `data/constitution.json` | Text snapshot (generated) |
| `data/mapping.json` | Manual article matches |
| `scripts/fetch-data.mjs` | Snapshot builder |
| `.github/workflows/` | Daily data update, manual Pages deploy |

The constitutional texts are official documents of the Republic of Armenia, taken from yourconstitution.am.
