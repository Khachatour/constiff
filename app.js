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
      footer: 'Անկախ, ոչ պաշտոնական գործիք։ Տեքստերը վերցված են yourconstitution.am-ից։ Կարմիրը գործող տեքստն է, կանաչը՝ նախագծինը։ Կարմիր և կանաչ տողերը կողք կողքի են միայն այն դեպքում, երբ դրանք նույն դրույթն են (ընդհանուր ձևակերպմամբ). միավորված կամ բաժանված պարբերությունները ցուցադրվում են միասին՝ վերևում բացատրող տողով։ Հոդվածի համարի կողքին «~»՝ համապատասխանեցված է միայն ընդհանուր նմանությամբ, «*»՝ ձեռքով համապատասխանեցում, «(մաս)»՝ այստեղ է անցել հոդվածի միայն մի մասը։ Համապատասխանեցումը կարելի է ուղղել <code>data/mapping.json</code> ֆայլով։ Diff-ը՝ <a href="https://github.com/kpdecker/jsdiff" target="_blank" rel="noopener">jsdiff</a>։',
      loadError: 'Չհաջողվեց բեռնել data/constitution.json։ Գործարկեք <code>node scripts/fetch-data.mjs</code>։',
      grpCaption: (o, n) => (n === 1 ? `Գործող ${o} պարբերություն միավորվել է նախագծի մեկ պարբերությունում` : o === 1 ? `Գործող մեկ պարբերությունը բաժանվել է նախագծի ${n} պարբերության` : `Գործող ${o} պարբերությունը վերախմբավորվել է նախագծի ${n} պարբերությունում`),
      aiBtn: 'AI վերլուծություն', aiClose: 'Փակել', aiChanges: 'Ինչ է փոխվում', aiNotes: 'Նշումներ',
      aiLoading: 'Վերլուծությունը բեռնվում է…',
      aiMissing: 'Այս հոդվածի համար վերլուծություն դեռ չկա։',
      aiError: 'Չհաջողվեց բեռնել վերլուծությունը։ Փորձեք կրկին։',
      aiStale: 'Այս վերլուծությունը գրվել է տեքստերի կամ համապատասխանեցման ավելի վաղ տարբերակի համար և կարող է չհամընկնել այս համեմատության մեջ ցուցադրվածին։',
      aiFoot: 'Գրել է արհեստական բանականությունը (Claude)՝ միայն այս համեմատության մեջ ցուցադրված տեքստերի հիման վրա։ Այն կարող է սխալներ պարունակել և իրավական խորհրդատվություն չէ․ ստուգեք բուն տեքստի հետ։',
      aiKind: { substantive: 'Բովանդակային փոփոխություն', editorial: 'Խմբագրական փոփոխություն', renumbered: 'Միայն վերահամարակալում', new: 'Նոր դրույթ', removed: 'Ձևակերպումը նախագծում չկա' },
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
      footer: 'Independent, unofficial tool. Texts come from yourconstitution.am. Red is the current text, green the draft. A red line sits beside a green one only when both are the same provision (they share its wording); paragraphs that were merged or split are shown together under a caption that says so. In “current art.” lists, “~” means matched by overall similarity only, “*” means a hand-made match, and “(part)” means only some of the old article’s paragraphs moved there. Matching can be corrected in <code>data/mapping.json</code>. Diffing by <a href="https://github.com/kpdecker/jsdiff" target="_blank" rel="noopener">jsdiff</a>.',
      loadError: 'Could not load data/constitution.json. Run <code>node scripts/fetch-data.mjs</code>.',
      grpCaption: (o, n) => (n === 1 ? `${o} current paragraphs merged into one draft paragraph` : o === 1 ? `One current paragraph split into ${n} draft paragraphs` : `${o} current paragraphs regrouped into ${n} draft paragraphs`),
      aiBtn: 'AI analysis', aiClose: 'Close', aiChanges: 'What changes', aiNotes: 'Notes',
      aiLoading: 'Loading the analysis…',
      aiMissing: 'There is no analysis for this article yet.',
      aiError: 'Could not load the analysis. Try again.',
      aiStale: 'This analysis was written for an earlier version of the texts or the matching, and may not match what this comparison shows.',
      aiFoot: 'Written by AI (Claude) from the texts shown in this comparison only. It can contain mistakes and is not legal advice: check it against the text itself.',
      aiKind: { substantive: 'Substantive change', editorial: 'Editorial change', renumbered: 'Renumbered only', new: 'New provision', removed: 'Wording not in the draft' },
    },
  };
  let lang = store.get('lang') === 'en' ? 'en' : 'hy';
  let view = store.get('view') === 'split' ? 'split' : 'unified';
  const T = (k, ...a) => { const v = I18N[lang][k]; return typeof v === 'function' ? v(...a) : v; };
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return iso; }
  }

  // ---------- matching and diff (engine.js) ----------
  const { buildEntries, align, relate, sameProvision, wordDiff, describeChange } = ConstiffEngine.create({ label: (k) => T(k), esc, Diff });

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
          h += grpCaption(op, 4);
          op.olds.forEach((x, k) => { h += row('del grp', x.oNum, '', '−', op.html.o[k]); });
          op.news.forEach((x, k) => { h += row('add grp', '', x.nNum, '+', op.html.n[k]); });
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
        else if (op.t === 'grp') {
          flush();
          h += grpCaption(op, 6);
          // Side by side, the side with fewer lines lets its last line span the
          // remaining rows: a paragraph that absorbed two old ones stands beside
          // both, with no empty cell suggesting that one of them was dropped.
          const m = op.olds.length, n = op.news.length, rows = Math.max(m, n);
          const side = (cls, num, html, span) => `<td class="num ${cls}"${span}>${num}</td><td class="sign ${cls.replace('mid ', '')}"${span}>${cls.includes('add') ? '+' : '−'}</td><td class="code ${cls.replace('mid ', '')}"${span}>${html}</td>`;
          for (let k = 0; k < rows; k++) {
            let cells = '';
            if (k < m) cells += side('del', op.olds[k].oNum, op.html.o[k], k === m - 1 && rows > m ? ` rowspan="${rows - m + 1}"` : '');
            if (k < n) cells += side('mid add', op.news[k].nNum, op.html.n[k], k === n - 1 && rows > n ? ` rowspan="${rows - n + 1}"` : '');
            h += `<tr class="grp">${cells}</tr>`;
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
    note: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 2.5h6l3 3v8h-9z M9.5 2.5v3h3 M5.5 8.5h5 M5.5 11h3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  };
  // A merge or split is labelled in words, so the bracket beside it explains itself.
  function grpCaption(op, cols) {
    return `<tr class="grp-cap"><td colspan="${cols}"><span>${esc(T('grpCaption', op.olds.length, op.news.length))}</span></td></tr>`;
  }

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
          ${e.status === 'U' ? '' : `<button type="button" class="aibtn" data-ai="${e.id}" aria-haspopup="dialog" aria-label="${esc(T('aiBtn') + ': ' + e.label)}">${ICON.note}<span>${esc(T('aiBtn'))}</span></button>`}
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
    if (aiOpenId) renderAnalysis(); // the open analysis follows the language switch
  }

  // ---------- AI analysis (pre-written, data/analysis.json) ----------
  let analysisLoad = null, aiOpenId = null, aiTrigger = null;
  const loadAnalysis = () => (analysisLoad ||= fetch('data/analysis.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .catch((err) => { analysisLoad = null; throw err; }));
  async function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return null; // no secure context: skip the outdated check
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function openAnalysis(id, trigger) {
    aiOpenId = id; aiTrigger = trigger;
    const dlg = $('#aiDialog');
    if (!dlg.open) dlg.showModal();
    renderAnalysis();
  }
  async function renderAnalysis() {
    const id = aiOpenId, e = ENTRIES.find((x) => x.id === id);
    const body = $('#aiBody');
    if (!e) return;
    $('#aiKicker').textContent = `${T('aiBtn')} · ${e.label}`;
    $('#aiTitle').textContent = e.label;
    $('#aiFoot').textContent = T('aiFoot');
    $('#aiClose').setAttribute('aria-label', T('aiClose'));
    body.innerHTML = `<p class="ai-state" role="status">${esc(T('aiLoading'))}</p>`;
    let a;
    try { a = (await loadAnalysis()).entries[id]; } catch (err) {
      if (aiOpenId === id) body.innerHTML = `<p class="ai-state" role="alert">${esc(T('aiError'))}</p>`;
      return;
    }
    if (aiOpenId !== id) return; // another card was opened meanwhile
    if (!a) { body.innerHTML = `<p class="ai-state">${esc(T('aiMissing'))}</p>`; return; }
    const x = a[lang];
    const now = await sha256(describeChange(e, DATA));
    const stale = now !== null && now !== a.hash;
    if (aiOpenId !== id) return;
    $('#aiTitle').textContent = x.headline;
    body.innerHTML =
      (stale ? `<p class="ai-stale" role="note">${esc(T('aiStale'))}</p>` : '') +
      `<span class="ai-kind k-${esc(a.kind)}">${esc(T('aiKind')[a.kind] || a.kind)}</span>` +
      `<p class="ai-summary">${esc(x.summary)}</p>` +
      `<h3 class="ai-h">${esc(T('aiChanges'))}</h3>` +
      `<ol class="ai-changes">${x.changes.map((c) => `<li><p class="ai-change">${esc(c.change)}</p><p class="ai-effect">${esc(c.effect)}</p></li>`).join('')}</ol>` +
      (x.notes ? `<h3 class="ai-h">${esc(T('aiNotes'))}</h3><p class="ai-notes">${esc(x.notes)}</p>` : '');
  }
  function bindAnalysis() {
    const dlg = $('#aiDialog');
    $('#aiClose').addEventListener('click', () => dlg.close());
    // A click on the backdrop (the dialog element itself, outside its panel) closes it.
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => {
      aiOpenId = null;
      const back = aiTrigger && aiTrigger.isConnected ? aiTrigger : document.querySelector(`.aibtn[data-ai="${CSS.escape(dlg.dataset.last || '')}"]`);
      if (back) back.focus({ preventScroll: true });
      aiTrigger = null;
    });
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
      const ai = ev.target.closest('.aibtn');
      if (ai) { $('#aiDialog').dataset.last = ai.dataset.ai; openAnalysis(ai.dataset.ai, ai); return; }
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
    bindAnalysis();
    renderAll();
    scrollToHash();
  }
  window.__constitutionDiff = { buildEntries: (d, o) => buildEntries(d, o || {}), align, relate, sameProvision };
  main();
})();
