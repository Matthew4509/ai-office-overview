// The office's memory and its view of the world. It reads the AI app's transcripts (only reads: nothing is ever written
// near them), keeps its own ledger in data/ (so a thread deleted in the app keeps its person, nickname and earnings),
// and answers one snapshot of everyone for the page.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptyThread, readFrom, localDay, stillAfterLineEnd } from './transcript.mjs';
import { folderOf, stateOf, assignSeats, defaultName, projectOf, normPath } from './people.mjs';
import { cleanLook } from './look.mjs';
import { AppLinks } from './applinks.mjs';
import { writeJson, readText, setAside, isKept, keptError } from './files.mjs';
import { oneLine } from './text.mjs';
import { boughtOf } from './shop.mjs';

/** How far ahead of this PC's clock a time may be before it is taken as written while a clock ran fast. */
const AHEAD_MS = 5 * 60_000;


/** How long a finished thread on the Needs attention list stays there. */
const WAITING_DAYS = 7;
/** Names that would reach Object.prototype if used as a key in the office's plain-object records (seats, hooks, done,
 * the ledger): a folder or thread called one of these is refused. Every other name (toString, valueOf...) is looked up
 * as the record's own key only, so it is safe to keep. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const safeKey = (k) => !UNSAFE_KEYS.has(String(k));
/** A record's own value for a key, never one every object has (toString, valueOf...). */
const own = (o, k) => (o && Object.hasOwn(o, k) ? o[k] : undefined);
/** A seat number as the office keeps it ("1" to "9999"), or '' when it is not a small whole number. */
export function seatKey(seat) {
  const n = typeof seat === 'string' && /^\s*\d{1,4}\s*$/.test(seat) ? Number(seat) : seat;
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? String(n) : '';
}
/** A project folder's name as sent by the page: text, as it is spelt on disk (so never cleaned), within reason, with
 * no hidden or control characters; null when it cannot be kept. '' is the Consultants (no project). */
const HIDDEN_IN_NAME = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
export function folderKey(folder) {
  if (folder === undefined || folder === null) return '';
  if (typeof folder !== 'string' || folder.length > 260 || HIDDEN_IN_NAME.test(folder) || !safeKey(folder)) return null;
  return folder;
}
/** The most hook events kept (one per thread id): a local program that posts made-up ids cannot grow the file without limit. */
const HOOKS_MAX = 2000;
/** Bump when the summary's shape changes: the cache is then read again from the start. */
const CACHE_VERSION = 6;

/** How long a hook event is kept over a restart (older ones no longer change anyone's state). */
const HOOK_KEEP_MS = 24 * 3600 * 1000;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** What a hand-edited or damaged file may still hold, cut to the shapes the office reads (from AI Head Office
 * Overview's office). A record of the wrong kind (null, a number, a list) is dropped rather than break every snapshot. */
const THEME_NAMES = ['auto', 'dark', 'light', 'system'];
export function cleanSettings(s) {
  const o = isPlain(s) ? { ...s } : {};
  if (typeof o.openedAt !== 'string' || Number.isNaN(Date.parse(o.openedAt))) delete o.openedAt;
  if (!(Number.isFinite(o.quietMinutes) && o.quietMinutes >= 5 && o.quietMinutes <= 1440)) delete o.quietMinutes;
  if (typeof o.root !== 'string') delete o.root;
  if (!THEME_NAMES.includes(o.theme)) delete o.theme;
  if (Array.isArray(o.favProjects)) o.favProjects = o.favProjects.filter((x) => typeof x === 'string'); else delete o.favProjects;
  return o;
}
export function cleanSeats(s) {
  const out = {};
  for (const [folder, seats] of Object.entries(isPlain(s) ? s : {})) {
    if (!safeKey(folder) || !isPlain(seats)) continue;
    out[folder] = Object.fromEntries(Object.entries(seats).filter(([n, rec]) => safeKey(n) && isPlain(rec)));
  }
  return out;
}
export function cleanLedger(l) {
  const threads = {};
  for (const [id, rec] of Object.entries(isPlain(l) && isPlain(l.threads) ? l.threads : {})) {
    if (!safeKey(id) || !isPlain(rec) || typeof rec.folder !== 'string' || !Number.isInteger(rec.seat) || rec.seat < 0) continue;
    // Only what is of the wrong kind changes, so a sound ledger reads back exactly as it was.
    const r = { ...rec };
    for (const k of ['title', 'startedAt', 'lastAt', 'asked']) if (k in r && typeof r[k] !== 'string') delete r[k];
    for (const k of ['out', 'outSince']) if (k in r && !(Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1e12)) r[k] = 0;
    if ('outByDay' in r) {
      if (!isPlain(r.outByDay)) delete r.outByDay;
      else if (Object.entries(r.outByDay).some(([d, n]) => !safeKey(d) || !(Number.isFinite(n) && n >= 0))) r.outByDay = Object.fromEntries(Object.entries(r.outByDay).filter(([d, n]) => safeKey(d) && Number.isFinite(n) && n >= 0));
    }
    threads[id] = r;
  }
  return { ...(isPlain(l) ? l : {}), threads };
}
export const cleanDone = (d) => Object.fromEntries(Object.entries(isPlain(d) ? d : {}).filter(([id, v]) => safeKey(id) && typeof v === 'string'));

/**
 * One of the office's own files (data/). Missing: the fallback. There but damaged (not JSON, or not an object): copied
 * aside first (name.damaged-<time>.json), so the next save cannot wipe deleted threads, nicknames or the purse start.
 * A byte-order mark (Notepad) is read past. With `clean`, what was read is cut to the shapes the office uses; when
 * that dropped or repaired something, the file is copied aside too. When the copy cannot be made, the file is kept:
 * no save writes over it (files.mjs).
 * There but held by another program (an antivirus at start): tried again, then the office refuses to start rather
 * than treat a file it could not read as damaged and write over it.
 */
function readKept(file, fallback, clean) {
  let text;
  try { text = readText(file); } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    const plain = new Error(`${path.basename(file)} in the office's data folder could not be read (${e.code || 'an error'}). Nothing was changed: close whatever holds it, then start the office again.`);
    plain.code = 'EHELD';
    throw plain;
  }
  let data;
  try { data = JSON.parse(text); } catch { data = undefined; }
  if (!isPlain(data)) { setAside(file, 'could not be read, and was started empty'); return fallback; }
  if (!clean) return data;
  const cleaned = clean(data);
  if (JSON.stringify(cleaned) !== JSON.stringify(data)) setAside(file, 'had records the office could not use, which were left out');
  return cleaned;
}

export class Office {
  /**
   * @param {{ dataDir: string, transcriptsDir?: string, now?: () => number }} o
   */
  constructor(o) {
    this.dataDir = o.dataDir;
    this.transcriptsDir = o.transcriptsDir || path.join(os.homedir(), '.claude', 'projects');
    this.now = o.now || (() => Date.now());
    this.file = (n) => path.join(this.dataDir, n);
    this.settings = readKept(this.file('settings.json'), {}, cleanSettings);
    // The day the office opened, dated ahead (set while the clock ran fast), would stop every token counting until
    // that day: it becomes the start of today instead.
    if (this.settings.openedAt && Date.parse(this.settings.openedAt) > this.now() + AHEAD_MS) {
      const d = new Date(this.now());
      this.settings.openedAt = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      this.saveSettings();
    }
    if (!this.settings.openedAt) {
      this.settings.openedAt = new Date(this.now()).toISOString();
      this.saveSettings();
    }
    if (!this.settings.quietMinutes) this.settings.quietMinutes = 60;
    this.seatNames = readKept(this.file('seats.json'), {}, cleanSeats);
    this.ledger = readKept(this.file('ledger.json'), { threads: {} }, cleanLedger);
    this.done = readKept(this.file('done.json'), {}, cleanDone);
    const cache = readJson(this.file('cache.json'), {});
    /** file path -> { offset, size, mtime, t } */
    this.files = cache.version === CACHE_VERSION && cache.since === this.settings.openedAt ? cache.files || {} : {};
    /** thread id -> newest hook event { kind, words, at } (advanced setup). Kept in hooks.json: a permission prompt
     * leaves no line in the transcript, so without it a restart would forget who is waiting for your permission. */
    this.hooks = {};
    const cut = this.now() - HOOK_KEEP_MS;
    // An event dated ahead (written while the clock ran fast) is dropped: it would win over every real one.
    const ahead = this.now() + AHEAD_MS;
    const loaded = [];
    for (const [id, h] of Object.entries(readKept(this.file('hooks.json'), {}))) {
      if (safeKey(id) && h && typeof h.kind === 'string' && Number(h.at) > cut && Number(h.at) <= ahead) loaded.push([id, { kind: h.kind, words: String(h.words || ''), at: Number(h.at) }]);
    }
    // Oldest first: hook() takes the oldest off the front.
    for (const [id, h] of loaded.sort((a, b) => a[1].at - b[1].at)) this.hooks[id] = h;
    this.hookCount = loaded.length;
    this.dirty = false;
    // What was bought is read once now, so a poll while another program holds office.json still shows it.
    try { boughtOf(this); } catch { /* read on the first poll */ }
    /** Links that open a thread in the AI desktop app (the open-thread button). */
    this.appLinks = o.appLinks || new AppLinks();
  }

  saveSettings() { writeJson(this.file('settings.json'), this.settings); }

  /** Reads what is new in every transcript. Answers the number of files that had something new. */
  scan() {
    const list = this.listFiles();
    let changed = this.readSome(list);
    const seen = new Set(list.map((f) => f.file));
    for (const f of Object.keys(this.files)) if (!seen.has(f)) { delete this.files[f]; changed++; }
    if (changed) this.dirty = true;
    return changed;
  }

  /** Every transcript (and helper transcript), newest first: { file, id, parent, mtime }. */
  listFiles() {
    const out = [];
    let dirs = [];
    try { dirs = fs.readdirSync(this.transcriptsDir, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { dirs = []; }
    const add = (file, id, parent) => {
      let mtime = 0;
      try { mtime = fs.statSync(file).mtimeMs; } catch { return; }
      out.push({ file, id, parent, mtime });
    };
    for (const d of dirs) {
      const dir = path.join(this.transcriptsDir, d.name);
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith('.jsonl')) add(path.join(dir, e.name), e.name.slice(0, -6), null);
        else if (e.isDirectory()) {
          const sub = path.join(dir, e.name, 'subagents');
          let helpers = [];
          try { helpers = fs.readdirSync(sub).filter((n) => n.endsWith('.jsonl')); } catch { helpers = []; }
          for (const h of helpers) add(path.join(sub, h), h.slice(0, -6), e.name);
        }
      }
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  }

  /** Reads what is new in the files given (from listFiles). Answers how many had something new. */
  readSome(list) {
    let changed = 0;
    for (const f of list) changed += this.readFile(f.file, f.id, f.parent);
    if (changed) this.dirty = true;
    return changed;
  }

  readFile(file, id, parent) {
    let st;
    try { st = fs.statSync(file); } catch { return 0; }
    const had = this.files[file];
    if (had && had.size === st.size && had.mtime === st.mtimeMs) return 0;
    // Smaller, or written again in place (the place we stopped is no longer after a line end): read it from the start.
    // A read that stopped inside a very long line it passed over (midLine) is not taken for a rewrite.
    const keep = had && st.size >= had.size && (had.midLine || stillAfterLineEnd(file, had.offset));
    const rec = keep ? had : { offset: 0, t: emptyThread(id, this.settings.openedAt) };
    // Another program holding the file (an antivirus, a backup) for a moment: nothing is recorded, so the next scan
    // reads it. Recording its new size and time here would skip what was written for good.
    const offset = readFrom(file, rec.t, rec.offset); // -1: it could not be opened, and nothing was read
    if (offset < 0) return 0;
    rec.parent = parent;
    rec.offset = offset;
    rec.midLine = offset > 0 && !stillAfterLineEnd(file, offset);
    rec.size = st.size;
    rec.mtime = st.mtimeMs;
    if (!parent && !rec.t.title) {
      const ct = readJson(path.join(path.dirname(file), id, 'custom-title.json'), null);
      if (ct?.customTitle) rec.t.title = String(ct.customTitle);
    }
    this.files[file] = rec;
    return 1;
  }

  /**
   * The projects folder: the setting, else a guess from where threads started. The folder most threads started in,
   * unless they started in sibling folders (Claude opened in each project's own folder): then their parent, so each
   * project is its own. The siblings win when they (with threads started in the parent itself) are as many as the top
   * folder's, or when there are two or more of them and the top folder's own threads work in one folder at most (it is a
   * project, not a projects folder).
   */
  root() {
    if (this.settings.root) return this.settings.root;
    const starts = new Map();
    for (const r of Object.values(this.files)) {
      if (r.parent || !r.t.startCwd) continue;
      const k = normPath(r.t.startCwd);
      const s = starts.get(k) || starts.set(k, { at: r.t.startCwd, n: 0, threads: [] }).get(k);
      s.n++;
      s.threads.push(r.t);
    }
    const [key, best] = [...starts].sort((a, b) => b[1].n - a[1].n)[0] || [];
    if (!best) return '';
    const up = (p) => p.slice(0, Math.max(p.lastIndexOf('/'), 0));
    const parentKey = up(key);
    if (!parentKey || parentKey === key) return best.at;
    let others = starts.get(parentKey)?.n || 0;
    let siblings = 0;
    for (const [k, s] of starts) if (k !== key && up(k) === parentKey) { siblings++; others += s.n; }
    if (!siblings) return best.at;
    const parent = best.at.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '') || '/';
    const asRoot = /^[a-z]:$/i.test(parent) ? `${parent}\\` : parent;
    if (others >= best.n) return asRoot;
    const worksIn = new Set();
    for (const t of best.threads) {
      for (const p of t.wrote || []) worksIn.add(projectOf(p, best.at));
      for (const r of t.ran || []) worksIn.add(projectOf(r.cwd, best.at, [], true));
    }
    worksIn.delete(null);
    return siblings >= 2 && worksIn.size < 2 ? asRoot : best.at;
  }

  /** The folders in the projects folder, as they are spelt on disk. */
  folderNames(root) {
    try { return fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  }

  /** Remembers a hook event (advanced setup) for a thread. hooks.json is written at most once a second (a later
   * event in the same second is written by a timer, or by the next save), so a burst of events never holds the server. */
  hook(id, kind, words = '') {
    if (!id || !safeKey(id)) return;
    const now = this.now();
    const had = own(this.hooks, id);
    // The same event again within a second (a program posting in a loop) changes nothing and is not written again.
    if (had && had.kind === kind && had.words === words && now - had.at < 1000) return;
    // Kept in the order they came (a thread's newer event moves it to the end), so the oldest are always first: the
    // ones past HOOK_KEEP_MS, and past the cap, come off the front without a look at every id on each event.
    delete this.hooks[id];
    this.hooks[id] = { kind, words, at: now };
    let count = this.hookCount + (had ? 0 : 1);
    for (const k in this.hooks) {
      if (count <= HOOKS_MAX && this.hooks[k].at > now - HOOK_KEEP_MS) break;
      delete this.hooks[k];
      count--;
    }
    this.hookCount = count;
    this.hooksDirty = true;
    const since = Date.now() - (this.hooksSavedAt || 0);
    if (since < 0 || since >= 1000) this.saveHooks();
    else if (!this.hooksTimer) {
      this.hooksTimer = setTimeout(() => { this.hooksTimer = null; try { this.saveHooks(); } catch (e) { console.error('[hooks]', e.message); } }, 1000 - since);
      this.hooksTimer.unref?.();
    }
  }
  saveHooks() {
    if (!this.hooksDirty) return;
    this.hooksSavedAt = Date.now();
    writeJson(this.file('hooks.json'), this.hooks);
    this.hooksDirty = false;
  }

  /**
   * Changes the seats records (nicknames, looks, stars) with `change(rec)` on one seat's record, and saves them. When
   * the save fails, nothing is kept in memory either (the page would otherwise show a change that is not on disk), and
   * the failure is passed on in plain words. Answers false when the folder or seat cannot be kept.
   */
  changeSeat(folder, seat, change) {
    const f = folderKey(folder);
    const s = seatKey(seat);
    if (f === null || !s) return false;
    const before = this.seatNames;
    const next = { ...before, [f]: { ...(own(before, f) || {}) } };
    const rec = { ...(own(next[f], s) || {}) };
    if (change(rec) === false) return false;
    if (Object.keys(rec).length) next[f][s] = rec;
    else delete next[f][s];
    writeJson(this.file('seats.json'), next); // throws, and nothing changed, when it cannot be saved
    this.seatNames = next;
    return true;
  }

  /** A seat's nickname: one line, hidden and control characters out, at most 40 characters (never half of one).
   * Text only: anything else is refused. An empty name takes the nickname off. */
  setNickname(folder, seat, nick) {
    if (nick !== undefined && nick !== null && typeof nick !== 'string') return false;
    const name = oneLine(nick ?? '', 40);
    return this.changeSeat(folder, seat, (rec) => { if (name) rec.nick = name; else delete rec.nick; });
  }

  /**
   * Favourites. A person (a seat) or a whole project can be a favourite: a favourite who goes home stays at the office
   * on a beach towel, and is listed in the Favourites tab. `hidden` takes an old favourite off that tab and the beach
   * (the star is kept). The project stars are kept in the office's settings, the seat ones beside the nickname.
   */
  setFavourite(folder, seat, on) {
    return this.changeSeat(folder, seat, (rec) => { if (on) rec.fav = true; else delete rec.fav; delete rec.favHidden; });
  }
  setFavouriteProject(folder, on) {
    const f = folderKey(folder);
    if (f === null) return false;
    const list = new Set(Array.isArray(this.settings.favProjects) ? this.settings.favProjects.filter((x) => typeof x === 'string') : []);
    if (on) list.add(f);
    else list.delete(f);
    this.changeSettings({ favProjects: [...list].sort() });
    return true;
  }
  setFavouriteHidden(folder, seat, hidden) {
    return this.changeSeat(folder, seat, (rec) => { if (hidden) rec.favHidden = true; else delete rec.favHidden; });
  }

  /** A seat's look (EDIT on the card): a checked look, or null for the made-up one again. Answers false if refused. */
  setLook(folder, seat, look) {
    let clean = null;
    if (look !== null) { clean = cleanLook(look); if (!clean) return false; }
    return this.changeSeat(folder, seat, (rec) => { if (clean) rec.look = clean; else delete rec.look; });
  }

  /** Changes the office's own settings with the fields given, and saves them; when the save fails, nothing changes. */
  changeSettings(fields) {
    const next = { ...this.settings };
    for (const [k, v] of Object.entries(fields)) { if (v === undefined) delete next[k]; else next[k] = v; }
    writeJson(this.file('settings.json'), next);
    this.settings = next;
  }

  /**
   * When a thread last needed you: its newest transcript line, or a newer hook event (advanced setup: a permission
   * prompt leaves no line in the transcript). "Answered" is kept against this, so a later need shows again.
   */
  needKey(id, lastAt) {
    const h = own(this.hooks, id);
    const t = Date.parse(lastAt) || 0;
    return h && h.at > t ? `hook:${h.at}` : lastAt || '';
  }

  /** Takes a thread off the Needs attention list until it needs you again (a new reply, or a new hook event). */
  markDone(id) {
    if (!safeKey(id) || !Object.hasOwn(this.ledger.threads, id)) return false;
    const rec = this.ledger.threads[id];
    const next = { ...this.done, [id]: this.needKey(id, rec.lastAt) };
    writeJson(this.file('done.json'), next);
    this.done = next;
    return true;
  }

  /** Saves the ledger and the read positions, if anything changed. With { atMost } (ms), not more often than that: the
   * 3-second tick saves at most every 30 seconds while threads are busy (both files always together, so they agree).
   * A last save that seems to be in the future (the clock was put back) does not hold the next one up. */
  save({ atMost = 0 } = {}) {
    if (this.hooksDirty) { try { this.saveHooks(); } catch (e) { console.error('[hooks]', e.message); } }
    if (!this.dirty) return;
    const since = Date.now() - (this.savedAt || 0);
    if (atMost && since >= 0 && since < atMost) return;
    this.savedAt = Date.now();
    writeJson(this.file('ledger.json'), this.ledger);
    writeJson(this.file('cache.json'), { version: CACHE_VERSION, since: this.settings.openedAt, files: this.files });
    this.dirty = false;
  }

  /** Everyone, every project, and who is waiting: what the page draws. */
  snapshot({ preview = false } = {}) {
    // A preview (while the first read is still going) works on a copy: nothing half-read is kept as a seat or a total.
    const ledger = preview ? structuredClone(this.ledger) : this.ledger;
    const now = this.now();
    this.appLinks.refresh();
    const quietMs = this.settings.quietMinutes * 60 * 1000;
    const root = this.root();
    const names = this.folderNames(root);
    const today = localDay(new Date(now).toISOString());
    // Maps keyed by thread ids and folder names are made without a prototype: a folder called constructor or toString
    // is then just a name, not Object.prototype's own.
    const helpersOf = Object.create(null);
    const mains = [];
    for (const r of Object.values(this.files)) {
      if (r.parent) (helpersOf[r.parent] = helpersOf[r.parent] || []).push(r.t);
      else mains.push(r.t);
    }
    const live = Object.create(null);
    for (const t of mains) {
      if (!t.startedAt) continue; // nothing said yet
      if (!safeKey(t.id)) continue; // a thread called __proto__ would become the ledger's prototype
      const helpers = helpersOf[t.id] || [];
      const counted = helpers.filter((h) => h.worked);
      const st = stateOf(t, now, quietMs, helpers, own(this.hooks, t.id));
      const outByDay = { ...t.outByDay };
      for (const h of counted) for (const [d, n] of Object.entries(h.outByDay)) outByDay[d] = (outByDay[d] || 0) + n;
      live[t.id] = {
        id: t.id,
        folder: folderOf(t, root, names, helpers),
        title: t.title || firstLine(t.firstPrompt) || 'Untitled thread',
        startedAt: t.startedAt,
        lastAt: [t.lastAt, ...helpers.map((h) => h.lastAt)].sort().pop(),
        out: t.out + counted.reduce((a, h) => a + h.out, 0),
        outSince: t.outSince + counted.reduce((a, h) => a + h.outSince, 0),
        outByDay,
        asked: t.asked,
        snag: t.snag || null,
        event: t.event || null,
        steps: t.steps,
        msgs: t.msgs || [],
        helpers: helpers.length,
        ...st,
      };
      // Answered (taken off Needs attention): no longer standing with a "?" until they need you again.
      const x = live[t.id];
      if (x.state === 'needs' && Object.hasOwn(this.done, t.id) && this.done[t.id] === this.needKey(t.id, x.lastAt)) Object.assign(x, { state: 'idle', words: 'Answered' });
    }
    // Seats: threads still on disk, plus those only the ledger remembers (deleted in the app: they keep their seat).
    const kept = Object.create(null);
    for (const [id, r] of Object.entries(ledger.threads)) kept[id] = { folder: r.folder, seat: r.seat, lastAt: r.lastAt };
    const spans = Object.values(live).map((x) => ({ id: x.id, folder: x.folder, startedAt: x.startedAt, lastAt: x.lastAt, active: x.state !== 'home' }));
    for (const [id, r] of Object.entries(ledger.threads)) if (!live[id]) spans.push({ id, folder: r.folder, startedAt: r.startedAt, lastAt: r.lastAt, active: false });
    const seats = assignSeats(spans, kept, quietMs, now);
    for (const x of Object.values(live)) {
      const s = seats[x.id];
      const old = own(ledger.threads, x.id);
      const rec = { folder: s.folder, seat: s.seat, title: x.title, startedAt: x.startedAt, lastAt: x.lastAt, out: x.out, outSince: x.outSince, outByDay: x.outByDay, asked: x.asked };
      if (old && (old.folder !== rec.folder || old.seat !== rec.seat) && process.env.AI_OFFICE_LOG !== '0') {
        if (!preview) console.log(`[seat] ${x.id.slice(0, 8)} "${x.title}" moved from ${old.folder || 'Consultants'} ${old.seat} to ${rec.folder || 'Consultants'} ${rec.seat}`);
      }
      if (!old || JSON.stringify(old) !== JSON.stringify(rec)) { ledger.threads[x.id] = rec; if (!preview) this.dirty = true; }
    }
    // People: one per seat that has ever had a thread or a nickname.
    const people = Object.create(null);
    const person = (folder, seat) => {
      const key = `${folder}#${seat}`;
      if (!people[key]) {
        const kept = own(own(this.seatNames, folder), String(seat)) || {};
        const nick = kept.nick || '';
        const look = kept.look || null;
        // A favourite: the seat itself, or every seat of a favourite project.
        const favSeat = !!kept.fav;
        const favProject = favProjects.has(folder);
        people[key] = { key, folder, seat, name: nick || defaultName(folder, seat), nick, look, fav: favSeat || favProject, favSeat, favProject, favHidden: !!kept.favHidden, state: 'home', words: 'Gone home', since: 0, thread: null, recent: null, threads: 0, out: 0, outSince: 0, today: 0, lastAt: '' };
      }
      return people[key];
    };
    const favProjects = new Set(Array.isArray(this.settings.favProjects) ? this.settings.favProjects.map(String) : []);
    for (const [folder, bySeat] of Object.entries(this.seatNames)) for (const seat of Object.keys(bySeat)) if (bySeat[seat]?.nick || bySeat[seat]?.look || bySeat[seat]?.fav) person(folder, Number(seat));
    const rank = { working: 4, thinking: 3, needs: 2, idle: 1, home: 0 };
    for (const [id, r] of Object.entries(ledger.threads)) {
      const p = person(r.folder, r.seat);
      p.threads++;
      p.out += r.out || 0;
      p.outSince += r.outSince || 0;
      p.today += r.outByDay?.[today] || 0;
      if ((r.lastAt || '') > p.lastAt) p.lastAt = r.lastAt;
      // Their newest thread still on disk, working or not: its title and last messages for the card.
      const lx = live[id];
      if (lx && (!p.recent || (lx.lastAt || '') > (p.recent.lastAt || ''))) p.recent = { id, open: this.appLinks.open(id), title: lx.title, lastAt: lx.lastAt, msgs: lx.msgs };
      const x = live[id];
      if (!x || x.state === 'home') continue;
      const better = !p.thread || rank[x.state] > rank[p.state] || (rank[x.state] === rank[p.state] && x.lastAt > p.thread.lastAt);
      if (better) {
        p.state = x.state;
        p.words = x.words;
        p.since = x.since;
        p.snag = x.snag;
        p.event = x.event;
        p.thread = { id, open: this.appLinks.open(id), title: x.title, startedAt: x.startedAt, lastAt: x.lastAt, asked: x.asked, steps: x.steps, helpers: x.helpers, out: x.out };
      }
    }
    // Projects: every folder with a thread today or one still active.
    const projects = Object.create(null);
    for (const p of Object.values(people)) {
      const today_ = (p.lastAt && localDay(p.lastAt) === today) || p.state !== 'home';
      if (!today_) continue;
      const pr = projects[p.folder] || (projects[p.folder] = { folder: p.folder, name: p.folder || 'Consultants', people: [], working: 0, thinking: 0, needs: 0, idle: 0, home: 0 });
      pr.people.push(p.key);
      pr[p.state]++;
    }
    // Needs attention: every thread whose last reply asked something, longest waiting first.
    const waiting = [];
    const cutoff = now - WAITING_DAYS * 24 * 3600 * 1000;
    for (const [id, r] of Object.entries(ledger.threads)) {
      const x = live[id];
      if (!x) continue; // deleted in the app: nothing to go back to
      const needsNow = x.state === 'needs';
      const goneWaiting = x.state === 'home' && !!x.asked;
      if (!needsNow && !goneWaiting) continue;
      const asked = x.asked || x.words;
      const lastMs = Date.parse(r.lastAt) || 0;
      if (lastMs < cutoff) continue;
      if (own(this.done, id) && this.done[id] === this.needKey(id, r.lastAt)) continue;
      const p = person(r.folder, r.seat);
      waiting.push({ id, person: p.key, name: p.name, folder: r.folder, title: r.title, asked, since: (needsNow && x.since) || lastMs, gone: goneWaiting });
    }
    waiting.sort((a, b) => a.since - b.since);
    let purse = 0;
    for (const r of Object.values(ledger.threads)) purse += r.outSince || 0;
    return {
      now,
      root,
      openedAt: this.settings.openedAt,
      quietMinutes: this.settings.quietMinutes,
      people: Object.values(people).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')),
      projects: Object.values(projects).sort((a, b) => a.name.localeCompare(b.name)),
      favProjects: [...favProjects].sort(),
      waiting,
      earned: purse,
    };
  }
}

function firstLine(s) {
  return String(s || '').split('\n').map((x) => x.trim()).find(Boolean)?.slice(0, 120) || '';
}

export { projectOf };
