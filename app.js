/* Constitution diff viewer — current Constitution of Armenia vs. the 2026 draft.
 * Data: data/constitution.json (built by scripts/fetch-data.mjs).
 * Optional manual overrides: data/mapping.json  { "<proposed article>": ["<current article>", ...] }
 * Uses jsdiff (vendor/diff.min.js) for array diffs.
 */
(() => {
  'use strict';

  // ---------- tiny helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem('cdiff:' + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('cdiff:' + k, v); } catch { /* storage unavailable */ } },
  };

  // Share of added vs removed lines, as a thin two-color bar (numbers sit beside it).
  const ratio = (s) => { const t = s.add + s.del || 1; return `<span class="ratio" aria-hidden="true"><i class="a" style="width:${(100 * s.add / t).toFixed(1)}%"></i><i class="d"></i></span>`; };

  const I18N = {
    hy: {
      title: 'Սահմանադրություն․ գործող → նախագիծ',
      unified: 'Միասնական', split: 'Կողք կողքի', collapseAll: 'Ծալել բոլորը', expandAll: 'Բացել բոլորը',
      filterPh: 'Զտել ըստ համարի կամ տեքստի…', loading: 'Բեռնվում է…',
      M: 'Փոփոխված', A: 'Նոր', D: 'Հանված', U: 'Անփոփոխ',
      article: 'Հոդված', preamble: 'Նախաբան', chapter: 'Գլուխ', fromArt: 'գործող՝ հոդվ.', current: 'գործող',
      viewed: 'Դիտված', unchangedLines: (n) => `${n} անփոփոխ տող`, noChanges: 'Տեքստը չի փոխվել։',
      none: 'Ոչ մի հոդված չի համապատասխանում զտիչին։', clearFilter: 'Մաքրել զտիչը',
      skip: 'Անցնել հոդվածներին', contents: 'Բովանդակություն', draftTag: 'Նախագիծ',
      filterLabel: 'Զտել հոդվածները', treeLabel: 'Հոդվածներ', viewGroup: 'Դիտման ձև',
      toggleArticle: 'Ծալել կամ բացել հոդվածը', showFold: 'Ցույց տալ',
      themeLight: 'Լուսավոր թեմա', themeDark: 'Մուգ թեմա', langName: 'English',
      legend: '~ = համապատասխանեցված է ընդհանուր նմանությամբ, ոչ մի պարբերության ձևակերպումը չի պահպանվել, * = ձեռքով համապատասխանեցում, (մաս) = այստեղ է անցել հոդվածի միայն մի մասը',
      partMark: '(մաս)',
      nearArt: () => 'մոտ թեմա՝ նախագծի հոդվ.',
      nearHint: 'Այս հոդվածի ձևակերպումը նախագծում չի գտնվել։ Նշված է թեմայով ամենամոտ հոդվածը՝ որպես ուղեցույց, ոչ թե որպես դրա փոխարինող։',
      summary: (s) => `<div class="sum-arts"><span class="sum-n">${s.cur}</span><span class="sum-l">հոդված<br>գործող</span>` +
        `<span class="sum-to" aria-hidden="true">→</span><span class="sum-n">${s.prop}</span><span class="sum-l">հոդված<br>նախագիծ</span></div>` +
        `<div class="sum-lines"><span class="plus">+${s.add}</span> <span class="minus">−${s.del}</span> <span class="sum-unit">տող</span>${ratio(s)}</div>`,
      source: (d) => `Աղբյուր՝ <a href="${esc(d.source)}" target="_blank" rel="noopener">yourconstitution.am</a> · ներբեռնված ${esc(fmtDate(d.fetchedAt))}`,
      notice: 'Սա <b>նախագիծ</b> է, ոչ թե ընդունված Սահմանադրություն։ Նախագիծն ունի նոր կառուցվածք (220 → 89 հոդված), ուստի գործող և նոր հոդվածների համապատասխանեցումը կատարված է <b>ավտոմատ</b>՝ ըստ տեքստային նմանության, և կարող է սխալներ ունենալ։ Պաշտոնական տեքստը՝ <a href="https://yourconstitution.am/hy" target="_blank" rel="noopener">yourconstitution.am</a>։',
      footer: 'Անկախ, ոչ պաշտոնական գործիք։ Տեքստերը վերցված են yourconstitution.am-ից։ Կարմիրը գործող տեքստն է, կանաչը՝ նախագծինը։ Կարմիր և կանաչ տողերը կողք կողքի են միայն այն դեպքում, երբ դրանք նույն դրույթն են (ընդհանուր ձևակերպմամբ). կապույտ գծով միացված տողերը միավորված կամ բաժանված պարբերություններ են։ Հոդվածի համարի կողքին «~»՝ համապատասխանեցված է միայն ընդհանուր նմանությամբ, «*»՝ ձեռքով համապատասխանեցում, «(մաս)»՝ այստեղ է անցել հոդվածի միայն մի մասը։ Համապատասխանեցումը կարելի է ուղղել <code>data/mapping.json</code> ֆայլով։ Diff-ը՝ <a href="https://github.com/kpdecker/jsdiff" target="_blank" rel="noopener">jsdiff</a>։',
      loadError: 'Չհաջողվեց բեռնել data/constitution.json։ Գործարկեք <code>node scripts/fetch-data.mjs</code>։',
    },
    en: {
      title: 'Constitution: current → draft',
      unified: 'Unified', split: 'Split', collapseAll: 'Collapse all', expandAll: 'Expand all',
      filterPh: 'Filter by number or text…', loading: 'Loading…',
      M: 'Modified', A: 'Added', D: 'Removed', U: 'Unchanged',
      article: 'Article', preamble: 'Preamble', chapter: 'Chapter', fromArt: 'current art.', current: 'current',
      viewed: 'Viewed', unchangedLines: (n) => `${n} unchanged ${new Intl.PluralRules('en').select(n) === 'one' ? 'line' : 'lines'}`, noChanges: 'Text unchanged.',
      none: 'No articles match the filter.', clearFilter: 'Clear filter',
      skip: 'Skip to articles', contents: 'Contents', draftTag: 'Draft',
      filterLabel: 'Filter articles', treeLabel: 'Articles', viewGroup: 'View',
      toggleArticle: 'Collapse or expand article', showFold: 'Show',
      themeLight: 'Light theme', themeDark: 'Dark theme', langName: 'Հայերեն',
      legend: '~ = matched by overall similarity only; none of its paragraphs’ wording carried over, * = matched by hand, (part) = only some of its paragraphs moved here',
      partMark: '(part)',
      nearArt: () => 'similar topic: draft art.',
      nearHint: 'This article’s wording was not found in the draft. The draft article closest in topic is named as a pointer, not as its replacement.',
      summary: (s) => `<div class="sum-arts"><span class="sum-n">${s.cur}</span><span class="sum-l">articles<br>current</span>` +
        `<span class="sum-to" aria-hidden="true">→</span><span class="sum-n">${s.prop}</span><span class="sum-l">articles<br>draft</span></div>` +
        `<div class="sum-lines"><span class="plus">+${s.add}</span> <span class="minus">−${s.del}</span> <span class="sum-unit">lines</span>${ratio(s)}</div>`,
      source: (d) => `Source: <a href="${esc(d.source)}" target="_blank" rel="noopener">yourconstitution.am</a> · fetched ${esc(fmtDate(d.fetchedAt))}`,
      notice: 'This is a <b>draft</b>, not an adopted constitution. The draft is restructured (220 → 89 articles), so current articles are matched to new ones <b>automatically</b> by text similarity and the pairing can be wrong. Texts are in Armenian. Official text: <a href="https://yourconstitution.am/hy" target="_blank" rel="noopener">yourconstitution.am</a>.',
      footer: 'Independent, unofficial tool. Texts come from yourconstitution.am. Red is the current text, green the draft. A red line sits beside a green one only when both are the same provision (they share its wording); lines joined by a blue bar are paragraphs that were merged or split. In “current art.” lists, “~” means matched by overall similarity only, “*” means a hand-made match, and “(part)” means only some of the old article’s paragraphs moved there. Matching can be corrected in <code>data/mapping.json</code>. Diffing by <a href="https://github.com/kpdecker/jsdiff" target="_blank" rel="noopener">jsdiff</a>.',
      loadError: 'Could not load data/constitution.json. Run <code>node scripts/fetch-data.mjs</code>.',
    },
  };
  let lang = store.get('lang') === 'en' ? 'en' : 'hy';
  let view = store.get('view') === 'split' ? 'split' : 'unified';
  const T = (k, ...a) => { const v = I18N[lang][k]; return typeof v === 'function' ? v(...a) : v; };
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return iso; }
  }

  // ---------- text processing ----------
  const WORD = /[Ա-Ֆա-ևA-Za-zЀ-ӿ]+/g; // Armenian letters only; ՝ ՛ ՜ ՞ etc. are punctuation
  // A Latin letter typed inside an Armenian word (the draft has "hանրային" with a
  // Latin h) is read as its Armenian look-alike, so the word still matches.
  const LOOKALIKE = { h: 'հ', o: 'օ', u: 'ս', n: 'ո', q: 'գ' };
  const fixMixed = (w) => (/[ա-և]/.test(w) && /[a-z]/.test(w) ? w.replace(/[a-z]/g, (c) => LOOKALIKE[c] || c) : w);
  const stemsOf = (s) => (s.toLowerCase().match(WORD) || []).map(fixMixed).filter((w) => w.length >= 3).map((w) => w.slice(0, 6));
  const tokenize = (s) => s.split(/(\s+|[^\sԱ-Ֆա-ևA-Za-z0-9Ѐ-ӿ]+)/).filter(Boolean);
  const normLine = (l) => l.replace(/^\s*(\d+[.)]|[ա-ֆ][․.)])\s*/, '').replace(/\s+/g, ' ').trim();
  const numCmp = (a, b) => (parseFloat(a) - parseFloat(b)) || String(a).localeCompare(String(b));

  // Dice overlap of two stem sets: 1 = same words, 0 = nothing shared.
  function dice(A, B) {
    if (!A.size || !B.size) return 0;
    if (A.size > B.size) [A, B] = [B, A];
    let n = 0; for (const x of A) if (B.has(x)) n++;
    return (2 * n) / (A.size + B.size);
  }

  // ---------- "same provision" test for two lines ----------
  // Two lines are shown as one changed line only when they share real wording in
  // the same order: the longest common sequence of word stems, each stem weighted
  // by its rarity across both texts (so boilerplate like "Republic", "by law",
  // "right" counts little). Topic overlap alone is not enough; when in doubt the
  // lines stay unpaired and show as a plain removal and a plain addition.
  // Thresholds were calibrated on hand-labelled pairs from the two texts.
  const SAME = {
    run: 25, runLong: 0.3,      // a substantial shared run covering a fair share of the longer line
    mergeShort: 0.55, mergeLong: 0.2, // or of the shorter line, when it was merged into a longer one
    cover: 0.84, coverRun: 20,  // or nearly all of the shorter line, with some substance
    nearShort: 0.9, nearLong: 0.75, // or nearly the whole of both (short lines)
    prefilter: 0.2,             // stem overlap below this can't pass; skips the costly check
  };
  // Stock phrases ("may be restricted only by law for the purposes of state
  // security, public order...") recur across many provisions, so sharing one is
  // no evidence that two lines are the same provision. A word inside a
  // three-word phrase found in STOCK_LINES or more lines of the two texts counts
  // at STOCK_WEIGHT. A provision carried over from old to new appears only twice.
  const STOCK_LINES = 6, STOCK_WEIGHT = 0.4;
  let IDF = () => 1;
  let STOCK = new Set();
  const trigrams = (seq) => { const t = []; for (let k = 0; k + 2 < seq.length; k++) t.push(seq[k] + ' ' + seq[k + 1] + ' ' + seq[k + 2]); return t; };
  function buildIdf(data) {
    const df = new Map(), tf = new Map();
    let n = 0;
    for (const side of [data.current, data.proposed]) {
      for (const a of side.articles) for (const l of a.x.split('\n')) {
        if (!l.trim()) continue;
        n++;
        const seq = stemsOf(l);
        for (const s of new Set(seq)) df.set(s, (df.get(s) || 0) + 1);
        for (const t of new Set(trigrams(seq))) tf.set(t, (tf.get(t) || 0) + 1);
      }
    }
    IDF = (s) => Math.log(1 + n / (df.get(s) || 1));
    STOCK = new Set([...tf].filter(([, c]) => c >= STOCK_LINES).map(([t]) => t));
  }
  // A line prepared for comparison: stems in order, their set, and total weight.
  const lineCache = new Map();
  function prep(text) {
    let p = lineCache.get(text);
    if (!p) {
      const seq = stemsOf(text);
      const wts = seq.map((x) => IDF(x));
      trigrams(seq).forEach((t, k) => { if (STOCK.has(t)) for (let d = 0; d < 3; d++) wts[k + d] = IDF(seq[k + d]) * STOCK_WEIGHT; });
      p = { seq, wts, set: new Set(seq), w: wts.reduce((s, x) => s + x, 0), norm: normLine(text) };
      lineCache.set(text, p);
    }
    return p;
  }
  // Longest common subsequence of stems, each match weighted (mean of both sides' weights).
  function weightedLcs(A, B) {
    const a = A.seq, b = B.seq;
    let prev = new Float64Array(b.length + 1), row = new Float64Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + (A.wts[i - 1] + B.wts[j - 1]) / 2 : Math.max(prev[j], row[j - 1]);
      }
      [prev, row] = [row, prev];
    }
    return prev[b.length];
  }
  // Returns the weight of wording a and b share when they are the same provision, else 0.
  function sameProvision(a, b) {
    const A = prep(a), B = prep(b);
    if (A.norm === B.norm) return A.w || 1;
    if (!A.w || !B.w || dice(A.set, B.set) < SAME.prefilter) return 0;
    const run = weightedLcs(A, B);
    const short = run / Math.min(A.w, B.w), long = run / Math.max(A.w, B.w);
    const ok = (run >= SAME.run && long >= SAME.runLong) ||
      (run >= SAME.run && short >= SAME.mergeShort && long >= SAME.mergeLong) ||
      (short >= SAME.cover && run >= SAME.coverRun) ||
      (short >= SAME.nearShort && long >= SAME.nearLong);
    return ok ? run : 0;
  }

  // Sentences of a line that carry enough wording to be matched on their own.
  // The texts end sentences with ":" or "։" (and list items with ";").
  const SENT_MIN = 15;
  const sentCache = new Map();
  function sentences(text) {
    let s = sentCache.get(text);
    if (!s) {
      const parts = text.split(/(?<=[:։;])\s+/).map((x) => x.trim()).filter(Boolean);
      s = parts.length > 1 ? parts.filter((x) => prep(x).w >= SENT_MIN) : [];
      sentCache.set(text, s);
    }
    return s;
  }
  // Overlap of two prepared texts, each stem weighted by rarity: 1 = same words.
  function weightedDice(A, B) {
    let shared = 0; for (const x of A.set) if (B.set.has(x)) shared += IDF(x);
    const wa = [...A.set].reduce((s, x) => s + IDF(x), 0), wb = [...B.set].reduce((s, x) => s + IDF(x), 0);
    return wa + wb ? (2 * shared) / (wa + wb) : 0;
  }
  // Total weight of the stems two lines share (an upper bound on any shared run).
  function sharedWeight(A, B) {
    if (A.set.size > B.set.size) [A, B] = [B, A];
    let w = 0; for (const x of A.set) if (B.set.has(x)) w += IDF(x);
    return w;
  }
  // Are lines a and b (in whole or in part) the same provision? A line can be one
  // sentence of a longer line on the other side: old paragraphs merged into one
  // new paragraph, or one old paragraph split into several. Returns the weight of
  // the wording they share (0 = unrelated).
  const relCache = new Map();
  function relate(a, b) {
    const key = a + '\u0001' + b;
    let r = relCache.get(key);
    if (r === undefined) { r = relateUncached(a, b); relCache.set(key, r); }
    return r;
  }
  function relateUncached(a, b) {
    const A = prep(a), B = prep(b);
    if (A.norm === B.norm) return A.w || 1;
    if (sharedWeight(A, B) < Math.min(SAME.coverRun, 0.75 * Math.min(A.w, B.w))) return 0;
    let s = sameProvision(a, b);
    for (const x of sentences(a)) s = Math.max(s, sameProvision(x, b));
    for (const y of sentences(b)) s = Math.max(s, sameProvision(a, y));
    return s;
  }

  // Which stem positions of a and of b the weighted LCS matches (for telling
  // whether a second source line explains wording the first one doesn't).
  function lcsMatches(a, b) {
    const A = prep(a), B = prep(b), m = A.seq.length, n = B.seq.length;
    const dp = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      dp[i][j] = A.seq[i - 1] === B.seq[j - 1] ? dp[i - 1][j - 1] + (A.wts[i - 1] + B.wts[j - 1]) / 2 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
    const ia = new Set(), ib = new Set();
    for (let i = m, j = n; i > 0 && j > 0;) {
      if (A.seq[i - 1] === B.seq[j - 1]) { ia.add(i - 1); ib.add(j - 1); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    return { a: ia, b: ib };
  }

  // TF-IDF cosine similarity between whole articles.
  function vectorize(docs) {
    const df = new Map();
    const tfs = docs.map((d) => {
      const tf = new Map();
      for (const s of d) tf.set(s, (tf.get(s) || 0) + 1);
      for (const s of tf.keys()) df.set(s, (df.get(s) || 0) + 1);
      return tf;
    });
    const N = docs.length;
    return tfs.map((tf) => {
      const v = new Map(); let norm = 0;
      for (const [s, c] of tf) { const w = (1 + Math.log(c)) * Math.log(1 + N / df.get(s)); v.set(s, w); norm += w * w; }
      norm = Math.sqrt(norm) || 1;
      for (const [s, w] of v) v.set(s, w / norm);
      return v;
    });
  }
  function cosine(a, b) {
    if (a.size > b.size) [a, b] = [b, a];
    let s = 0; for (const [k, w] of a) { const x = b.get(k); if (x) s += w * x; }
    return s;
  }

  const MATCH_THRESHOLD = 0.2;     // TF-IDF cosine needed for a direct match
  const CONTAIN_THRESHOLD = 0.55;  // fallback: share of an old article's vocabulary found in a new one

  const TFIDF_WEIGHT = 2;   // whole-article similarity, counted like about two found paragraphs
  const MAX_HOMES = 2;      // a split paragraph is shown in at most this many draft articles
  const TITLE_SAME = 0.6;   // an old title this close (stem overlap) to a draft title is evidence
  const TITLE_IN_LINE = 0.75; // ...or this share of its weighted words inside one draft line
  const TITLE_COMMON = 12;  // a title word found in more titles than this is generic
  const TITLE_MIN = 4;      // titles lighter than this (a word or two of common words) are not evidence
  const SECOND_HOME = 0.6;  // ...and in the second only if it shares this share of the wording it shares with the first
  const WEAK_LINK = 0.5;    // in a diff, a line keeps only links at least this strong relative to its strongest
  const EXPLAIN_MIN = 10;   // wording (weighted) a further source must explain that stronger sources don't

  const bodyLines = (a) => a.x.split('\n').filter((l) => l.trim());

  // Matches every current article to the draft. Returns Map: current index ->
  // routes [{ p, sim, manual?, merged?, lines? }], the main match first. A route
  // with `lines` (indices into the article's body lines) carries only those
  // paragraphs: an old article split across several new ones.
  let alignCache = null;
  function align(data, overrides) {
    if (alignCache && alignCache.data === data && alignCache.overrides === overrides) return alignCache.routes;
    const routes = alignArticles(data, overrides);
    alignCache = { data, overrides, routes };
    return routes;
  }

  function alignArticles(data, overrides) {
    buildIdf(data);
    lineCache.clear(); sentCache.clear(); relCache.clear();
    const cur = data.current.articles, prop = data.proposed.articles;
    const docOf = (a) => [...stemsOf(a.t), ...stemsOf(a.t), ...stemsOf(a.x)];
    const vecs = vectorize([...cur.map(docOf), ...prop.map(docOf)]);
    const cv = vecs.slice(0, cur.length), pv = vecs.slice(cur.length);

    // Where did an old paragraph go? Every draft article holding a line that is,
    // in whole or in part, the same provision (relate), strongest first.
    const propLines = prop.map((p) => bodyLines(p));
    const homes = (text) => {
      const found = [];
      propLines.forEach((lines, pi) => {
        let b = 0; for (const l of lines) { const d = relate(text, l); if (d > b) b = d; }
        if (b > 0) found.push({ p: pi, s: b });
      });
      found.sort((x, y) => y.s - x.s);
      // A second home only when the paragraph shares a comparable amount of wording there.
      return found.filter((h, k) => k === 0 || h.s >= SECOND_HOME * found[0].s).slice(0, MAX_HOMES);
    };

    const assigned = new Map(); // current index -> {p: proposed index, sim}
    const forced = new Set();
    for (const cn of (overrides && overrides._removed) || []) {
      const ci = cur.findIndex((a) => a.n === String(cn));
      if (ci >= 0) forced.add(ci); // forced, but never assigned → shown as removed
    }
    // "24" sends a whole article; "24§1" sends one paragraph (1-based) and leaves
    // the rest of the article to the automatic matching.
    const forcedParas = new Map(); // ci -> Map(k -> pi)
    for (const [pn, list] of Object.entries(overrides || {})) {
      if (pn.startsWith('_')) continue;
      const pi = prop.findIndex((a) => a.n === String(pn));
      if (pi < 0) continue;
      for (const item of list) {
        const [cn, para] = String(item).split('§');
        const ci = cur.findIndex((a) => a.n === cn);
        if (ci < 0) continue;
        if (para) {
          if (!forcedParas.has(ci)) forcedParas.set(ci, new Map());
          forcedParas.get(ci).set(+para - 1, pi);
        } else { assigned.set(ci, { p: pi, sim: cosine(cv[ci], pv[pi]), manual: true }); forced.add(ci); }
      }
    }
    // Containment: share of a current article's (idf-weighted) vocabulary found in a proposed article.
    // Catches articles that were folded into one long article (e.g. many rights → the single rights list).
    const sets = [...cur, ...prop].map((a) => new Set(docOf(a)));
    const df = new Map();
    sets.forEach((s) => s.forEach((x) => df.set(x, (df.get(x) || 0) + 1)));
    const idf = (x) => Math.log(1 + sets.length / df.get(x));
    const contained = (ci, pi) => {
      let hit = 0, all = 0;
      sets[ci].forEach((x) => { const w = idf(x); all += w; if (sets[cur.length + pi].has(x)) hit += w; });
      return hit / (all || 1);
    };
    // Where did an old article's title go? A draft article with nearly the same
    // title, or a draft line that opens with most of the title's words (a right
    // folded into a list keeps its name as the list item's opening words).
    // Titles are compared on longer stems (8 letters: "խորհրդանիշ" symbol vs
    // "խորհուրդ" council differ there) without the words most titles share
    // ("Republic of Armenia", "rights", "freedoms").
    const titleWords = (t) => (t.toLowerCase().match(WORD) || []).map(fixMixed).filter((w) => w.length >= 3).map((w) => w.slice(0, 8));
    const tdf = new Map();
    for (const a of [...cur, ...prop]) for (const w of new Set(titleWords(a.t))) tdf.set(w, (tdf.get(w) || 0) + 1);
    const distinct = (t) => new Set(titleWords(t).filter((w) => tdf.get(w) <= TITLE_COMMON));
    const propTitles = prop.map((p) => distinct(p.t));
    const titleHomes = (t) => {
      const T0 = prep(t), D0 = distinct(t);
      if (T0.w < TITLE_MIN) return [];
      const found = [];
      prop.forEach((p, pi) => {
        let best = D0.size && dice(D0, propTitles[pi]) >= TITLE_SAME ? 1 : 0;
        if (!best) for (const l of propLines[pi]) {
          // Only the line's opening words: a folded right's name opens its list item.
          const open = new Set(prep(l).seq.slice(0, T0.seq.length + 2));
          let w = 0; for (const x of T0.set) if (open.has(x)) w += IDF(x);
          if (w / T0.w >= TITLE_IN_LINE) { best = 1; break; }
        }
        if (best) found.push({ p: pi, s: 1 });
      });
      return found.length <= 2 ? found : []; // a title found everywhere is not evidence
    };

    const routes = new Map();
    const near = new Map(); // ci -> draft article nearest by topic, for articles shown as removed
    for (const [ci, m] of assigned) routes.set(ci, [m]); // manual matches take the whole article
    cur.forEach((c, ci) => {
      if (forced.has(ci)) return;
      const lines = bodyLines(c);
      const found = lines.map(homes);
      const title = titleHomes(c.t);

      // The main match: the draft article that holds most of the old paragraphs
      // (each found paragraph counts 1, the old title as a list item counts 1),
      // with whole-article similarity as a tie-breaker and as the only signal for
      // an article rewritten beyond recognition.
      const score = new Map();
      const add = (p, w) => score.set(p, (score.get(p) || 0) + w);
      found.forEach((f) => { if (f.length) add(f[0].p, 1); });
      if (title.length) add(title[0].p, 1);
      pv.forEach((v, pi) => { const s = cosine(cv[ci], v); if (s >= MATCH_THRESHOLD) add(pi, TFIDF_WEIGHT * s); });
      let main = -1, best = 0, merged = false;
      for (const [p, s] of score) if (s > best) { best = s; main = p; }
      if (main < 0) {
        let cs = 0;
        prop.forEach((p, pi) => { const s = contained(ci, pi); if (s > cs) { cs = s; main = pi; } });
        if (cs < CONTAIN_THRESHOLD) return; // no counterpart: shown as removed
        merged = true;
      }

      // Each paragraph is shown wherever its wording went (it can be in two
      // articles if it was split); a paragraph found nowhere stays with the main
      // match and shows as removed there.
      const byP = new Map();
      const put = (p, k) => { if (!byP.has(p)) byP.set(p, []); byP.get(p).push(k); };
      // Every paragraph is also offered to the main match; the second pass in
      // buildEntries removes it there if it found its counterpart elsewhere.
      found.forEach((f, k) => { f.forEach((h) => put(h.p, k)); });
      if (!byP.has(main) && byP.size) {
        // None of its paragraphs is in the main match: the article holding most of them leads.
        main = [...byP].sort((a, b) => b[1].length - a[1].length)[0][0];
        merged = false;
      }
      byP.set(main, lines.map((_, k) => k));
      // An article where only part of the old paragraphs landed gets just those.
      const whole = (ks) => ks.length === lines.length;
      const evidence = (p) => found.some((f) => f.some((h) => h.p === p)) || title.some((h) => h.p === p);
      // Paragraph overrides from mapping.json: the paragraph goes only where it was sent.
      const fp = forcedParas.get(ci);
      if (fp) {
        for (const [k, p] of fp) {
          for (const ks of byP.values()) { const x = ks.indexOf(k); if (x >= 0) ks.splice(x, 1); }
          if (!byP.has(p)) byP.set(p, []);
          byP.get(p).push(k);
        }
        for (const [p, ks] of byP) if (!ks.length) byP.delete(p);
        if (!byP.has(main)) main = [...byP].sort((a, b) => b[1].length - a[1].length)[0][0];
      }
      const manualP = new Set(fp ? fp.values() : []);
      if (!evidence(main) && !manualP.has(main)) {
        // The main match rests on topic similarity alone. If some paragraphs did
        // carry over elsewhere, the article holding most of them leads; if none
        // did, the article is shown as removed, with the nearest draft article by
        // topic named as a pointer, not presented as its counterpart.
        const withEvidence = [...byP].filter(([p]) => evidence(p) || manualP.has(p));
        if (!withEvidence.length) { near.set(ci, main); return; }
        byP.delete(main);
        main = withEvidence.sort((a, b) => b[1].length - a[1].length)[0][0];
        byP.set(main, lines.map((_, k) => k).filter((k) => ![...byP].some(([p, ks]) => p !== main && ks.includes(k) && fp && fp.get(k) === p)));
        merged = false;
      }
      const r = [{ p: main, sim: cosine(cv[ci], pv[main]), merged, manual: manualP.has(main), lines: whole(byP.get(main)) ? undefined : byP.get(main) }];
      for (const [p, ks] of byP) if (p !== main) r.push({ p, sim: cosine(cv[ci], pv[p]), manual: manualP.has(p), lines: ks });
      routes.set(ci, r);
    });
    routes.near = near;
    return routes;
  }

  // ---------- diff model ----------
  // An article as diff lines: its heading, then its body (only `lines`, by index, when given).
  // `src` tags each line with its article (ci), paragraph index (k) and whether
  // this is the article's main match, for the second pass in buildEntries.
  function articleLines(a, label, lines, src = {}) {
    const head = `${label} ${a.n}${a.t ? '. ' + a.t : ''}`;
    const body = bodyLines(a).map((text, k) => ({ text, k, ...src })).filter((l) => !lines || lines.includes(l.k));
    return [{ text: head, hdr: true, ...src }, ...body];
  }

  // Returns ops in the new text's order:
  //   ctx  an old line kept word for word        chg  one old line edited into one new line
  //   grp  old lines merged into / split across new lines (shown together, all old then all new)
  //   del  an old line whose wording is not in this article       add  a new line with no source here
  // Lines are linked only when they are, in whole or in part, the same provision
  // (relate); links are searched across the whole entry, so a paragraph that moved
  // still shows beside its new version. An article's new heading pairs with the
  // closest old heading, so renumbering shows.
  function diffLines(oldL, newL) {
    const ops = [];
    const oh = [], ob = [], nh = [], nb = [];
    oldL.forEach((l, i) => (l.hdr ? oh : ob).push(i));
    newL.forEach((l, j) => (l.hdr ? nh : nb).push(j));

    // Union-find over old (0..m-1) and new (m..m+n-1) lines linked by relate().
    const m = oldL.length, parent = [...Array(m + newL.length).keys()];
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const linked = new Set();
    const edges = [];
    for (const i of ob) for (const j of nb) { const s = relate(oldL[i].text, newL[j].text); if (s > 0) edges.push([s, i, j]); }
    // Drop a link that is much weaker than the old line's strongest one: sharing only
    // the name of a right is not where a paragraph about restricting it went.
    const bestOld = new Map();
    for (const [s, i] of edges) bestOld.set(i, Math.max(bestOld.get(i) || 0, s));
    edges.sort((a, b) => b[0] - a[0]); // strongest links first
    let kept = edges.filter(([s, i]) => s >= WEAK_LINK * bestOld.get(i));
    // Merges: a further old line joins a new line only if it explains wording of
    // the new line that the stronger sources don't (parallel provisions, like the
    // same "powers end when..." rule for deputies, judges and the Ombudsman, share
    // wording but only one of them is the source). Splits: the same, the other way.
    const explains = (list, side) => {
      const out = [], covered = new Map(); // line -> Set of explained positions
      for (const e of list) {
        const [, i, j] = e;
        const host = side === 'new' ? j : i;
        const pos = lcsMatches(oldL[i].text, newL[j].text)[side === 'new' ? 'b' : 'a'];
        const hp = prep((side === 'new' ? newL[j] : oldL[i]).text);
        const have = covered.get(host);
        if (!have) { covered.set(host, new Set(pos)); out.push(e); continue; }
        let gain = 0; for (const k of pos) if (!have.has(k)) gain += hp.wts[k];
        if (gain >= EXPLAIN_MIN) { pos.forEach((k) => have.add(k)); out.push(e); }
      }
      return out;
    };
    kept = explains(kept, 'new');
    kept = explains(kept, 'old');
    for (const [, i, j] of kept) { parent[find(i)] = find(m + j); linked.add(i); linked.add(m + j); }
    // Headings: the new heading takes the closest old one.
    const hc = [];
    for (const i of oh) for (const j of nh) hc.push([dice(prep(oldL[i].text).set, prep(newL[j].text).set), i, j]);
    hc.sort((a, b) => b[0] - a[0]);
    for (const [, i, j] of hc) if (!linked.has(i) && !linked.has(m + j)) { parent[find(i)] = find(m + j); linked.add(i); linked.add(m + j); }

    const groups = new Map(); // root -> {olds: [i], news: [j]}
    for (let x = 0; x < m + newL.length; x++) {
      if (!linked.has(x)) continue;
      const r = find(x);
      if (!groups.has(r)) groups.set(r, { olds: [], news: [] });
      if (x < m) groups.get(r).olds.push(x); else groups.get(r).news.push(x - m);
    }

    let oi = 0;
    // Unlinked old lines appear where they stood, before the next old line that was kept.
    const flushOld = (lim) => { for (; oi < lim; oi++) if (!linked.has(oi)) ops.push({ t: 'del', o: oldL[oi], oNum: oi + 1 }); };
    const emitted = new Set();
    newL.forEach((n, j) => {
      if (!linked.has(m + j)) { ops.push({ t: 'add', n, nNum: j + 1 }); return; }
      const r = find(m + j);
      if (emitted.has(r)) return;
      emitted.add(r);
      const g = groups.get(r);
      const first = Math.min(...g.olds);
      if (first >= oi) { flushOld(first); oi = first + 1; }
      if (g.olds.length === 1 && g.news.length === 1) {
        const i = g.olds[0], k = g.news[0];
        ops.push({ t: oldL[i].text === newL[k].text ? 'ctx' : 'chg', o: oldL[i], n: newL[k], oNum: i + 1, nNum: k + 1 });
      } else {
        const olds = g.olds.map((i) => ({ o: oldL[i], oNum: i + 1 }));
        const news = g.news.map((k) => ({ n: newL[k], nNum: k + 1 }));
        ops.push({ t: 'grp', olds, news, html: groupDiff(olds.map((x) => x.o.text), news.map((x) => x.n.text)) });
      }
    });
    flushOld(m);
    return ops;
  }

  // Word-level highlights across a merge or split: the old lines' words against the
  // new lines' words as one text each, then split back into lines.
  function groupDiff(olds, news) {
    const side = (lines, tag) => {
      const toks = [], line = [];
      lines.forEach((t, k) => { if (k) { toks.push('\u0000' + tag + k); line.push(-1); } tokenize(t).forEach((x) => { toks.push(x); line.push(k); }); });
      return { toks, line };
    };
    const A = side(olds, 'o'), B = side(news, 'n');
    const o = olds.map(() => ''), n = news.map(() => '');
    let ai = 0, bi = 0;
    for (const p of Diff.diffArrays(A.toks, B.toks)) {
      for (const x of p.value) {
        if (p.added) { const k = B.line[bi++]; if (k >= 0) n[k] += `<ins>${esc(x)}</ins>`; }
        else if (p.removed) { const k = A.line[ai++]; if (k >= 0) o[k] += `<del>${esc(x)}</del>`; }
        else { const ka = A.line[ai++], kb = B.line[bi++]; if (ka >= 0) o[ka] += esc(x); if (kb >= 0) n[kb] += esc(x); }
      }
    }
    // Adjacent highlights merge into one mark.
    const tidy = (h) => h.replace(/<\/ins><ins>/g, '').replace(/<\/del><del>/g, '');
    return { o: o.map(tidy), n: n.map(tidy) };
  }

  function wordDiff(a, b) {
    const parts = Diff.diffArrays(tokenize(a), tokenize(b));
    const same = parts.filter((p) => !p.added && !p.removed).reduce((s, p) => s + p.value.join('').length, 0);
    if (same / Math.max(a.length, b.length, 1) < 0.25) return { o: esc(a), n: esc(b) }; // too different to highlight
    let o = '', n = '';
    for (const p of parts) {
      const v = esc(p.value.join(''));
      if (p.added) n += `<ins>${v}</ins>`;
      else if (p.removed) o += `<del>${v}</del>`;
      else { o += v; n += v; }
    }
    return { o, n };
  }

  function buildEntries(data, overrides) {
    const cur = data.current.articles, prop = data.proposed.articles;
    const routes = align(data, overrides);
    const L = () => T('article');
    const entries = [];

    entries.push({
      id: 'preamble', kind: 'preamble', ch: 0,
      oldL: [{ text: T('preamble'), hdr: true }, ...data.current.preamble.split('\n').filter(Boolean).map((text) => ({ text }))],
      newL: [{ text: T('preamble'), hdr: true }, ...data.proposed.preamble.split('\n').filter(Boolean).map((text) => ({ text }))],
      label: T('preamble'), from: [],
    });

    const byProp = prop.map(() => []);
    for (const [ci, rs] of routes) rs.forEach((r, x) => byProp[r.p].push({ ci, main: x === 0, ...r }));
    const sourceLines = (o) => articleLines(cur[o.ci], L(), o.lines, { ci: o.ci, main: o.main, manual: !!o.manual });
    prop.forEach((p, pi) => {
      const olds = byProp[pi].sort((a, b) => numCmp(cur[a.ci].n, cur[b.ci].n));
      entries.push({
        id: 'p-' + p.n, kind: 'proposed', pi, ch: p.ch,
        label: `${L()} ${p.n}${p.t ? '. ' + p.t : ''}`, num: p.n,
        olds, oldL: olds.flatMap(sourceLines), newL: articleLines(p, L()),
      });
    });

    // Second pass. A paragraph that found its counterpart in one article is not
    // also shown as removed in another; a paragraph shown as removed appears only
    // in its own article's main match (or where mapping.json placed it), and only
    // when its wording is nowhere in the draft. Sources left with no paragraphs
    // drop out of the entry.
    const drafts = entries.filter((e) => e.kind === 'proposed');
    const linkedIn = (ops) => {
      const set = new Set();
      for (const op of ops) {
        if (op.t === 'chg' || op.t === 'ctx') { if (!op.o.hdr) set.add(op.o); }
        else if (op.t === 'grp') op.olds.forEach((x) => set.add(x.o));
      }
      return set;
    };
    const key = (l) => l.ci + ':' + l.k;
    const found = new Set();
    for (const e of drafts) { e.ops = diffLines(e.oldL, e.newL); e.linked = linkedIn(e.ops); e.linked.forEach((l) => found.add(key(l))); }
    for (const e of drafts) {
      // A paragraph placed by hand in mapping.json stays where it was placed.
      const keep = e.oldL.filter((l) => l.hdr || e.linked.has(l) || ((l.main || l.manual) && !found.has(key(l))));
      const olds = e.olds.filter((o) => keep.some((l) => !l.hdr && l.ci === o.ci));
      const oldL = keep.filter((l) => olds.some((o) => o.ci === l.ci));
      const shown = (o) => oldL.filter((l) => !l.hdr && l.ci === o.ci).length;
      e.from = olds.map((o) => ({ n: cur[o.ci].n, sim: o.sim, manual: o.manual, merged: o.merged, weak: o.weak, part: shown(o) < bodyLines(cur[o.ci]).length }));
      if (oldL.length !== e.oldL.length) { e.oldL = oldL; e.ops = null; }
      delete e.olds; delete e.linked;
    }

    // Removed current articles: place each after the entry that took the nearest preceding current article.
    cur.forEach((c, ci) => {
      if (routes.has(ci)) return;
      let anchor = 'preamble';
      for (let k = ci - 1; k >= 0; k--) if (routes.has(k)) { anchor = 'p-' + prop[routes.get(k)[0].p].n; break; }
      const idx = entries.findIndex((e) => e.id === anchor);
      let at = idx + 1;
      while (entries[at] && entries[at].kind === 'removed' && entries[at].anchor === anchor) at++;
      const nearP = routes.near && routes.near.has(ci) ? prop[routes.near.get(ci)].n : null;
      entries.splice(at, 0, {
        id: 'c-' + c.n, kind: 'removed', anchor, ch: entries[idx].ch, curCh: c.ch, near: nearP,
        label: `${L()} ${c.n}${c.t ? '. ' + c.t : ''}`, num: c.n, from: [],
        oldL: articleLines(c, L()), newL: [],
      });
    });

    for (const e of entries) {
      if (!e.ops) e.ops = diffLines(e.oldL, e.newL);
      e.add = e.ops.reduce((n, o) => n + (o.t === 'add' || o.t === 'chg' ? 1 : o.t === 'grp' ? o.news.length : 0), 0);
      e.del = e.ops.reduce((n, o) => n + (o.t === 'del' || o.t === 'chg' ? 1 : o.t === 'grp' ? o.olds.length : 0), 0);
      e.status = e.kind === 'removed' ? 'D' : (e.kind === 'proposed' && !e.from.length) ? 'A' : (e.add || e.del) ? 'M' : 'U';
      e.search = (e.label + ' ' + e.oldL.map((l) => l.text).join(' ') + ' ' + e.newL.map((l) => l.text).join(' ')).toLowerCase();
    }
    return entries;
  }

  // ---------- rendering ----------
  const FOLD_KEEP = 3;

  function foldPlan(ops) {
    // Returns list of items: {op} or {fold: [ops]}
    const out = [];
    let i = 0;
    while (i < ops.length) {
      if (ops[i].t !== 'ctx') { out.push({ op: ops[i++] }); continue; }
      let j = i; while (j < ops.length && ops[j].t === 'ctx') j++;
      const run = ops.slice(i, j), atStart = i === 0, atEnd = j === ops.length;
      const keepHead = atStart ? 0 : FOLD_KEEP, keepTail = atEnd ? 0 : FOLD_KEEP;
      if (run.length > keepHead + keepTail + 2 && !(atStart && atEnd)) {
        run.slice(0, keepHead).forEach((op) => out.push({ op }));
        out.push({ fold: run.slice(keepHead, run.length - keepTail) });
        run.slice(run.length - keepTail).forEach((op) => out.push({ op }));
      } else run.forEach((op) => out.push({ op }));
      i = j;
    }
    return out;
  }

  const codeHtml = (line, html) => (line.hdr ? `<b>${html}</b>` : html);

  function unifiedRows(items) {
    let h = '';
    // Group consecutive change ops so that removals precede additions, like GitHub.
    for (let i = 0; i < items.length;) {
      const it = items[i];
      if (it.fold) { h += foldRow(it.fold, 4); i++; continue; }
      if (it.op.t === 'ctx') { h += `<tr><td class="num">${it.op.oNum}</td><td class="num">${it.op.nNum}</td><td class="sign"></td><td class="code">${codeHtml(it.op.o, esc(it.op.o.text))}</td></tr>`; i++; continue; }
      const block = [];
      while (i < items.length && items[i].op && items[i].op.t !== 'ctx') block.push(items[i++].op);
      // Removals precede additions, like GitHub; each paired change is kept together so the
      // old and new versions of a line sit next to each other even inside long blocks.
      let dh = '', ah = '';
      const flush = () => { h += dh + ah; dh = ''; ah = ''; };
      for (const op of block) {
        if (op.t === 'chg') {
          flush();
          const w = wordDiff(op.o.text, op.n.text);
          h += row('del', op.oNum, '', '−', codeHtml(op.o, w.o)) + row('add', '', op.nNum, '+', codeHtml(op.n, w.n));
        } else if (op.t === 'grp') {
          // Merged or split paragraphs: all their old lines, then all their new lines, marked as one change.
          flush();
          op.olds.forEach((x, k) => { h += row('del grp', x.oNum, '', '−', op.html.o[k], k === 0 ? 'first' : ''); });
          op.news.forEach((x, k) => { h += row('add grp', '', x.nNum, '+', op.html.n[k], k === op.news.length - 1 ? 'last' : ''); });
        } else if (op.t === 'del') dh += row('del', op.oNum, '', '−', codeHtml(op.o, esc(op.o.text)));
        else ah += row('add', '', op.nNum, '+', codeHtml(op.n, esc(op.n.text)));
      }
      flush();
    }
    return h;
    function row(cls, a, b, s, html, edge = '') { return `<tr class="${cls}${edge ? ' ' + edge : ''}"><td class="num">${a}</td><td class="num">${b}</td><td class="sign">${s}</td><td class="code">${html}</td></tr>`; }
  }

  function splitRows(items) {
    let h = '';
    for (let i = 0; i < items.length;) {
      const it = items[i];
      if (it.fold) { h += foldRow(it.fold, 6); i++; continue; }
      if (it.op.t === 'ctx') { const c = codeHtml(it.op.o, esc(it.op.o.text)); h += `<tr><td class="num">${it.op.oNum}</td><td class="sign"></td><td class="code">${c}</td><td class="num mid">${it.op.nNum}</td><td class="sign"></td><td class="code">${codeHtml(it.op.n, esc(it.op.n.text))}</td></tr>`; i++; continue; }
      const block = [];
      while (i < items.length && items[i].op && items[i].op.t !== 'ctx') block.push(items[i++].op);
      // Unpaired runs between paired lines are zipped side by side.
      let L = [], R = [];
      const flush = () => {
        for (let k = 0; k < Math.max(L.length, R.length); k++) h += pair(L[k], R[k]);
        L = []; R = [];
      };
      for (const op of block) {
        if (op.t === 'chg') { flush(); const w = wordDiff(op.o.text, op.n.text); h += pair({ num: op.oNum, html: codeHtml(op.o, w.o) }, { num: op.nNum, html: codeHtml(op.n, w.n) }); }
        else if (op.t === 'grp') {
          flush();
          const rows = Math.max(op.olds.length, op.news.length);
          for (let k = 0; k < rows; k++) {
            const l = op.olds[k] && { num: op.olds[k].oNum, html: op.html.o[k] };
            const r = op.news[k] && { num: op.news[k].nNum, html: op.html.n[k] };
            h += pair(l, r, 'grp' + (k === 0 ? ' first' : '') + (k === rows - 1 ? ' last' : ''));
          }
        }
        else if (op.t === 'del') L.push({ num: op.oNum, html: codeHtml(op.o, esc(op.o.text)) });
        else R.push({ num: op.nNum, html: codeHtml(op.n, esc(op.n.text)) });
      }
      flush();
    }
    return h;
    function pair(l, r, cls = '') {
      const left = l ? `<td class="num del">${l.num}</td><td class="sign del">−</td><td class="code del">${l.html}</td>` : '<td class="num empty"></td><td class="sign empty"></td><td class="code empty"></td>';
      const right = r ? `<td class="num mid add">${r.num}</td><td class="sign add">+</td><td class="code add">${r.html}</td>` : '<td class="num mid empty"></td><td class="sign empty"></td><td class="code empty"></td>';
      return `<tr${cls ? ` class="${cls}"` : ''}>${left}${right}</tr>`;
    }
  }

  const ICON = {
    fold: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 6l3-3 3 3M5 10l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  let foldStore = [];
  function foldRow(ops, cols) {
    foldStore.push(ops);
    return `<tr class="fold" data-fold="${foldStore.length - 1}"><td colspan="${cols}"><button type="button" class="fold-btn">${ICON.fold}<span>${esc(T('unchangedLines', ops.length))}</span></button></td></tr>`;
  }

  function renderBody(e) {
    // Unchanged articles are shown fully folded.
    const items = e.status === 'U' ? [{ fold: e.ops }] : foldPlan(e.ops);
    const rows = view === 'split' ? splitRows(items) : unifiedRows(items);
    const cols = view === 'split'
      ? '<colgroup><col style="width:46px"><col style="width:20px"><col><col style="width:46px"><col style="width:20px"><col></colgroup>'
      : '<colgroup><col style="width:46px"><col style="width:46px"><col style="width:20px"><col></colgroup>';
    return `<table class="diff ${view}">${cols}<tbody>${rows}</tbody></table>`;
  }

  function expandFold(tr) {
    const ops = foldStore[+tr.dataset.fold];
    const items = ops.map((op) => ({ op }));
    const html = view === 'split' ? splitRows(items) : unifiedRows(items);
    const tmp = document.createElement('tbody');
    tmp.innerHTML = html;
    const rows = [...tmp.children];
    tr.replaceWith(...rows);
    return rows[0];
  }

  function blocks(add, del) {
    const total = add + del;
    let a = 0, d = 0;
    if (total) { a = Math.round((add / total) * 5); d = Math.round((del / total) * 5); if (a + d > 5) d = 5 - a; }
    let h = '<span class="blocks">';
    for (let i = 0; i < 5; i++) h += `<i class="${i < a ? 'a' : i < a + d ? 'd' : ''}"></i>`;
    return h + '</span>';
  }

  function fromLabel(e) {
    if (e.kind === 'removed') {
      const near = e.near ? ` · <span title="${esc(T('nearHint'))}">${esc(T('nearArt', e.near))} <a href="#p-${esc(e.near)}">${esc(e.near)}</a></span>` : '';
      return `<span class="from">${esc(T('current'))}${near}</span>`;
    }
    if (!e.from.length) return '';
    const list = e.from.map((f) => `${f.n}${f.manual ? '*' : f.merged || f.weak ? '~' : ''}${f.part ? ' ' + T('partMark') : ''}`).join(', ');
    return `<span class="from" title="${esc(T('legend'))}"><span class="arrow" aria-hidden="true">←</span>${esc(T('fromArt'))} ${esc(list)}</span>`;
  }

  // ---------- app state & UI ----------
  let DATA = null, ENTRIES = [];
  const statusOn = { M: true, A: true, D: true, U: true };
  let filterText = '';
  const viewed = new Set((() => { try { const v = JSON.parse(store.get('viewed') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } })());
  let observer = null;

  function visibleEntries() {
    return ENTRIES.filter((e) => statusOn[e.status] && (!filterText || e.search.includes(filterText) || e.num === filterText));
  }

  const emptyNote = () => `<div class="empty-note"><p>${esc(T('none'))}</p><button type="button" class="btn" data-clear>${esc(T('clearFilter'))}</button></div>`;
  function clearFilters() {
    filterText = ''; $('#filter').value = '';
    for (const k in statusOn) statusOn[k] = true;
    renderSummary(); renderTree(); renderFiles();
    $('#filter').focus();
  }

  function renderSummary() {
    const s = { cur: DATA.current.articles.length, prop: DATA.proposed.articles.length, M: 0, A: 0, D: 0, U: 0, add: 0, del: 0 };
    for (const e of ENTRIES) { s[e.status]++; s.add += e.add; s.del += e.del; }
    $('#summary').innerHTML = T('summary', s);
    $('#chips').innerHTML = ['M', 'A', 'D', 'U'].map((k) => `<button type="button" class="chip ${statusOn[k] ? '' : 'off'}" data-st="${k}" aria-pressed="${statusOn[k]}"><span class="badge b-${k}" aria-hidden="true">${k}</span>${esc(T(k))} <span class="chip-n">${s[k]}</span></button>`).join('');
  }

  function chapterTitle(n) {
    const c = DATA.proposed.chapters.find((x) => x.n === n);
    return c ? `${T('chapter')} ${n}. ${c.t}` : '';
  }

  function renderTree() {
    const list = visibleEntries();
    let h = '', lastCh = null;
    for (const e of list) {
      if (e.ch !== lastCh) { lastCh = e.ch; if (e.ch) h += `<div class="ch">${esc(chapterTitle(e.ch))}</div>`; }
      const art = e.kind === 'preamble' ? null : (e.kind === 'removed' ? DATA.current : DATA.proposed).articles.find((a) => a.n === e.num);
      const name = art ? `${e.num}. ${art.t}` : T('preamble');
      h += `<a href="#${e.id}" data-id="${e.id}" class="${viewed.has(e.id) ? 'viewed' : ''}"><span class="badge b-${e.status}" title="${esc(T(e.status))}">${e.status}</span><span class="nm" title="${esc(e.label)}">${esc(name)}</span><span class="st"><span class="plus">+${e.add}</span> <span class="minus">−${e.del}</span></span></a>`;
    }
    $('#tree').innerHTML = h || `<div class="empty-note"><p>${esc(T('none'))}</p></div>`;
  }

  function renderFiles() {
    const list = visibleEntries();
    foldStore = [];
    resetToggleAll();
    if (observer) observer.disconnect();
    $('#files').innerHTML = list.map((e) => `
      <section class="file ${viewed.has(e.id) ? 'collapsed' : ''}" id="${e.id}" data-id="${e.id}" aria-labelledby="h-${e.id}">
        <div class="fhead">
          <button type="button" class="caret" aria-label="${esc(T('toggleArticle'))}" aria-expanded="${!viewed.has(e.id)}" aria-controls="b-${e.id}">${ICON.chev}</button>
          <span class="badge b-${e.status}" title="${esc(T(e.status))}">${e.status}</span>
          <h2 class="fname" id="h-${e.id}"><span class="ftitle">${esc(e.label)}</span>${fromLabel(e)}</h2>
          <span class="counts"><span class="plus">+${e.add}</span><span class="minus">−${e.del}</span>${blocks(e.add, e.del)}</span>
          <label class="viewedbox"><input type="checkbox" class="vchk" ${viewed.has(e.id) ? 'checked' : ''}> ${esc(T('viewed'))}</label>
        </div>
        <div class="fbody" id="b-${e.id}" data-pending="1"></div>
      </section>`).join('') || emptyNote();

    const byId = new Map(ENTRIES.map((e) => [e.id, e]));
    const fill = (sec) => {
      const body = sec.querySelector('.fbody');
      if (!body.dataset.pending) return;
      delete body.dataset.pending;
      body.innerHTML = renderBody(byId.get(sec.dataset.id));
    };
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { fill(en.target); observer.unobserve(en.target); } }), { rootMargin: '1200px 0px' });
      document.querySelectorAll('.file').forEach((s) => observer.observe(s));
    } else document.querySelectorAll('.file').forEach(fill);
    window.__fillAll = () => document.querySelectorAll('.file').forEach(fill);
    fillUpTo = (target) => {
      for (const s of document.querySelectorAll('.file')) { fill(s); if (observer) observer.unobserve(s); if (s === target) break; }
    };
  }
  let fillUpTo = () => {};

  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = T(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = T(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', T(el.dataset.i18nLabel)); });
    $('#lang').textContent = lang === 'hy' ? 'EN' : 'ՀՅ';
    $('#lang').title = T('langName');
    $('#lang').lang = lang === 'hy' ? 'en' : 'hy';
    document.querySelectorAll('[data-view]').forEach((b) => { const on = b.dataset.view === view; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    syncTheme();
    if (DATA) $('#sourceLine').innerHTML = T('source', DATA);
  }

  function renderAll() {
    ENTRIES = buildEntries(DATA, OVERRIDES); // labels depend on language
    applyI18n();
    renderSummary();
    renderTree();
    renderFiles();
  }

  function scrollToHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (el && el.classList.contains('file')) {
      setCollapsed(el, false);
      fillUpTo(el);
      el.scrollIntoView({ block: 'start' });
    }
    document.querySelectorAll('.tree a').forEach((a) => { const on = a.dataset.id === id; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }

  let allCollapsed = false;
  function setCollapsed(sec, on) {
    sec.classList.toggle('collapsed', on);
    const c = sec.querySelector('.caret'); if (c) c.setAttribute('aria-expanded', String(!on));
  }
  function resetToggleAll() { allCollapsed = false; $('#toggleAll').textContent = T('collapseAll'); }

  function bind() {
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      view = b.dataset.view; store.set('view', view); applyI18n(); renderFiles();
    }));
    $('#lang').addEventListener('click', () => { lang = lang === 'hy' ? 'en' : 'hy'; store.set('lang', lang); renderAll(); });
    $('#toggleAll').addEventListener('click', () => {
      allCollapsed = !allCollapsed;
      document.querySelectorAll('.file').forEach((s) => setCollapsed(s, allCollapsed));
      $('#toggleAll').textContent = T(allCollapsed ? 'expandAll' : 'collapseAll');
    });
    let t;
    $('#filter').addEventListener('input', (ev) => {
      clearTimeout(t);
      t = setTimeout(() => { filterText = ev.target.value.trim().toLowerCase(); renderTree(); renderFiles(); }, 150);
    });
    $('#chips').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-st]'); if (!b) return;
      statusOn[b.dataset.st] = !statusOn[b.dataset.st]; renderSummary(); renderTree(); renderFiles();
    });
    $('#theme').addEventListener('click', () => {
      const light = document.documentElement.dataset.theme !== 'light';
      // Swap without every color transition firing at once.
      const root = document.documentElement;
      root.classList.add('no-trans');
      if (light) root.dataset.theme = 'light'; else delete root.dataset.theme;
      store.set('theme', light ? 'light' : 'dark');
      syncTheme();
      void root.offsetWidth;
      requestAnimationFrame(() => root.classList.remove('no-trans'));
    });
    $('#sidebar').addEventListener('click', (ev) => { if (ev.target.closest('[data-clear]')) clearFilters(); });
    $('#files').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-clear]')) { clearFilters(); return; }
      const fold = ev.target.closest('tr.fold'); if (fold) {
        const hadFocus = fold.contains(document.activeElement);
        const first = expandFold(fold);
        // The button is gone; keep keyboard focus at the first revealed line.
        if (hadFocus && first) { first.tabIndex = -1; first.focus({ preventScroll: true }); }
        return;
      }
      const caret = ev.target.closest('.caret');
      if (caret) { const s = caret.closest('.file'); setCollapsed(s, !s.classList.contains('collapsed')); }
    });
    $('#files').addEventListener('change', (ev) => {
      if (!ev.target.classList.contains('vchk')) return;
      const s = ev.target.closest('.file'), id = s.dataset.id;
      if (ev.target.checked) viewed.add(id); else viewed.delete(id);
      store.set('viewed', JSON.stringify([...viewed]));
      setCollapsed(s, ev.target.checked);
      const a = document.querySelector(`.tree a[data-id="${CSS.escape(id)}"]`); if (a) a.classList.toggle('viewed', ev.target.checked);
    });
    window.addEventListener('hashchange', scrollToHash);
    // Clicking the link of the article already in the hash fires no hashchange.
    $('#tree').addEventListener('click', (ev) => {
      const a = ev.target.closest('a[data-id]');
      if (a && decodeURIComponent(location.hash.slice(1)) === a.dataset.id) { ev.preventDefault(); scrollToHash(); }
    });
  }

  function syncTheme() {
    const light = document.documentElement.dataset.theme === 'light';
    const b = $('#theme'); if (!b) return;
    b.setAttribute('aria-label', T(light ? 'themeDark' : 'themeLight'));
    b.title = T(light ? 'themeDark' : 'themeLight');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = light ? '#f7f6f3' : '#0c0e12';
  }

  // Sticky card headers and anchor jumps sit below the top bar, whatever height it wraps to.
  function trackTopbar() {
    const bar = $('#topbar'), root = document.documentElement;
    const set = () => {
      const h = getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0;
      root.style.setProperty('--top-h', h + 'px');
    };
    set();
    if ('ResizeObserver' in window) new ResizeObserver(set).observe(bar);
    window.addEventListener('resize', set);
  }

  // The contents list is open beside the articles on wide screens and folded above them on phones.
  function trackToc() {
    const toc = $('#toc'), mq = window.matchMedia('(max-width: 900px)');
    const set = () => { toc.open = !mq.matches; };
    set();
    mq.addEventListener ? mq.addEventListener('change', set) : mq.addListener(set);
    $('#tree').addEventListener('click', (ev) => { if (mq.matches && ev.target.closest('a[data-id]')) toc.open = false; });
  }

  let OVERRIDES = {};
  async function main() {
    trackTopbar();
    trackToc();
    applyI18n();
    try {
      DATA = window.CONSTITUTION_DATA || await fetch('data/constitution.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
      OVERRIDES = window.CONSTITUTION_MAPPING || await fetch('data/mapping.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    } catch (err) {
      $('#files').innerHTML = `<div class="empty-note">${T('loadError')}</div>`;
      console.error(err);
      return;
    }
    bind();
    renderAll();
    scrollToHash();
  }
  window.__constitutionDiff = { buildEntries: (d, o) => buildEntries(d, o || {}), align, relate, sameProvision };
  main();
})();
