// The rules that turn thread summaries (src/transcript.mjs) into people: which project folder a thread belongs to,
// which seat it sits in, what state it is in, and what each person is called. Pure functions: no files, no clock.

/** How long a step can be quiet before a thread waiting on the AI counts as thinking, and when that gives up. */
export const THINK_AFTER_MS = 15 * 1000;
export const THINK_GIVES_UP_MS = 10 * 60 * 1000;

/** Lower case, forward slashes, Git Bash's /c/ as c:, no slash at the end. */
export function normPath(p) {
  let s = String(p || '').trim().replace(/\\/g, '/');
  s = s.replace(/^\/([a-z])\//i, '$1:/');
  return s.replace(/\/+$/, '').toLowerCase();
}

function isAbsolute(p) {
  return /^([a-z]:)?[\\/]/i.test(String(p || '')) || /^[a-z]:/i.test(String(p || ''));
}

function join(dir, rel) {
  return `${String(dir || '').replace(/[\\/]+$/, '')}/${String(rel || '').replace(/^\.[\\/]/, '')}`;
}

/**
 * The project folder a path is in: the first folder under the projects folder (subfolders roll up), in the case it has
 * on disk (`names`, from a listing of the projects folder), or null when the path is not inside a project folder.
 * `isDir`: the path is a folder (a working folder), so the projects folder's own folders count even when not listed.
 */
export function projectOf(path, root, names = [], isDir = false) {
  const n = normPath(path);
  const r = normPath(root);
  if (!r || !n.startsWith(`${r}/`)) return null;
  const rest = n.slice(r.length + 1);
  const slash = rest.indexOf('/');
  const seg = slash < 0 ? rest : rest.slice(0, slash);
  if (!seg || seg.startsWith('.')) return null;
  const onDisk = names.find((x) => x.toLowerCase() === seg);
  // A file sitting in the projects folder itself is not in any project.
  if (slash < 0 && !onDisk && !isDir) return null;
  return onDisk || seg;
}

/** The project a "START HERE <path>" in the first message points at, or null. */
export function startHereProject(prompt, root, names = []) {
  const m = /START HERE[:\s]+([^\n]+)/i.exec(String(prompt || ''));
  if (!m) return null;
  let rest = m[1].trim().replace(/^["'`]/, '');
  if (isAbsolute(rest)) return projectOf(rest.replace(/["'`]\s*$/, ''), root, names);
  rest = rest.toLowerCase().replace(/\\/g, '/');
  const sorted = [...names].sort((a, b) => b.length - a.length);
  return sorted.find((x) => rest.startsWith(`${x.toLowerCase()}/`)) || null;
}

/**
 * The project folder a thread belongs to ('' = the projects folder itself: a Consultant).
 * Files it wrote and commands that did more than look decide; work in two or more projects = the projects folder
 * (an audit). With no work yet: the START HERE path in its first message, then the folder it started in (not the folder
 * its shell is in now: that moves with every cd, and each move would give the thread a new seat).
 * `helpers` are its helpers' summaries; only helpers that did real work count.
 */
export function folderOf(t, root, names = [], helpers = []) {
  const found = new Set();
  const add = (p) => { const f = projectOf(p, root, names); if (f) found.add(f); };
  const addDir = (p) => { const f = projectOf(p, root, names, true); if (f) found.add(f); };
  for (const x of [t, ...helpers.filter((h) => h.worked)]) {
    for (const p of x.wrote || []) add(isAbsolute(p) ? p : join(x.cwd, p));
    for (const r of x.ran || []) addDir(isAbsolute(r.cwd) ? r.cwd : join(x.cwd, r.cwd));
  }
  if (found.size === 1) return [...found][0];
  if (found.size > 1) return '';
  return startHereProject(t.firstPrompt, root, names) || projectOf(t.startCwd || t.cwd, root, names) || '';
}

/** The newest of a thread's own last step and its helpers' (a helper at work keeps the thread busy). */
export function lastActivity(t, helpers = []) {
  let at = t.lastAt || '';
  let from = t;
  for (const h of helpers) if ((h.lastAt || '') > at) { at = h.lastAt; from = h; }
  return { at, from };
}

/**
 * What a thread is doing at `now` (ms): { state, words, since }.
 * state: 'working' | 'thinking' | 'needs' | 'idle' | 'home'.
 * `quietMs`: after this long with nothing happening the thread has gone home.
 * `hook`: the newest hook event for the thread, if advanced setup is on ({ kind, at }), which wins when it is newer.
 */
export function stateOf(t, now, quietMs, helpers = [], hook = null) {
  const { at, from } = lastActivity(t, helpers);
  const atMs = Date.parse(at) || 0;
  if (hook && hook.at > atMs && now - hook.at <= quietMs) {
    if (hook.kind === 'needs') return { state: 'needs', words: hook.words || 'Waiting for you', since: hook.at };
    if (hook.kind === 'done') return t.asked ? { state: 'needs', words: 'Asked you something', since: hook.at } : { state: 'idle', words: 'Finished', since: hook.at };
    if (hook.kind === 'working') return { state: 'working', words: hook.words || 'Working', since: hook.at };
  }
  if (!atMs || now - atMs > quietMs) return { state: 'home', words: 'Gone home', since: atMs };
  const age = now - atMs;
  const last = from.last || { kind: 'done' };
  const helping = from !== t;
  const say = (w) => (helping ? `A helper is ${w.charAt(0).toLowerCase()}${w.slice(1)}` : w);
  switch (last.kind) {
    case 'done':
      if (helping) return { state: 'working', words: say('Finishing up'), since: atMs };
      return t.asked ? { state: 'needs', words: 'Asked you something', since: atMs } : { state: 'idle', words: 'Finished', since: atMs };
    case 'stopped':
      return { state: 'idle', words: 'Stopped', since: atMs };
    case 'tool':
      if (last.tool === 'AskUserQuestion' && !helping) return { state: 'needs', words: 'Asked you a question', since: atMs };
      return { state: 'working', words: say(last.words || 'Working'), since: atMs };
    case 'writing':
      return { state: 'working', words: say('Writing a reply'), since: atMs };
    default:
      // A message or a step's answer came in, or a think was written: the AI is on it.
      if (age < THINK_AFTER_MS) return { state: 'working', words: say(last.kind === 'prompt' ? 'Reading your message' : 'Working'), since: atMs };
      if (age < THINK_GIVES_UP_MS) return { state: 'thinking', words: say('Thinking'), since: atMs };
      return { state: 'idle', words: 'Quiet', since: atMs };
  }
}

/** The name a seat has before anyone nicknames it. */
export function defaultName(folder, seat) {
  const base = folder || 'Consultant';
  return seat > 1 ? `${base} ${seat}` : base;
}

/**
 * Seats. Each thread sits in seat 1, 2, 3, ... of its folder: the lowest seat no other thread was using when it came in
 * (using = from its start until it went quiet for `quietMs`). A seat once given stays, unless the thread is still
 * active and its folder changed (then it takes the lowest free seat in the new folder, now), or it was away long enough
 * for another thread to take its seat and has now come back (then the one that came back takes the lowest free seat
 * and the thread that kept working stays: two threads at work are never one person).
 * `threads`: [{ id, folder, startedAt, lastAt, active }]; `kept`: { id: { folder, seat, lastAt } } from the ledger, with
 * `lastAt` as last recorded there (a thread quiet for `quietMs` by that record is one that went away).
 * Answers a new { id: { folder, seat } } (kept is not changed).
 */
export function assignSeats(threads, kept, quietMs, now) {
  const out = {};
  for (const [id, k] of Object.entries(kept)) out[id] = { folder: k.folder, seat: k.seat };
  const byStart = [...threads].sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));
  const span = new Map(byStart.map((t) => [t.id, t]));
  /** Was the thread still at work when its seat was last recorded (so it did not go away and come back)? */
  const stayed = (id) => (Date.parse(kept[id]?.lastAt) || 0) + quietMs >= now;
  /** The other threads in this seat at `when` (a thread holds its seat from its start until quietMs after its last step). */
  const holders = (folder, seat, when, self) => {
    const ids = [];
    for (const [id, s] of Object.entries(out)) {
      if (id === self || s.folder !== folder || s.seat !== seat) continue;
      const u = span.get(id);
      if (!u) continue; // only threads still on record can hold a seat
      const from = Date.parse(u.startedAt) || 0;
      const to = (Date.parse(u.lastAt) || 0) + quietMs;
      if (from <= when && when <= to) ids.push(id);
    }
    return ids;
  };
  for (const t of byStart) {
    const had = out[t.id];
    if (had && !t.active) continue;
    if (had && had.folder === t.folder) {
      const others = holders(t.folder, had.seat, now, t.id);
      if (!others.length) continue;
      // Two at work in one seat: the one that came back moves and the one that stayed keeps it. When neither stayed
      // (the office was closed meanwhile), the older thread is the one that came back: the other took the seat while
      // it was away.
      if (stayed(t.id) && others.some((id) => !stayed(id))) continue;
    }
    const when = had ? now : Date.parse(t.startedAt) || now;
    if (had) delete out[t.id];
    let seat = 1;
    while (holders(t.folder, seat, when, t.id).length) seat++;
    out[t.id] = { folder: t.folder, seat };
  }
  return out;
}
