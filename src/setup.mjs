// Setup: easy (read the transcripts only, the default) or advanced (three small hooks in the AI app's own settings, so
// the app tells the office straight away when a thread gets a message, waits for you, or finishes). Advanced setup only
// adds its own entries beside whatever hooks are there already, saves a copy of the file first, and can be taken off
// again. Also the office's own settings: the projects folder and the gone-home time.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The hook events advanced setup adds, and what each tells the office. */
export const EVENTS = ['UserPromptSubmit', 'Notification', 'Stop'];
/** Every command this office writes contains this, so it can find (and remove) its own entries and no others. */
const MARK = 'ai-office-overview-hook';

export function settingsFile() {
  return process.env.AI_OFFICE_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
}

function readSettings(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return { data: {}, text: '' };
    throw e;
  }
  try { return { data: JSON.parse(text || '{}'), text }; } catch {
    return { error: { fault: 'Claude\'s settings file could not be read.', reason: `${file} is not valid JSON, so the office will not touch it.`, wayOut: 'Fix the file (or let Claude fix it), then try again.' } };
  }
}

/** The command written into the AI app's settings for this office. */
export function hookCommand(hookScript, port) {
  return `node "${hookScript.replace(/\\/g, '/')}" ${port} --${MARK}`;
}

/** Ours: this mark, or a hook an earlier version wrote (it runs a hook.mjs with a port and its own --…-hook mark). */
const OLDER = /hook\.mjs" \d+ --[a-z-]+-hook$/;
const isOurs = (h) => typeof h?.command === 'string' && (h.command.includes(MARK) || OLDER.test(h.command));

/** The AI app's settings without this office's entries (everything else exactly as it was). */
export function withoutOurs(data) {
  const out = { ...data };
  if (!out.hooks || typeof out.hooks !== 'object') return out;
  const hooks = {};
  for (const [event, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) { hooks[event] = groups; continue; }
    const kept = groups.map((g) => (Array.isArray(g?.hooks) ? { ...g, hooks: g.hooks.filter((h) => !isOurs(h)) } : g)).filter((g) => !Array.isArray(g?.hooks) || g.hooks.length);
    if (kept.length) hooks[event] = kept;
  }
  if (Object.keys(hooks).length) out.hooks = hooks;
  else delete out.hooks;
  return out;
}

/** The AI app's settings with this office's entries added (its old ones replaced, nobody else's touched). */
export function withOurs(data, command) {
  const out = withoutOurs(data);
  out.hooks = { ...(out.hooks || {}) };
  for (const event of EVENTS) {
    const groups = Array.isArray(out.hooks[event]) ? out.hooks[event] : [];
    out.hooks[event] = [...groups, { hooks: [{ type: 'command', command, timeout: 3 }] }];
  }
  return out;
}

/** Whether advanced setup is on, from the AI app's settings file. */
export function status(office) {
  const file = settingsFile();
  const r = readSettings(file);
  const on = !r.error && Object.values(r.data.hooks || {}).some((groups) => Array.isArray(groups) && groups.some((g) => Array.isArray(g?.hooks) && g.hooks.some(isOurs)));
  return {
    mode: on ? 'advanced' : 'easy',
    settingsFile: file,
    readable: !r.error,
    lastHookAt: office.lastHookAt || 0,
    root: office.root(),
    rootSet: !!office.settings.root,
    quietMinutes: office.settings.quietMinutes,
  };
}

/** Turns advanced setup on or off: { advanced: true | false }. A copy of the settings file is kept first. */
export function apply(office, b, { port, hookScript }) {
  const file = settingsFile();
  const r = readSettings(file);
  if (r.error) return r;
  const next = b.advanced ? withOurs(r.data, hookCommand(hookScript, port)) : withoutOurs(r.data);
  const text = `${JSON.stringify(next, null, 2)}\n`;
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
    fs.renameSync(tmp, file);
    return { ok: true, backup, status: status(office) };
  } catch (e) {
    return { error: { fault: 'Claude\'s settings could not be changed.', reason: String(e?.message || e), wayOut: 'Check the file is not open elsewhere and that this user can write to it, then try again. Easy setup still works.' } };
  }
}

/** A hook event from hook.mjs: what it says about the thread. */
export function onHook(office, b) {
  const id = String(b.session || '').replace(/[^\w-]/g, '').slice(0, 80);
  if (!id) return;
  office.lastHookAt = office.now();
  const event = String(b.event || '');
  if (event === 'UserPromptSubmit') office.hook(id, 'working', 'Reading your message');
  else if (event === 'Stop') office.hook(id, 'done');
  // A permission prompt needs you. "Waiting for your input" comes a minute after every finished reply, asked or not:
  // the reply itself says whether it asked something, so it counts as finished.
  else if (event === 'Notification') office.hook(id, /permission/i.test(b.message) ? 'needs' : 'done', /permission/i.test(b.message) ? 'Waiting for your permission' : '');
}

/** The office's own settings: { root, quietMinutes }. */
export function settings(office, b) {
  if (b.root !== undefined) {
    const root = String(b.root || '').trim();
    if (root) {
      let ok = false;
      try { ok = fs.statSync(root).isDirectory(); } catch { ok = false; }
      if (!ok) return { error: { fault: 'That projects folder was not found.', reason: `${root} is not a folder on this PC.`, wayOut: 'Paste the full path of the folder your project folders sit in.' } };
      office.settings.root = root;
    } else delete office.settings.root;
  }
  if (b.quietMinutes !== undefined) {
    const m = Math.round(Number(b.quietMinutes));
    if (!(m >= 5 && m <= 1440)) return { error: { fault: 'That gone-home time cannot be used.', reason: 'It must be between 5 minutes and 24 hours (1440 minutes).', wayOut: 'Type a number of minutes from 5 to 1440.' } };
    office.settings.quietMinutes = m;
  }
  office.saveSettings();
  office.dirty = true;
  return { ok: true, status: status(office) };
}
