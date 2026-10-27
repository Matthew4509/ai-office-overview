// Windows: every call the office makes to Windows itself lives here (and in the .ps1 helper beside it). Windows' own
// programs are always run by their full path: a bare name is looked for in the working folder first, so a folder that
// shipped its own cmd.exe would have it run. Nothing here is run on another system: the callers check first.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PS_DIR = path.join(here, 'windows');
const WINDIR = process.env.SystemRoot || 'C:\\Windows';
/** A program in Windows' System32 folder, by its full path. */
export const SYS = (name) => path.join(WINDIR, 'System32', name);
export const CMD = SYS('cmd.exe');
const POWERSHELL = SYS(path.join('WindowsPowerShell', 'v1.0', 'powershell.exe'));
export const isWindows = process.platform === 'win32';

/** Runs one of the .ps1 helpers with fixed arguments and gives back what it printed. A script that hangs is stopped
 * after `timeout` ms (Windows itself answers in well under a second). */
export function powershell(script, args, { timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    const ps = spawn(POWERSHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(PS_DIR, script), ...args], { windowsHide: true });
    let out = '', err = '', done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { try { ps.kill(); } catch { /* already gone */ } finish({ code: -1, out, err: `${script} took over ${timeout / 1000} seconds and was stopped` }); }, timeout);
    ps.stdout.setEncoding('utf8'); ps.stderr.setEncoding('utf8');
    ps.stdout.on('data', (d) => { out += d; });
    ps.stderr.on('data', (d) => { err += d; });
    ps.on('error', (e) => finish({ code: -1, out, err, spawnError: e }));
    ps.on('close', (code) => finish({ code, out, err }));
  });
}
const firstLine = (s) => (s || '').trim().split(/\r?\n/)[0];

/** The three places a shortcut can go, and what each is called on the page. */
export const SHORTCUT_PLACES = { startmenu: 'Start menu shortcut', desktop: 'Desktop shortcut', startup: 'Start with Windows' };

/** A shortcut (status, create or remove) in one of the places above. `folder`: tests only, instead of the real place.
 * The answer is { where, path, exists, here } (here: it points at this office's folder) or { where, error }. */
export async function shortcut(where, action, folder) {
  const args = ['-Where', where, '-Action', action];
  if (folder) { fs.mkdirSync(folder, { recursive: true }); args.push('-Folder', folder); }
  const r = await powershell('shortcut.ps1', args);
  if (r.spawnError) return { where, error: r.spawnError.message };
  try { return JSON.parse(r.out.trim()); } catch { return { where, error: firstLine(r.err) || 'no answer' }; }
}

/** Opens an address in the default browser. */
export function openUrl(url) {
  spawn(CMD, ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
