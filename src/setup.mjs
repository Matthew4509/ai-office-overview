// Setup: easy (read the transcripts only, the default) or advanced (three small hooks in the AI app's own settings, so
// the app tells the office straight away when a thread gets a message, waits for you, or finishes). Advanced setup only
// adds its own entries beside whatever hooks are there already, saves a copy of the file first, and can be taken off
// again. Also the office's own settings: the projects folder and the gone-home time.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { swapIn } from './files.mjs';

/** The hook events advanced setup adds, and what each tells the office. */
export const EVENTS = ['UserPromptSubmit', 'Notification', 'Stop'];
/** Every command this office writes contains this, so it can find (and remove) its own entries and no others. */
const MARK = 'ai-office-overview-hook';

export function settingsFile() {
  return process.env.AI_OFFICE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
}

/** A whole number too long for JavaScript to keep exactly (over 15 digits), as written in the file. */
const BIG = /^-?\d{16,}$/;
/**
 * Reads the AI app's settings: { data, text, big } or { error }. `big` maps a marker to each whole number too long to
 * keep exactly (an id, say), so writing the file back keeps its digits as they were (see textOf). Where this Node.js
 * cannot see a number's own digits (before 21), such a file is refused rather than written back changed.
 * A file another program holds, or one that is not a JSON object (with `hooks` an object when there), is an error,
 * never thrown, and the office does not touch it.
 */
export function readSettings(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return { data: {}, text: '', big: new Map() };
    return { error: { fault: 'Claude\'s settings file could not be read.', reason: `Another program may be holding it (${e.code || 'an error'}), so the office left it alone.`, wayOut: 'Close whatever has it open, then try again.' } };
  }
  const big = new Map();
  let lossy = false;
  // A file saved by Notepad can start with a byte-order mark: Claude Code accepts it, so the office does too.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let data;
  try {
    data = JSON.parse(body || '{}', (key, value, ctx) => {
      if (typeof value !== 'number' || Number.isSafeInteger(value) || !Number.isFinite(value)) return value;
      const src = ctx?.source;
      if (typeof src === 'string' && BIG.test(src)) { const k = `__ai_office_big_${big.size}__`; big.set(k, src); return k; }
      if (typeof src !== 'string' && Number.isInteger(value)) lossy = true;
      return value;
    });
  } catch {
    return { error: { fault: 'Claude\'s settings file could not be read.', reason: `${path.basename(file)} is not valid JSON, so the office will not touch it.`, wayOut: 'Fix the file (or let Claude fix it), then try again.' } };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || (data.hooks !== undefined && (!data.hooks || typeof data.hooks !== 'object' || Array.isArray(data.hooks)))) {
    return { error: { fault: 'Claude\'s settings file is not in the shape the office knows.', reason: 'It is not a set of named settings with hooks as named events, so the office will not rewrite it.', wayOut: 'Check the file (or let Claude check it), then try again.' } };
  }
  if (lossy) return { error: { fault: 'Claude\'s settings file has a number too long to keep exactly.', reason: 'This Node.js would write it back with other digits, so the office will not touch the file.', wayOut: 'Use Node.js 22 or newer, or turn advanced setup on by hand (AGENTS.md).' } };
  return { data, text, big };
}
/** The settings as text, each long number written back with its own digits. */
export function textOf(data, big) {
  let out = `${JSON.stringify(data, null, 2)}\n`;
  for (const [k, digits] of big) out = out.split(`"${k}"`).join(digits);
  return out;
}

/** The command written into the AI app's settings for this office. The path sits in double quotes, which bash (Claude
 * Code runs hooks through Git Bash on Windows) still reads $ and backticks in, and cmd.exe reads % in: apply() refuses
 * a path holding one of those (or a ") before anything is written. */
export const UNSAFE_HOOK_PATH = /[$`"%\r\n]/;
export function hookCommand(hookScript, port) {
  // A copy put here by the installer brings its own Node.js in node\, and the PC may have no other: use that one.
  const bundled = path.join(path.dirname(hookScript), 'node', 'node.exe');
  const node = fs.existsSync(bundled) ? `"${bundled.replace(/\\/g, '/')}"` : 'node';
  return `${node} "${hookScript.replace(/\\/g, '/')}" ${port} --${MARK}`;
}

/** Every mark this office has written: today's, and the one from before the rename in 0.1.7. Only these count as ours:
 * other programs write hooks that look the same (a hook.mjs, a port, their own --…-hook mark), and those are theirs.
 * The command must also have the shape the office writes (a hook.mjs, a port, then the mark last): another program's
 * hook that only mentions the mark (in an echo, say) is not ours. */
const MARKS = [MARK, 'claude-office-hook'];
const OURS_SHAPE = new RegExp(`hook\\.mjs"?\\s+\\d{1,5}\\s+--(?:${MARKS.join('|')})$`);
const isOurs = (h) => typeof h?.command === 'string' && OURS_SHAPE.test(h.command.trim());
/** The hook.mjs a hook command runs, as written ('' when none is named). */
const scriptOf = (cmd) => ((/"([^"]*hook\.mjs)"/i.exec(cmd) || /(?:^|\s)([^\s"]*hook\.mjs)(?=\s|$)/i.exec(cmd)) || [])[1] || '';
const samePath = (p) => path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
/** One of this office's hooks that belongs to the copy in `folder`: it runs that folder's hook.mjs, or a hook.mjs that
 * is no longer there (the folder was moved). Another copy's hooks (a clone, a zip copy, the installed one: they all
 * write the same mark) are that copy's own, and are left alone. Without a folder, every hook of ours counts. */
function isMine(h, folder) {
  if (!isOurs(h)) return false;
  if (!folder) return true;
  const script = scriptOf(h.command);
  if (!script) return true;
  if (samePath(path.dirname(script)) === samePath(folder)) return true;
  try { return !fs.existsSync(script); } catch { return false; }
}

/** The AI app's settings without this office's entries (everything else exactly as it was). With `folder`, only
 * that copy's entries go (see isMine). */
export function withoutOurs(data, folder = '') {
  const out = { ...data };
  if (!out.hooks || typeof out.hooks !== 'object') return out;
  const hooks = {};
  for (const [event, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) { hooks[event] = groups; continue; }
    const kept = groups.map((g) => (Array.isArray(g?.hooks) ? { ...g, hooks: g.hooks.filter((h) => !isMine(h, folder)) } : g)).filter((g) => !Array.isArray(g?.hooks) || g.hooks.length);
    if (kept.length) hooks[event] = kept;
  }
  if (Object.keys(hooks).length) out.hooks = hooks;
  else delete out.hooks;
  return out;
}

/** The AI app's settings with this office's entries added (its old ones replaced, nobody else's touched). */
export function withOurs(data, command, folder = '') {
  const out = withoutOurs(data, folder);
  out.hooks = { ...(out.hooks || {}) };
  for (const event of EVENTS) {
    const groups = Array.isArray(out.hooks[event]) ? out.hooks[event] : [];
    out.hooks[event] = [...groups, { hooks: [{ type: 'command', command, timeout: 3 }] }];
  }
  return out;
}

/** Whether advanced setup is on, from the AI app's settings file. With { port, hookScript }, also whether every one of
 * the office's hooks still names this folder and port (hookHere): after the folder is moved, the hooks still point at
 * the old place and run a failing script on every event until they are written again. */
export function status(office, { port, hookScript } = {}) {
  const file = settingsFile();
  const r = readSettings(file); // never throws: a held or damaged file reads as "not readable"
  const ours = r.error ? [] : Object.values(r.data.hooks || {}).flatMap((groups) => (Array.isArray(groups) ? groups.flatMap((g) => (Array.isArray(g?.hooks) ? g.hooks.filter((h) => isMine(h, hookScript ? path.dirname(String(hookScript)) : '')) : [])) : []));
  const on = ours.length > 0;
  const want = hookScript ? hookCommand(hookScript, port) : null;
  return {
    mode: on ? 'advanced' : 'easy',
    hookHere: on && want ? ours.every((h) => h.command === want) : null,
    settingsFile: file,
    readable: !r.error,
    lastHookAt: office.lastHookAt || 0,
    root: office.root(),
    rootSet: !!office.settings.root,
    quietMinutes: office.settings.quietMinutes,
    theme: THEMES.includes(office.settings.theme) ? office.settings.theme : '',
  };
}

/** The page's colours: auto (light from sunrise to sunset), dark, light, or "system" (follows Windows). Until one is
 * chosen, THEME_DEFAULT: light (day). */
export const THEMES = ['auto', 'dark', 'light', 'system'];
export const THEME_DEFAULT = 'light';
/** The theme the page is served in: the one chosen in Setup, or the default. */
export const theme = (office) => (THEMES.includes(office.settings.theme) ? office.settings.theme : THEME_DEFAULT);

/** Turns advanced setup on or off: { advanced: true | false }. A copy of the settings file is kept first. */
export function apply(office, b, { port, hookScript }) {
  if (typeof b?.advanced !== 'boolean') return { error: { fault: 'That setup choice was not understood.', reason: 'Advanced setup is turned on or off, nothing else.', wayOut: 'Press the button in Setup again.' } };
  const file = settingsFile();
  const r = readSettings(file);
  if (r.error) return r;
  if (b.advanced && UNSAFE_HOOK_PATH.test(String(hookScript))) {
    return { error: { fault: 'Advanced setup cannot be turned on from this folder.', reason: `The office's folder (${path.dirname(String(hookScript))}) has a $, backtick, " or % in its path, which Claude's hook runner would read as part of a command.`, wayOut: 'Move the office to a folder whose path has none of those characters, then try again. Easy setup still works.' } };
  }
  const folder = path.dirname(String(hookScript));
  const next = b.advanced ? withOurs(r.data, hookCommand(hookScript, port), folder) : withoutOurs(r.data, folder);
  const text = textOf(next, r.big);
  if (text === r.text) return { ok: true, status: status(office), unchanged: true };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let backup = '';
    if (r.text) {
      backup = `${file}.before-ai-office-overview-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.writeFileSync(backup, r.text);
    }
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text);
    swapIn(tmp, file);
    return { ok: true, backup, status: status(office, { port, hookScript }) };
  } catch (e) {
    return { error: { fault: 'Claude\'s settings could not be changed.', reason: `The file could not be written (${e?.code || 'an error'}); it is as it was.`, wayOut: 'Check the file is not open elsewhere and that this user can write to it, then try again. Easy setup still works.' } };
  }
}

/** A hook event from hook.mjs: what it says about the thread. */
export function onHook(office, b) {
  const id = String(b?.session || '').replace(/[^\w-]/g, '').slice(0, 80);
  if (!id) return;
  office.lastHookAt = office.now();
  const event = String(b.event || '');
  const message = String(b.message || '');
  if (event === 'UserPromptSubmit') office.hook(id, 'working', 'Reading your message');
  else if (event === 'Stop') office.hook(id, 'done');
  // A permission prompt needs you. "Waiting for your input" comes a minute after every finished reply, asked or not:
  // the reply itself says whether it asked something, so it counts as finished.
  else if (event === 'Notification') office.hook(id, /permission/i.test(message) ? 'needs' : 'done', /permission/i.test(message) ? 'Waiting for your permission' : '');
}

const isWin = process.platform === 'win32';
const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
/** Folders that cannot be the projects folder: a whole drive, Windows itself and the program folders. Every poll lists
 * the projects folder, so one of these would show every system folder as a project. */
function systemFolder(root) {
  const r = norm(root);
  if (path.parse(path.resolve(root)).root.replace(/[\\/]+$/, '').toLowerCase() === r) return true;
  if (!isWin) return ['/', '/usr', '/bin', '/etc', '/var', '/system', '/library'].includes(r);
  const env = process.env;
  return [env.SystemRoot || 'C:\\Windows', env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramData].filter(Boolean)
    .some((s) => { const n = norm(s); return r === n || r.startsWith(`${n}\\`); });
}

/** The office's own settings: { root, quietMinutes, theme }. Every part is checked before anything changes, so a
 * request refused for one part changes nothing; and a save that fails changes nothing either. */
export function settings(office, b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: { fault: 'That setting was not understood.', reason: 'The request had no settings in it.', wayOut: 'Refresh the page and try again.' } };
  const change = {};
  if (b.theme !== undefined) {
    if (!THEMES.includes(b.theme)) return { error: { fault: 'That theme is not one the office has.', reason: `It knows ${THEMES.join(', ')}.`, wayOut: 'Pick Auto, Dark, Light or Match Windows in Setup.' } };
    change.theme = b.theme;
  }
  if (b.root !== undefined) {
    if (b.root !== null && typeof b.root !== 'string') return { error: { fault: 'That projects folder could not be read.', reason: 'It was not a folder path.', wayOut: 'Paste the full path of the folder your project folders sit in.' } };
    const root = String(b.root || '').trim();
    if (root) {
      if (root.length > 260 || /[\u0000-\u001f]/.test(root)) return { error: { fault: 'That projects folder cannot be used.', reason: 'It is not a folder path the office can use.', wayOut: 'Paste the full path of the folder your project folders sit in.' } };
      if (/^(\\\\|\/\/)/.test(root)) return { error: { fault: 'A network folder cannot be the projects folder.', reason: 'The office lists it every few seconds, and a slow network would hold the whole office up.', wayOut: 'Pick a folder on this PC.' } };
      if (!path.isAbsolute(root)) return { error: { fault: 'That projects folder cannot be used.', reason: 'It is not a full path (it should start with a drive, such as C:\\).', wayOut: 'Paste the full path of the folder your project folders sit in.' } };
      if (systemFolder(root)) return { error: { fault: 'That folder cannot be the projects folder.', reason: `${root} is a whole drive or one of Windows' own folders, so every folder in it would show as a project.`, wayOut: 'Pick the folder your project folders sit in.' } };
      let ok = false;
      try { ok = fs.statSync(root).isDirectory(); } catch { ok = false; }
      if (!ok) return { error: { fault: 'That projects folder was not found.', reason: `${root} is not a folder on this PC.`, wayOut: 'Paste the full path of the folder your project folders sit in.' } };
      change.root = root;
    } else change.root = undefined;
  }
  if (b.quietMinutes !== undefined) {
    const m = Math.round(Number(b.quietMinutes));
    if (!(m >= 5 && m <= 1440)) return { error: { fault: 'That gone-home time cannot be used.', reason: 'It must be between 5 minutes and 24 hours (1440 minutes).', wayOut: 'Type a number of minutes from 5 to 1440.' } };
    change.quietMinutes = m;
  }
  try { office.changeSettings(change); } catch (e) {
    return { error: { fault: 'That setting could not be saved.', reason: String(e?.message || 'The office could not write its settings file.'), wayOut: 'Check that nothing holds the office\'s data folder and the disk has room, then try again.' } };
  }
  office.dirty = true;
  return { ok: true, status: status(office) };
}
