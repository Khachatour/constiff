#!/usr/bin/env node
// Downloads the current and proposed constitution texts from yourconstitution.am
// and writes a compact snapshot to data/constitution.json.
//
// Usage: node scripts/fetch-data.mjs   (Node 18+, no dependencies)

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SOURCE_BASE || 'https://yourconstitution.am';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'constitution.json');

async function getJson(path) {
  const res = await fetch(BASE + path, {
    headers: { accept: 'application/json', 'user-agent': 'armenia-constitution-diff (+github)' },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// One article = list of parts; a part may contain points, a point may contain sub-points.
function flattenParts(parts = []) {
  const lines = [];
  for (const p of parts) {
    lines.push(((p.number ? `${p.number}. ` : '') + (p.text || '')).trim());
    for (const q of p.points || []) {
      lines.push(('   ' + (q.number ? `${q.number}) ` : '') + (q.text || '')).trimEnd());
      for (const r of q.points || []) {
        lines.push(('      ' + (r.number ? `${r.number} ` : '') + (r.text || '')).trimEnd());
      }
    }
  }
  // Some point texts contain their own line breaks (ա․ / բ․ sub-items); keep them as lines.
  return lines.join('\n').replace(/\r/g, '').replace(/[​ ]/g, ' ').replace(/[ \t]+\n/g, '\n');
}

function build(payload, version) {
  const info = (payload.versionInfo || {})[version] || {};
  const chapters = (payload.chapters || []).filter((c) => c.version === version);
  const chapterNo = Object.fromEntries(chapters.map((c) => [c.key, c.number]));
  const articles = (payload.articles || [])
    .filter((a) => a.version === version)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((a) => ({ n: String(a.number), t: (a.title || '').trim(), ch: chapterNo[a.chapter] ?? null, x: flattenParts(a.parts) }));
  if (!articles.length) throw new Error(`no ${version} articles in payload`);
  return {
    title: info.title || '',
    edition: info.sourceEdition || '',
    official: !!info.official,
    contentHash: info.contentHash || '',
    preamble: (info.preamble || '').trim(),
    chapters: chapters.map((c) => ({ n: c.number, t: (c.title || '').trim() })),
    articles,
  };
}

const [cur, prop] = await Promise.all([getJson('/api/content/hy/current'), getJson('/api/content/hy/proposed')]);
const data = {
  source: BASE + '/hy',
  current: build(cur, 'current'),
  proposed: build(prop, 'proposed'),
};

// Only touch the file (and its timestamp) when the texts actually changed.
let previous = null;
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}
const same = previous && JSON.stringify({ ...previous, fetchedAt: undefined }) === JSON.stringify({ ...data, fetchedAt: undefined });
if (same) {
  console.log('No changes in source texts.');
} else {
  data.fetchedAt = new Date().toISOString();
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 1) + '\n');
  console.log(`Wrote ${OUT}: ${data.current.articles.length} current, ${data.proposed.articles.length} proposed articles.`);
}
