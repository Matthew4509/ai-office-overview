// Does this app still match AI Head Office Overview's office (the main copy), apart from the differences on the list?
// Head Office keeps its office in office/, with the same file names as this app. Every file both have is compared line
// by line, after the word swaps in head-office-differences.json (its name, its settings names, its storage keys). What
// is left must be on the list: each file's known differences, sorted as "keep" (on purpose), "port" (Head Office has
// it, this app should too) or "ours" (this app has it, Head Office should too: a note for its thread, never an edit).
// It only reads Head Office's folder.
//
//   node tools/head-office-check.mjs [path to Head Office's office folder]
//   node tools/head-office-check.mjs --show public/banter.js     every difference in one file, with line numbers
//   node tools/head-office-check.mjs --accept [file]             write today's differences into the list (after sorting)
//
// The folder: the path given, else HEAD_OFFICE, else ../ai head office overview/office beside this app. Exit code 0 when
// everything left is on the list, 1 when something changed since the list was written, 2 when it cannot run.
import fs from 'node:fs';
import path from 'node:path';

const app = path.join(import.meta.dirname, '..');
const listFile = path.join(import.meta.dirname, 'head-office-differences.json');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
  args.splice(i, v ? 2 : 1);
  return v;
};
const show = flag('--show');
const accept = flag('--accept');
const head = path.resolve(args[0] || process.env.HEAD_OFFICE || path.join(app, '..', 'ai head office overview', 'office'));

const fail = (fault, reason, wayOut) => {
  console.error(`${fault}\n${reason}\n${wayOut}`);
  process.exit(2);
};
if (!fs.existsSync(path.join(head, 'public', 'office.js'))) {
  fail(`Head Office's office folder was not found at ${head}.`,
    'The check needs a copy of AI Head Office Overview (https://github.com/Matthew4509/ai-head-office-overview) on this PC.',
    'Pass the path to its office folder: node tools/head-office-check.mjs "<path>/office"');
}
let list;
try { list = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (e) {
  fail('The list of differences could not be read.', `${listFile}: ${e.message}`, 'Fix the JSON, or restore it from git.');
}

// The folders compared, and the files in them.
const AREAS = ['public', 'src', 'test', 'tools'];
const ROOT_FILES = ['hook.mjs'];
const SKIP = new Set(['tools/head-office-check.mjs', 'tools/head-office-differences.json']);
// Pictures and icons are not compared line by line: each app draws its own.
const BINARY = /\.(ico|png|webp|jpg|jpeg|gif)$/i;
function filesIn(base) {
  const out = ROOT_FILES.filter((f) => fs.existsSync(path.join(base, f)));
  for (const area of AREAS) {
    const walk = (rel) => {
      let names = [];
      try { names = fs.readdirSync(path.join(base, rel), { withFileTypes: true }); } catch { return; }
      for (const d of names) {
        const r = `${rel}/${d.name}`;
        if (d.isDirectory()) walk(r);
        else if (!SKIP.has(r) && !BINARY.test(r)) out.push(r);
      }
    };
    walk(area);
  }
  return out.sort();
}

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
const swapped = (lines) => lines.map((l) => list.swaps.reduce((s, [theirs, ours]) => s.split(theirs).join(ours), l));

/** Line diff (longest common subsequence, the same start and end trimmed first): [{ side: '-'|'+', n, text }], '-' only
 * in this app (n = its line), '+' only in Head Office (n = Head Office's line). */
function diff(a, b) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const n = ea - s, m = eb - s, w = m + 1;
  const L = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i * w + j] = a[s + i] === b[s + j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[s + i] === b[s + j]) { i++; j++; }
    else if (j < m && (i === n || L[i * w + j + 1] >= L[(i + 1) * w + j])) { out.push({ side: '+', n: s + j + 1, text: b[s + j] }); j++; }
    else { out.push({ side: '-', n: s + i + 1, text: a[s + i] }); i++; }
  }
  return out;
}

// A difference is kept in the list as its side and its words, without the indent (so moving a block left or right is
// not news). Blank lines are left out.
const key = (d) => `${d.side} ${d.text.trim()}`;
const keysOf = (ds) => [...new Set(ds.filter((d) => d.text.trim()).map(key))].sort();

const ours = filesIn(app), theirs = filesIn(head);
const shared = ours.filter((f) => theirs.includes(f));
const files = list.files || (list.files = {});

if (show !== null) {
  if (!shared.includes(show)) fail(`${show} is not a file both apps have.`, `Both have: ${shared.join(', ')}`, 'Name one of those.');
  const ds = diff(read(path.join(app, show)), swapped(read(path.join(head, show))));
  console.log(`${show}: ${ds.length} lines differ. - this app (its line), + Head Office (its line), after the swaps.`);
  let last = null;
  for (const d of ds) {
    if (last && (d.side !== last.side || d.n !== last.n + 1)) { if (d.side === '-' || last.side === '-') console.log(''); }
    console.log(`${d.side}${String(d.n).padStart(5)}  ${d.text}`);
    last = d;
  }
  process.exit(0);
}

let changed = 0;
const lines = [];
const say = (s = '') => lines.push(s);
say(`Head Office: ${head}`);
say(`${shared.length} files in both, compared after ${list.swaps.length} word swaps.`);
say('');

const LABEL = { keep: 'on purpose', port: 'to bring here', ours: 'this app is ahead (note for Head Office)' };
for (const f of shared) {
  const ds = diff(read(path.join(app, f)), swapped(read(path.join(head, f))));
  const now = keysOf(ds);
  const entry = files[f];
  if (accept !== null && (accept === '' || accept === f)) {
    if (now.length) files[f] = { items: entry?.items || [], lines: now };
    else delete files[f];
    continue;
  }
  const was = new Set(entry?.lines || []);
  const fresh = now.filter((k) => !was.has(k));
  const nowSet = new Set(now);
  const gone = [...was].filter((k) => !nowSet.has(k));
  if (!now.length && !entry) continue;
  if (!fresh.length && !gone.length) {
    say(`${f}: known differences only`);
    for (const it of entry.items || []) say(`    ${LABEL[it.status] || it.status}: ${it.what}`);
    if (!(entry.items || []).length) say('    (not sorted yet: add items saying what these are)');
    continue;
  }
  changed++;
  say(`${f}: CHANGED since the list was written (${fresh.length} new line${fresh.length === 1 ? '' : 's'}, ${gone.length} gone)`);
  for (const it of entry?.items || []) say(`    known, ${LABEL[it.status] || it.status}: ${it.what}`);
  for (const k of fresh.slice(0, 12)) say(`    new ${k.slice(0, 150)}`);
  if (fresh.length > 12) say(`    ... and ${fresh.length - 12} more (--show ${f})`);
  if (gone.length) say(`    ${gone.length === 1 ? '1 known line no longer differs' : `${gone.length} known lines no longer differ`}: a difference was closed or changed, so update its item.`);
}
for (const f of Object.keys(files)) {
  if (!shared.includes(f) && accept === null) { changed++; say(`${f}: on the list, but no longer in both apps.`); }
}

// Files on one side only: each must be on the list as belonging to that side.
const only = list.onlyHere || {}, onlyThere = list.onlyHeadOffice || {};
const newHere = ours.filter((f) => !theirs.includes(f) && !only[f]);
const newThere = theirs.filter((f) => !ours.includes(f) && !onlyThere[f]);
if (accept === null) {
  say('');
  say(`Only in this app (on the list): ${Object.keys(only).length}. Only in Head Office (on the list): ${Object.keys(onlyThere).length}.`);
  for (const f of newHere) { changed++; say(`NEW, only in this app: ${f} (add it to onlyHere, or to Head Office's thread as a note)`); }
  for (const f of newThere) { changed++; say(`NEW, only in Head Office: ${f} (bring it here, or add it to onlyHeadOffice with the reason)`); }
  if ((list.missing || []).length) {
    say('');
    say('Whole features Head Office has and this app does not yet:');
    for (const m of list.missing) say(`    ${m}`);
  }
  say('');
  say(changed
    ? `${changed} change${changed === 1 ? '' : 's'} since the list was written. Look with --show <file>, bring across or sort each one, then --accept <file>.`
    : 'Everything left is on the list.');
  console.log(lines.join('\n'));
  process.exit(changed ? 1 : 0);
}

fs.writeFileSync(listFile, `${JSON.stringify(list, null, 2)}\n`);
console.log(`Written: ${path.relative(app, listFile)} (${accept || 'every file'}). Check each file's items still say what its lines are.`);
