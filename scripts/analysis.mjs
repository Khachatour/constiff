#!/usr/bin/env node
// Helper for data/analysis.json, the pre-written AI analysis of every change
// card (in Armenian and English). No API is called: the analyses are written
// once and committed. This script only moves card texts in and out.
//
//   node scripts/analysis.mjs status            # which cards are missing or outdated
//   node scripts/analysis.mjs export <dir>      # write those cards' texts to <dir>/<id>.txt
//   node scripts/analysis.mjs export <dir> --all
//   node scripts/analysis.mjs import <file>...  # merge written analyses (JSON: { "<id>": { kind, hy, en } })
//
// A card's text is engine.js's describeChange(): the same pairing and diff the
// site shows. Each stored analysis keeps the SHA-256 of the text it was written
// from; the site compares it and marks an analysis as outdated when the texts
// or the matching change.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'analysis.json');
const KINDS = ['substantive', 'editorial', 'renumbered', 'new', 'removed'];
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

async function cards() {
  const Diff = require('../vendor/diff.min.js');
  const engine = require('../engine.js').create({ label: (k) => ({ article: 'Հոդված', preamble: 'Նախաբան' })[k], esc: String, Diff });
  const data = JSON.parse(await readFile(join(ROOT, 'data', 'constitution.json'), 'utf8'));
  const mapping = JSON.parse(await readFile(join(ROOT, 'data', 'mapping.json'), 'utf8'));
  return engine.buildEntries(data, mapping)
    .filter((e) => e.status !== 'U')
    .map((e) => { const text = engine.describeChange(e, data); return { id: e.id, text, hash: sha256(text) }; });
}
async function load() { try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return { entries: {} }; } }
async function save(store) {
  const entries = Object.fromEntries(Object.entries(store.entries).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  await writeFile(OUT, JSON.stringify({ entries }, null, 1) + '\n');
}

function check(id, a) {
  const errs = [];
  if (!KINDS.includes(a.kind)) errs.push(`kind "${a.kind}"`);
  for (const l of ['hy', 'en']) {
    const x = a[l];
    if (!x) { errs.push(`no ${l}`); continue; }
    for (const f of ['headline', 'summary', 'notes']) if (typeof x[f] !== 'string') errs.push(`${l}.${f}`);
    if (!x.headline?.trim() || !x.summary?.trim()) errs.push(`${l} empty`);
    if (!Array.isArray(x.changes) || !x.changes.length || x.changes.some((c) => !c.change?.trim() || !c.effect?.trim())) errs.push(`${l}.changes`);
  }
  if (a.hy && !/[Ա-ֆ]/.test(a.hy.summary || '')) errs.push('hy is not in Armenian');
  if (a.hy && a.en && a.hy.changes?.length !== a.en.changes?.length) errs.push('hy/en change counts differ');
  return errs.length ? `${id}: ${errs.join(', ')}` : null;
}

const [cmd, ...rest] = process.argv.slice(2);
const all = await cards();
const store = await load();
const byId = new Map(all.map((c) => [c.id, c]));
const stale = all.filter((c) => store.entries[c.id]?.hash !== c.hash);

if (cmd === 'status' || !cmd) {
  const missing = stale.filter((c) => !store.entries[c.id]);
  console.log(`${all.length} cards: ${all.length - stale.length} up to date, ${missing.length} missing, ${stale.length - missing.length} outdated.`);
  stale.forEach((c) => console.log(`  ${store.entries[c.id] ? 'outdated' : 'missing '}  ${c.id}`));
} else if (cmd === 'export') {
  const dir = rest.find((a) => !a.startsWith('--'));
  if (!dir) throw new Error('export needs a directory');
  const list = rest.includes('--all') ? all : stale;
  await mkdir(dir, { recursive: true });
  for (const c of list) await writeFile(join(dir, `${c.id}.txt`), c.text + '\n');
  console.log(`Wrote ${list.length} card texts to ${dir}.`);
} else if (cmd === 'import') {
  let n = 0; const problems = [];
  for (const file of rest) {
    const got = JSON.parse(await readFile(file, 'utf8'));
    for (const [id, a] of Object.entries(got)) {
      if (!byId.has(id)) { problems.push(`${id}: no such card`); continue; }
      const err = check(id, a);
      if (err) { problems.push(err); continue; }
      store.entries[id] = { hash: byId.get(id).hash, kind: a.kind, hy: a.hy, en: a.en };
      n++;
    }
  }
  for (const id of Object.keys(store.entries)) if (!byId.has(id)) delete store.entries[id];
  await save(store);
  console.log(`Imported ${n} analyses.`);
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
} else {
  throw new Error(`unknown command ${cmd}`);
}
