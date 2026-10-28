// Setup and uninstall, in one place for install.cmd / uninstall.cmd (through tools/setup.mjs) and Setup › Setup and
// About in the office. Three shortcuts, each for this Windows user only: the Start menu, the desktop, and Start with
// Windows. Nothing here deletes the office's folder or its data: uninstall says where they are, and the person removes
// the folder themselves. Uninstall also takes advanced setup's hooks out of the AI app's settings (a copy of that file
// is kept first), so nothing calls this folder's hook.mjs once the folder is gone.

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

/** Advanced setup's hooks out of the AI app's settings: only this office's own entries go (both marks it has ever
 * written), and a copy of the file is kept beside it first. */
export function removeHooks() {
  const where = 'hooks';
  const file = setup.settingsFile();
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return { where, none: true };
    return { where, error: `${file} could not be read (${e.code || e.message}), so it was not changed: remove the lines holding --ai-office-overview-hook yourself` };
  }
  if (!/--(ai-office-overview|claude-office)-hook\b/.test(text)) return { where, none: true };
  let data;
  try { data = JSON.parse(text.replace(/^﻿/, '')); } catch { return { where, error: `${file} is not valid JSON, so it was not changed: remove the lines holding --ai-office-overview-hook yourself` }; }
  try {
    const backup = `${file}.before-ai-office-overview-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.writeFileSync(backup, text);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(setup.withoutOurs(data), null, 2)}\n`);
    swapIn(tmp, file);
    return { where, removed: true, backup };
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
