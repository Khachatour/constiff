// Checks data/changes.json against data/constitution.json:
// every referenced article exists, every quoted passage is still in its article
// (or, for `absent: true`, is still missing), and every link points to a draft article.
// Run: node scripts/check-changes.mjs   (exits 1 on any problem)
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/constitution.json', root), 'utf8'));
const changes = JSON.parse(readFileSync(new URL('data/changes.json', root), 'utf8'));

const norm = (s) => s.replace(/\s+/g, ' ').replace(/[`՝']/g, '՝').trim();
const textOf = (side, n) => {
  const book = data[side];
  if (n === 'preamble') return book.preamble;
  const a = book.articles.find((x) => x.n === String(n));
  return a ? `${a.t}\n${a.x}` : null;
};

const problems = [];
let checks = 0;
for (const p of changes.pillars) {
  for (const it of p.items) {
    const where = `${p.id}/${it.id}`;
    for (const n of it.current) if (textOf('current', n) == null) problems.push(`${where}: current article ${n} not found`);
    for (const n of it.draft) if (textOf('proposed', n) == null) problems.push(`${where}: draft article ${n} not found`);
    const link = it.link === 'preamble' ? 'preamble' : it.link.replace(/^p-/, '');
    if (textOf('proposed', link) == null) problems.push(`${where}: link #${it.link} has no draft article`);
    for (const lang of ['hy', 'en']) for (const f of ['title', 'text']) if (!it[lang]?.[f]) problems.push(`${where}: missing ${lang}.${f}`);
    for (const c of it.check || []) {
      checks++;
      const t = textOf(c.side, c.n);
      if (t == null) { problems.push(`${where}: ${c.side} ${c.n} not found`); continue; }
      const found = norm(t).includes(norm(c.text));
      if (c.absent ? found : !found) problems.push(`${where}: ${c.side} ${c.n} ${c.absent ? 'now contains' : 'no longer contains'} “${c.text}”`);
    }
  }
}
const chapters = new Set(data.proposed.chapters.map((c) => c.n));
const grouped = changes.groups.flatMap((g) => g.ch);
for (const c of chapters) if (!grouped.includes(c)) problems.push(`draft chapter ${c} is in no map group`);

if (problems.length) {
  console.error(`changes.json: ${problems.length} problem(s)\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`changes.json OK: ${checks} quotes checked across ${changes.pillars.reduce((s, p) => s + p.items.length, 0)} changes.`);
