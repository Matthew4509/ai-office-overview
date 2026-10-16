// The office's memory and its view of the world. It reads the AI app's transcripts (only reads: nothing is ever written
// near them), keeps its own ledger in data/ (so a thread deleted in the app keeps its person, nickname and earnings),
// and answers one snapshot of everyone for the page.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptyThread, readFrom, localDay } from './transcript.mjs';
import { folderOf, stateOf, assignSeats, defaultName, projectOf } from './people.mjs';
import { cleanLook } from './look.mjs';
import { AppLinks } from './applinks.mjs';

/** How long a finished thread on the Needs attention list stays there. */
const WAITING_DAYS = 7;
/** Bump when the summary's shape changes: the cache is then read again from the start. */
const CACHE_VERSION = 5;

/** How long a hook event is kept over a restart (older ones no longer change anyone's state). */
const HOOK_KEEP_MS = 24 * 3600 * 1000;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/**
 * One of the office's own files (data/). Missing: the fallback. There but unreadable, or not an object: copied aside
 * first (name.damaged-<time>.json), so the next save cannot wipe deleted threads, nicknames or the purse start.
 */
function readKept(file, fallback) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    text = null;
  }
  if (text !== null) {
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    } catch { /* copied aside below */ }
  }
  const aside = `${file.replace(/\.json$/, '')}.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  try { fs.copyFileSync(file, aside); console.error(`[data] ${path.basename(file)} could not be read: kept a copy as ${path.basename(aside)} and started it empty.`); } catch { /* nothing to keep */ }
  return fallback;
}

/** Writes beside the file, then swaps it in, so a crash never leaves half a file. */
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
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
    this.settings = readKept(this.file('settings.json'), {});
    if (!this.settings.openedAt) {
      this.settings.openedAt = new Date(this.now()).toISOString();
      this.saveSettings();
    }
    if (!this.settings.quietMinutes) this.settings.quietMinutes = 60;
    this.seatNames = readKept(this.file('seats.json'), {});
    this.ledger = readKept(this.file('ledger.json'), { threads: {} });
    if (!this.ledger.threads || typeof this.ledger.threads !== 'object') this.ledger.threads = {};
    this.done = readKept(this.file('done.json'), {});
    const cache = readJson(this.file('cache.json'), {});
    /** file path -> { offset, size, mtime, t } */
    this.files = cache.version === CACHE_VERSION && cache.since === this.settings.openedAt ? cache.files || {} : {};
    /** thread id -> newest hook event { kind, words, at } (advanced setup). Kept in hooks.json: a permission prompt
     * leaves no line in the transcript, so without it a restart would forget who is waiting for your permission. */
    this.hooks = {};
    const cut = this.now() - HOOK_KEEP_MS;
    for (const [id, h] of Object.entries(readKept(this.file('hooks.json'), {}))) {
      if (h && typeof h.kind === 'string' && Number(h.at) > cut) this.hooks[id] = { kind: h.kind, words: String(h.words || ''), at: Number(h.at) };
    }
    this.dirty = false;
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
    const rec = had && st.size >= had.size ? had : { offset: 0, t: emptyThread(id, this.settings.openedAt) };
    rec.parent = parent;
    rec.offset = readFrom(file, rec.t, rec.offset);
    rec.size = st.size;
    rec.mtime = st.mtimeMs;
    if (!parent && !rec.t.title) {
      const ct = readJson(path.join(path.dirname(file), id, 'custom-title.json'), null);
      if (ct?.customTitle) rec.t.title = String(ct.customTitle);
    }
    this.files[file] = rec;
    return 1;
  }

  /** The projects folder: the setting, else the folder most threads started in. */
  root() {
    if (this.settings.root) return this.settings.root;
    const count = {};
    for (const r of Object.values(this.files)) if (!r.parent && r.t.startCwd) count[r.t.startCwd] = (count[r.t.startCwd] || 0) + 1;
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : '';
  }

  /** The folders in the projects folder, as they are spelt on disk. */
  folderNames(root) {
    try { return fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  }

  /** Remembers a hook event (advanced setup) for a thread. */
  hook(id, kind, words = '') {
    if (!id) return;
    const now = this.now();
    this.hooks[id] = { kind, words, at: now };
    for (const [k, h] of Object.entries(this.hooks)) if (h.at <= now - HOOK_KEEP_MS) delete this.hooks[k];
    writeJson(this.file('hooks.json'), this.hooks);
  }

  setNickname(folder, seat, nick) {
    const f = String(folder ?? '');
    const s = String(Math.max(1, Math.floor(Number(seat) || 1)));
    const name = String(nick || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    this.seatNames[f] = this.seatNames[f] || {};
    if (name) this.seatNames[f][s] = { ...(this.seatNames[f][s] || {}), nick: name };
    else if (this.seatNames[f][s]) delete this.seatNames[f][s].nick;
    writeJson(this.file('seats.json'), this.seatNames);
  }

  /**
   * Favourites. A person (a seat) or a whole project can be a favourite: a favourite who goes home stays at the office
   * on a beach towel, and is listed in the Favourites tab. `hidden` takes an old favourite off that tab and the beach
   * (the star is kept). The project stars are kept in the office's settings, the seat ones beside the nickname.
   */
  setFavourite(folder, seat, on) {
    const f = String(folder ?? '');
    const s = String(Math.max(1, Math.floor(Number(seat) || 1)));
    this.seatNames[f] = this.seatNames[f] || {};
    const rec = { ...(this.seatNames[f][s] || {}) };
    if (on) rec.fav = true;
    else delete rec.fav;
    delete rec.favHidden;
    this.seatNames[f][s] = rec;
    writeJson(this.file('seats.json'), this.seatNames);
  }
  setFavouriteProject(folder, on) {
    const f = String(folder ?? '');
    const list = new Set(Array.isArray(this.settings.favProjects) ? this.settings.favProjects.map(String) : []);
    if (on) list.add(f);
    else list.delete(f);
    this.settings.favProjects = [...list].sort();
    this.saveSettings();
  }
  setFavouriteHidden(folder, seat, hidden) {
    const f = String(folder ?? '');
    const s = String(Math.max(1, Math.floor(Number(seat) || 1)));
    this.seatNames[f] = this.seatNames[f] || {};
    const rec = { ...(this.seatNames[f][s] || {}) };
    if (hidden) rec.favHidden = true;
    else delete rec.favHidden;
    this.seatNames[f][s] = rec;
    writeJson(this.file('seats.json'), this.seatNames);
  }

  /** A seat's look (EDIT on the card): a checked look, or null for the made-up one again. Answers false if refused. */
  setLook(folder, seat, look) {
    const f = String(folder ?? '');
    const s = String(Math.max(1, Math.floor(Number(seat) || 1)));
    this.seatNames[f] = this.seatNames[f] || {};
    const rec = { ...(this.seatNames[f][s] || {}) };
    if (look === null) delete rec.look;
    else {
      const clean = cleanLook(look);
      if (!clean) return false;
      rec.look = clean;
    }
    this.seatNames[f][s] = rec;
    writeJson(this.file('seats.json'), this.seatNames);
    return true;
  }

  /**
   * When a thread last needed you: its newest transcript line, or a newer hook event (advanced setup: a permission
   * prompt leaves no line in the transcript). "Answered" is kept against this, so a later need shows again.
   */
  needKey(id, lastAt) {
    const h = this.hooks[id];
    const t = Date.parse(lastAt) || 0;
    return h && h.at > t ? `hook:${h.at}` : lastAt || '';
  }

  /** Takes a thread off the Needs attention list until it needs you again (a new reply, or a new hook event). */
  markDone(id) {
    const rec = this.ledger.threads[id];
    if (!rec) return false;
    this.done[id] = this.needKey(id, rec.lastAt);
    writeJson(this.file('done.json'), this.done);
    return true;
  }

  /** Saves the ledger and the read positions, if anything changed. */
  save() {
    if (!this.dirty) return;
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
    const helpersOf = {};
    const mains = [];
    for (const r of Object.values(this.files)) {
      if (r.parent) (helpersOf[r.parent] = helpersOf[r.parent] || []).push(r.t);
      else mains.push(r.t);
    }
    const live = {};
    for (const t of mains) {
      if (!t.startedAt) continue; // nothing said yet
      const helpers = helpersOf[t.id] || [];
      const counted = helpers.filter((h) => h.worked);
      const st = stateOf(t, now, quietMs, helpers, this.hooks[t.id]);
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
    }
    // Seats: threads still on disk, plus those only the ledger remembers (deleted in the app: they keep their seat).
    const kept = {};
    for (const [id, r] of Object.entries(ledger.threads)) kept[id] = { folder: r.folder, seat: r.seat, lastAt: r.lastAt };
    const spans = Object.values(live).map((x) => ({ id: x.id, folder: x.folder, startedAt: x.startedAt, lastAt: x.lastAt, active: x.state !== 'home' }));
    for (const [id, r] of Object.entries(ledger.threads)) if (!live[id]) spans.push({ id, folder: r.folder, startedAt: r.startedAt, lastAt: r.lastAt, active: false });
    const seats = assignSeats(spans, kept, quietMs, now);
    for (const x of Object.values(live)) {
      const s = seats[x.id];
      const old = ledger.threads[x.id];
      const rec = { folder: s.folder, seat: s.seat, title: x.title, startedAt: x.startedAt, lastAt: x.lastAt, out: x.out, outSince: x.outSince, outByDay: x.outByDay, asked: x.asked };
      if (old && (old.folder !== rec.folder || old.seat !== rec.seat) && process.env.AI_OFFICE_LOG !== '0') {
        if (!preview) console.log(`[seat] ${x.id.slice(0, 8)} "${x.title}" moved from ${old.folder || 'Consultants'} ${old.seat} to ${rec.folder || 'Consultants'} ${rec.seat}`);
      }
      if (!old || JSON.stringify(old) !== JSON.stringify(rec)) { ledger.threads[x.id] = rec; if (!preview) this.dirty = true; }
    }
    // People: one per seat that has ever had a thread or a nickname.
    const people = {};
    const person = (folder, seat) => {
      const key = `${folder}#${seat}`;
      if (!people[key]) {
        const kept = this.seatNames[folder]?.[seat] || {};
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
    const projects = {};
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
      if (this.done[id] && this.done[id] === this.needKey(id, r.lastAt)) continue;
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
