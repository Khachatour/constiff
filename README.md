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

The draft is a restructure, not an amendment: 220 articles in 16 chapters become 89 articles in 12 chapters, and many paragraphs were merged, split or moved between articles. The rule the viewer follows: **a red line sits beside a green line only when both are the same provision**; everything else is shown whole, as removed (red) or added (green).

**Same provision.** Two lines count as the same provision only when they share real wording in the same order: the longest common sequence of word stems, each weighted by how rare it is across both texts. Stock phrases that recur in six or more lines ("may be restricted only by law for the purposes of state security, public order…") count at 40%, so sharing one is not enough. A line passes if the shared wording is substantial and covers a fair share of both lines, nearly all of the shorter line, or nearly the whole of both. Comparisons also run sentence by sentence, so a paragraph that became half of a new one is found. The thresholds were calibrated on hand-labelled pairs from the two texts. On a fresh random sample of 24 linked pairs read afterwards, all 24 were correct. When in doubt the viewer leaves lines unpaired: a missed pair shows as a removal plus an addition, which is never false.

**Merges and splits.** Old paragraphs merged into one new paragraph, or one old paragraph split into several, are shown as one change: all the old lines, then all the new lines, joined by a blue bar, with word-level highlights across the group. An extra source joins a group only if it explains wording the stronger source doesn't, so parallel provisions (the same "powers end when…" rule for deputies, judges and the Ombudsman) don't get mixed up.

**Which article.** Each old paragraph is shown in every draft article (at most two) where its wording went. An old article's main match is the draft article holding most of its paragraphs (its title found as a list item counts too), with whole-article TF-IDF similarity as a tie-breaker and as the only signal for an article rewritten beyond recognition (marked `~`). A paragraph whose wording appears nowhere in the draft is shown as removed, once, in its own article's main match. Articles split across several draft articles are marked "(part)".

**Manual overrides** in [`data/mapping.json`](data/mapping.json) win over all of this and are marked `*`. The format is `{ "<draft article>": ["<current article>", ...], "_removed": ["<current article>", ...] }`; `_removed` forces an old article to show as removed.

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

Live at **https://khachatour.github.io/constiff/**.

The **Deploy to GitHub Pages** workflow runs on every push to `main` and after each daily data update. To set it up in a fork: **Settings → Pages → Source: GitHub Actions**, then run the workflow once (`data/constitution.json` must exist).

## Files

| Path | What |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The viewer (vanilla JS) |
| `vendor/diff.min.js` | [jsdiff](https://github.com/kpdecker/jsdiff) 5.2.2, BSD-3-Clause (`vendor/diff.LICENSE`) |
| `data/constitution.json` | Text snapshot (generated) |
| `data/mapping.json` | Manual article matches |
| `scripts/fetch-data.mjs` | Snapshot builder |
| `.github/workflows/` | Daily data update, manual Pages deploy |

## License

The code is released under the [MIT License](LICENSE). This does **not** cover:

- the constitutional texts in `data/constitution.json`, which are official documents of the Republic of Armenia taken from yourconstitution.am;
- `vendor/diff.min.js` ([jsdiff](https://github.com/kpdecker/jsdiff)), which keeps its own BSD-3-Clause license (`vendor/diff.LICENSE`).
