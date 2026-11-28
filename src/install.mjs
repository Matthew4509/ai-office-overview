// Setup and uninstall, in one place for install.cmd / uninstall.cmd (through tools/setup.mjs) and Setup › Setup and
// About in the office. Three shortcuts, each for this Windows user only: the Start menu, the desktop, and Start with
// Windows. Nothing here deletes the office's folder or its data: uninstall says where they are, and the person removes
// the folder themselves. Uninstall also takes advanced setup's hooks out of the AI app's settings (a copy of that file
// is kept first), so nothing calls this folder's hook.mjs once the folder is gone. Several copies of the office can be
// on one PC (a clone, a zip copy, the installed one), with the same shortcut names and the same hook mark: uninstall
// takes only what starts or runs THIS folder, and leaves another copy's shortcuts and hooks alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as win from './windows.mjs';
import * as setup from './setup.mjs';
import { swapIn } from './files.mjs';

/** The office's folder (the one holding server.mjs). */
export const HERE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const NODE_MIN = 20;
const nodeMajor = () => Number(process.versions.node.split('.')[0]);
export const PLACES = ['startmenu', 'desktop', 'startup'];
export const NAMES = { ...win.SHORTCUT_PLACES, hooks: 'Advanced setup hooks' };

// AI_OFFICE_SHORTCUT_DIR: tests use a temp folder instead of the real Start menu, desktop and Startup folders.
const testDir = (where) => (process.env.AI_OFFICE_SHORTCUT_DIR ? path.join(process.env.AI_OFFICE_SHORTCUT_DIR, where) : '');
function shortcut(where, action) {
  if (!win.isWindows) return Promise.resolve({ where, exists: false, unsupported: 'shortcuts are made on Windows only' });
  return win.shortcut(where, action, testDir(where));
}

/** Where everything stands: the folder, Node.js, and each shortcut ({ where, path, exists, here } or { where, error }). */
export async function status() {
  const out = {
    folder: HERE, system: win.isWindows ? 'Windows' : process.platform,
    node: { version: process.versions.node, min: NODE_MIN, ok: nodeMajor() >= NODE_MIN },
    bundledNode: fs.existsSync(path.join(HERE, 'node', 'node.exe')),
  };
  for (const where of PLACES) out[where] = await shortcut(where, 'status');
  return out;
}

/** want: { startmenu, desktop, startup } as true (set up) / false (take away) / undefined (leave as it is). */
export async function apply(want) {
  const results = [];
  for (const where of PLACES) if (want[where] !== undefined) results.push(await shortcut(where, want[where] ? 'create' : 'remove'));
  return { results, errors: results.filter((r) => r.error).map((r) => `${NAMES[r.where]}: ${r.error}`) };
}

// Every mark this office has written into the AI app's settings: today's, and the one from before the rename in 0.1.7.
const HOOK_MARKS = ['--ai-office-overview-hook', '--claude-office-hook'];
/** A folder or file path in one spelling for comparing: forward slashes, no trailing slash, lower case (Windows paths
 * are not case-sensitive). */
export const samePath = (p) => path.resolve(String(p).replace(/\//g, path.sep)).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
/** The hook.mjs a hook command runs ('' when it names none): the quoted one, or a bare one without spaces. */
export function hookScriptOf(command) {
  const m = /"([^"]*hook\.mjs)"/i.exec(command) || /(?:^|\s)([^\s"]*hook\.mjs)(?=\s|$)/i.exec(command);
  return m ? m[1] : '';
}
/** One of this office's hooks that runs THIS folder's hook.mjs. Every copy of the office (a clone, a zip copy, the
 * installed one) writes the same mark, so the mark alone does not say whose it is: another copy's hooks are its own. */
export function isThisFoldersHook(h, folder = HERE) {
  if (typeof h?.command !== 'string') return false;
  if (!h.command.split(/\s+/).some((word) => HOOK_MARKS.includes(word))) return false;
  const script = hookScriptOf(h.command);
  return !!script && samePath(script) === samePath(path.join(folder, 'hook.mjs'));
}
/** The AI app's settings without this folder's hooks (and any group or event left empty by that); everything else,
 * other copies' hooks included, exactly as it was. `count` says how many went. */
export function withoutThisFolders(data, folder = HERE) {
  const out = { ...data };
  let count = 0;
  if (!out.hooks || typeof out.hooks !== 'object' || Array.isArray(out.hooks)) return { data: out, count };
  const hooks = {};
  for (const [event, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) { hooks[event] = groups; continue; }
    const kept = [];
    for (const g of groups) {
      if (!Array.isArray(g?.hooks)) { kept.push(g); continue; }
      const left = g.hooks.filter((h) => !isThisFoldersHook(h, folder));
      count += g.hooks.length - left.length;
      if (left.length === g.hooks.length) kept.push(g);
      else if (left.length) kept.push({ ...g, hooks: left });
    }
    if (kept.length) hooks[event] = kept;
  }
  if (Object.keys(hooks).length) out.hooks = hooks;
  else delete out.hooks;
  return { data: out, count };
}

/** Advanced setup's hooks out of the AI app's settings: only this folder's own entries go (both marks it has ever
 * written; another copy's are left), and a copy of the file is kept beside it first. */
export function removeHooks() {
  const where = 'hooks';
  const file = setup.settingsFile();
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return { where, none: true };
    return { where, error: `${file} could not be read (${e.code || e.message}), so it was not changed: remove the lines holding --ai-office-overview-hook yourself` };
  }
  if (!/--(ai-office-overview|claude-office)-hook\b/.test(text)) return { where, none: true };
  // Read as advanced setup reads it, so a long number (an id, say) is written back with its own digits.
  const read = setup.readSettings(file);
  if (read.error) return { where, error: `${file}: ${read.error.reason} Remove the lines holding --ai-office-overview-hook yourself.` };
  const { data: next, count } = withoutThisFolders(read.data);
  // Hooks with the mark are there, but none run this folder's hook.mjs: they belong to another copy of the office.
  if (!count) return { where, none: true, others: true };
  try {
    const backup = `${file}.before-ai-office-overview-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.writeFileSync(backup, text);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, setup.textOf(next, read.big));
    swapIn(tmp, file);
    const others = /--(ai-office-overview|claude-office)-hook\b/.test(JSON.stringify(next));
    return { where, removed: true, backup, ...(others ? { others: true } : {}) };
  } catch (e) { return { where, error: e.message }; }
}

/** Every shortcut away, and the hooks out. The folder and its data stay. */
export async function uninstall() {
  const r = await apply({ startmenu: false, desktop: false, startup: false });
  const h = removeHooks();
  r.results.push(h);
  if (h.error) r.errors.push(`${NAMES.hooks}: ${h.error}`);
  return r;
}
