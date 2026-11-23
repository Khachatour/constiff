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
      legend: '~ = հոդվածը հիմնականում ներառված է ավելի մեծ նոր հոդվածի մեջ, * = ձեռքով համապատասխանեցում',
      summary: (s) => `<div class="sum-arts"><span class="sum-n">${s.cur}</span><span class="sum-l">հոդված<br>գործող</span>` +
        `<span class="sum-to" aria-hidden="true">→</span><span class="sum-n">${s.prop}</span><span class="sum-l">հոդված<br>նախագիծ</span></div>` +
        `<div class="sum-lines"><span class="plus">+${s.add}</span> <span class="minus">−${s.del}</span> <span class="sum-unit">տող</span>${ratio(s)}</div>`,
      source: (d) => `Աղբյուր՝ <a href="${esc(d.source)}" target="_blank" rel="noopener">yourconstitution.am</a> · ներբեռնված ${esc(fmtDate(d.fetchedAt))}`,
      notice: 'Սա <b>նախագիծ</b> է, ոչ թե ընդունված Սահմանադրություն։ Նախագիծն ունի նոր կառուցվածք (220 → 89 հոդված), ուստի գործող և նոր հոդվածների համապատասխանեցումը կատարված է <b>ավտոմատ</b>՝ ըստ տեքստային նմանության, և կարող է սխալներ ունենալ։ Պաշտոնական տեքստը՝ <a href="https://yourconstitution.am/hy" target="_blank" rel="noopener">yourconstitution.am</a>։',
      footer: 'Անկախ, ոչ պաշտոնական գործիք։ Տեքստերը վերցված են yourconstitution.am-ից։ Հոդվածի համարի կողքին «~»՝ հոդվածը հիմնականում ներառված է ավելի մեծ նոր հոդվածի մեջ, «*»՝ ձեռքով համապատասխանեցում։ Համապատասխանեցումը կարելի է ուղղել <code>data/mapping.json</code> ֆայլով։ Diff-ը՝ <a href="https://github.com/kpdecker/jsdiff" target="_blank" rel="noopener">jsdiff</a>։',
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
      legend: '~ = mostly folded into a larger new article, * = matched by hand',
      summary: (s) => `<div class="sum-arts"><span class="sum-n">${s.cur}</span><span class="sum-l">articles<br>current</span>` +
        `<span class="sum-to" aria-hidden="true">→</span><span class="sum-n">${s.prop}</span><span class="sum-l">articles<br>draft</span></div>` +
        `<div class="sum-lines"><span class="plus">+${s.add}</span> <span class="minus">−${s.del}</span> <span class="sum-unit">lines</span>${ratio(s)}</div>`,
      source: (d) => `Source: <a href="${esc(d.source)}" target="_blank" rel="noopener">yourconstitution.am</a> · fetched ${esc(fmtDate(d.fetchedAt))}`,
      notice: 'This is a <b>draft</b>, not an adopted constitution. The draft is restructured (220 → 89 articles), so current articles are matched to new ones <b>automatically</b> by text similarity and the pairing can be wrong. Texts are in Armenian. Official text: <a href="https://yourconstitution.am/hy" target="_blank" rel="noopener">yourconstitution.am</a>.',
      footer: 'Independent, unofficial tool. Texts come from yourconstitution.am. In “current art.” lists, “~” means the old article was mostly folded into a larger new one and “*” means a hand-made match. Matching can be corrected in <code>data/mapping.json</code>. Diffing by <a href="https://github.com/kpdecker/jsdiff" target="_blank" rel="noopener">jsdiff</a>.',
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
  const stemsOf = (s) => (s.toLowerCase().match(WORD) || []).filter((w) => w.length >= 3).map((w) => w.slice(0, 6));
  const tokenize = (s) => s.split(/(\s+|[^\sԱ-Ֆա-ևA-Za-z0-9Ѐ-ӿ]+)/).filter(Boolean);
  const normLine = (l) => l.replace(/^\s*(\d+[.)]|[ա-ֆ][․.)])\s*/, '').replace(/\s+/g, ' ').trim();
  const numCmp = (a, b) => (parseFloat(a) - parseFloat(b)) || String(a).localeCompare(String(b));

  function lineSim(a, b) {
    const A = new Set(stemsOf(a)), B = new Set(stemsOf(b));
    if (!A.size || !B.size) return normLine(a) === normLine(b) ? 1 : 0;
    let n = 0; for (const x of A) if (B.has(x)) n++;
    return (2 * n) / (A.size + B.size);
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

  function align(data, overrides) {
    const cur = data.current.articles, prop = data.proposed.articles;
    const docOf = (a) => [...stemsOf(a.t), ...stemsOf(a.t), ...stemsOf(a.x)];
    const vecs = vectorize([...cur.map(docOf), ...prop.map(docOf)]);
    const cv = vecs.slice(0, cur.length), pv = vecs.slice(cur.length);

    const assigned = new Map(); // current index -> {p: proposed index, sim}
    const forced = new Set();
    for (const cn of (overrides && overrides._removed) || []) {
      const ci = cur.findIndex((a) => a.n === String(cn));
      if (ci >= 0) forced.add(ci); // forced, but never assigned → shown as removed
    }
    for (const [pn, list] of Object.entries(overrides || {})) {
      if (pn.startsWith('_')) continue;
      const pi = prop.findIndex((a) => a.n === String(pn));
      if (pi < 0) continue;
      for (const cn of list) {
        const ci = cur.findIndex((a) => a.n === String(cn));
        if (ci >= 0) { assigned.set(ci, { p: pi, sim: cosine(cv[ci], pv[pi]), manual: true }); forced.add(ci); }
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
    cur.forEach((c, ci) => {
      if (forced.has(ci)) return;
      let best = -1, bs = 0;
      pv.forEach((v, pi) => { const s = cosine(cv[ci], v); if (s > bs) { bs = s; best = pi; } });
      if (best >= 0 && bs >= MATCH_THRESHOLD) { assigned.set(ci, { p: best, sim: bs }); return; }
      let cb = -1, cs = 0;
      prop.forEach((p, pi) => { const s = contained(ci, pi); if (s > cs) { cs = s; cb = pi; } });
      if (cb >= 0 && cs >= CONTAIN_THRESHOLD) assigned.set(ci, { p: cb, sim: cs, merged: true });
    });
    return assigned;
  }

  // ---------- diff model ----------
  function articleLines(a, label) {
    const head = `${label} ${a.n}${a.t ? '. ' + a.t : ''}`;
    return [{ text: head, hdr: true }, ...a.x.split('\n').filter((l) => l.trim()).map((text) => ({ text }))];
  }

  // Returns ordered ops: ctx | chg | del | add  (with o/n line objects).
  function diffLines(oldL, newL) {
    const parts = Diff.diffArrays(oldL, newL, { comparator: (a, b) => normLine(a.text) === normLine(b.text) });
    const ops = [];
    let oi = 0, ni = 0, dels = [], adds = [];
    const flush = () => {
      if (!dels.length && !adds.length) return;
      // Pair removed/added lines monotonically by similarity.
      let j = 0;
      for (const d of dels) {
        let best = -1, bs = 0.3;
        for (let k = j; k < Math.min(adds.length, j + 4); k++) { const s = lineSim(d.text, adds[k].text); if (s > bs) { bs = s; best = k; } }
        if (best >= 0) {
          for (; j < best; j++) ops.push({ t: 'add', n: adds[j] });
          ops.push({ t: 'chg', o: d, n: adds[best] }); j = best + 1;
        } else ops.push({ t: 'del', o: d });
      }
      for (; j < adds.length; j++) ops.push({ t: 'add', n: adds[j] });
      dels = []; adds = [];
    };
    for (const p of parts) {
      const len = p.count ?? p.value.length;
      if (p.removed) { for (let i = 0; i < len; i++) dels.push(oldL[oi++]); }
      else if (p.added) { for (let i = 0; i < len; i++) adds.push(newL[ni++]); }
      else {
        flush();
        for (let i = 0; i < len; i++) {
          const o = oldL[oi++], n = newL[ni++];
          ops.push(o.text === n.text ? { t: 'ctx', o, n } : { t: 'chg', o, n });
        }
      }
    }
    flush();
    let ln = 0, rn = 0;
    for (const op of ops) { if (op.o) op.oNum = ++ln; if (op.n) op.nNum = ++rn; }
    return ops;
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
    const assigned = align(data, overrides);
    const L = () => T('article');
    const entries = [];

    entries.push({
      id: 'preamble', kind: 'preamble', ch: 0,
      oldL: [{ text: T('preamble'), hdr: true }, ...data.current.preamble.split('\n').filter(Boolean).map((text) => ({ text }))],
      newL: [{ text: T('preamble'), hdr: true }, ...data.proposed.preamble.split('\n').filter(Boolean).map((text) => ({ text }))],
      label: T('preamble'), from: [],
    });

    const byProp = prop.map(() => []);
    for (const [ci, m] of assigned) byProp[m.p].push({ ci, sim: m.sim, manual: m.manual, merged: m.merged });
    prop.forEach((p, pi) => {
      const olds = byProp[pi].sort((a, b) => numCmp(cur[a.ci].n, cur[b.ci].n));
      entries.push({
        id: 'p-' + p.n, kind: 'proposed', pi, ch: p.ch,
        label: `${L()} ${p.n}${p.t ? '. ' + p.t : ''}`, num: p.n,
        from: olds.map((o) => ({ n: cur[o.ci].n, sim: o.sim, manual: o.manual, merged: o.merged })),
        oldL: olds.flatMap((o) => articleLines(cur[o.ci], L())),
        newL: articleLines(p, L()),
      });
    });

    // Removed current articles: place each after the entry that took the nearest preceding current article.
    cur.forEach((c, ci) => {
      if (assigned.has(ci)) return;
      let anchor = 'preamble';
      for (let k = ci - 1; k >= 0; k--) if (assigned.has(k)) { anchor = 'p-' + prop[assigned.get(k).p].n; break; }
      const idx = entries.findIndex((e) => e.id === anchor);
      let at = idx + 1;
      while (entries[at] && entries[at].kind === 'removed' && entries[at].anchor === anchor) at++;
      entries.splice(at, 0, {
        id: 'c-' + c.n, kind: 'removed', anchor, ch: entries[idx].ch, curCh: c.ch,
        label: `${L()} ${c.n}${c.t ? '. ' + c.t : ''}`, num: c.n, from: [],
        oldL: articleLines(c, L()), newL: [],
      });
    });

    for (const e of entries) {
      e.ops = diffLines(e.oldL, e.newL);
      e.add = e.ops.filter((o) => o.t === 'add' || o.t === 'chg').length;
      e.del = e.ops.filter((o) => o.t === 'del' || o.t === 'chg').length;
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
        } else if (op.t === 'del') dh += row('del', op.oNum, '', '−', codeHtml(op.o, esc(op.o.text)));
        else ah += row('add', '', op.nNum, '+', codeHtml(op.n, esc(op.n.text)));
      }
      flush();
    }
    return h;
    function row(cls, a, b, s, html) { return `<tr class="${cls}"><td class="num">${a}</td><td class="num">${b}</td><td class="sign">${s}</td><td class="code">${html}</td></tr>`; }
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
        else if (op.t === 'del') L.push({ num: op.oNum, html: codeHtml(op.o, esc(op.o.text)) });
        else R.push({ num: op.nNum, html: codeHtml(op.n, esc(op.n.text)) });
      }
      flush();
    }
    return h;
    function pair(l, r) {
      const left = l ? `<td class="num del">${l.num}</td><td class="sign del">−</td><td class="code del">${l.html}</td>` : '<td class="num empty"></td><td class="sign empty"></td><td class="code empty"></td>';
      const right = r ? `<td class="num mid add">${r.num}</td><td class="sign add">+</td><td class="code add">${r.html}</td>` : '<td class="num mid empty"></td><td class="sign empty"></td><td class="code empty"></td>';
      return `<tr>${left}${right}</tr>`;
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
    if (e.kind === 'removed') return `<span class="from">${esc(T('current'))}</span>`;
    if (!e.from.length) return '';
    const list = e.from.map((f) => `${f.n}${f.manual ? '*' : f.merged ? '~' : ''}`).join(', ');
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
  window.__constitutionDiff = { buildEntries: (d, o) => buildEntries(d, o || {}), align };
  main();
})();
