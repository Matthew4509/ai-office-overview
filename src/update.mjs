// Setup › Update: is there a newer office on GitHub, and taking it in one click. GitHub is asked only when the user
// presses Check (one `git fetch` of the office's own repository); nothing about the user is sent. Taking it is a
// fast-forward of this folder to the branch it was cloned from: refused when files here were changed or saved here
// (never overwritten, reset or stashed), and run with hooks off. git is not run at all in a folder whose git settings
// name a program (a filter, hook or similar), so a setting in the folder cannot start one. The office then restarts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';

const REPO = 'https://github.com/Matthew4509/ai-office-overview.git';

// ---- The folder's git settings: refused when one names a program ----
// git fully trusts a repository's own config. `git status` runs a .gitattributes filter's command, and
// include/hooksPath/sshCommand/pager/editor can each name a program. The config is read by git itself
// (`git config --file … --list`), so every way of writing a section is read the way git reads it. Every file git would
// read for this folder is checked: the shared config of a worktree (commondir), config.worktree, and submodules.
const RISKY_SECTION = /^(filter|include|includeif|credential|pager)\./;
const RISKY_NAME = /(command|program|editor|pager|askpass|hookspath|fsmonitor|external|textconv|driver|gitproxy|helper|hook|cmd|uploadpack|receivepack)$/;
const FALSEY = /^(|true|false|yes|no|on|off|0|1)$/i; // core.fsmonitor=true is git's own watcher, not a program
function riskyKey(key, value) {
  const k = key.toLowerCase();
  if (RISKY_SECTION.test(k)) return true;
  const name = k.slice(k.lastIndexOf('.') + 1);
  if (!RISKY_NAME.test(name)) return false;
  return !(name === 'fsmonitor' && FALSEY.test(String(value).trim()));
}

// Every config file git would read for the repository in dir, or null when that cannot be worked out (refused).
const MODULE_SKIP = new Set(['objects', 'refs', 'logs', 'hooks', 'info', 'lfs', 'worktrees']);
function configFiles(dir) {
  const dotgit = path.join(dir, '.git');
  let gitdir;
  try {
    if (fs.statSync(dotgit).isDirectory()) gitdir = dotgit;
    else {
      const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(dotgit, 'utf8'));
      if (!m) return null;
      gitdir = path.resolve(dir, m[1]);
    }
    if (!fs.statSync(gitdir).isDirectory()) return null;
  } catch { return null; }
  let common = gitdir;
  const cd = path.join(gitdir, 'commondir');
  if (fs.existsSync(cd)) {
    try { common = path.resolve(gitdir, fs.readFileSync(cd, 'utf8').trim()); if (!fs.statSync(common).isDirectory()) return null; } catch { return null; }
  }
  const files = new Set([path.join(common, 'config'), path.join(gitdir, 'config'), path.join(common, 'config.worktree'), path.join(gitdir, 'config.worktree')]);
  let over = false;
  const walk = (d, depth) => {
    if (over) return;
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.isFile() && (e.name === 'config' || e.name === 'config.worktree')) files.add(path.join(d, e.name));
      else if (e.isDirectory() && !MODULE_SKIP.has(e.name)) { if (depth >= 12 || files.size > 400) { over = true; return; } walk(path.join(d, e.name), depth + 1); }
    }
  };
  for (const g of new Set([common, gitdir])) walk(path.join(g, 'modules'), 0);
  if (over) return null;
  return [...files].filter((f) => fs.existsSync(f));
}

const CONFIG_ENV = () => ({ ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', LC_ALL: 'C' });
function checkFile(file) {
  return new Promise((resolve) => execFile('git', ['config', '--file', file, '--no-includes', '--list', '-z'], { cwd: os.tmpdir(), encoding: 'utf8', windowsHide: true, timeout: 8000, env: CONFIG_ENV() }, (err, out) => {
    if (err) return resolve(err.code === 'ENOENT' ? null : 'unreadable');
    for (const entry of String(out).split('\0')) {
      if (!entry) continue;
      const nl = entry.indexOf('\n');
      if (riskyKey(nl < 0 ? entry : entry.slice(0, nl), nl < 0 ? '' : entry.slice(nl + 1))) return resolve('program');
    }
    resolve(null);
  }));
}
/** null when git may be run in dir; otherwise 'program' (a setting names a program) or 'unreadable'. */
export async function gitConfigProblem(dir) {
  const files = configFiles(dir);
  if (!files) return 'unreadable';
  for (const f of files) { const v = await checkFile(f); if (v) return v; }
  return null;
}

// ---- Asking and taking ----
// Hooks point at an empty folder, fsmonitor is off, and git never stops to ask for a password.
function noHooks() {
  const d = path.join(os.tmpdir(), 'ai-office-no-hooks');
  try { fs.mkdirSync(d, { recursive: true }); } catch { /* git then finds no hooks there either */ }
  return d;
}
function git(dir, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile('git', ['-c', 'core.fsmonitor=false', '-c', `core.hooksPath=${noHooks()}`, '-c', 'log.showSignature=false', '-C', dir, ...args], {
      timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
    }, (err, stdout, stderr) => resolve({ ok: !err, missing: err?.code === 'ENOENT', out: String(stdout || '').trimEnd(), err: String(stderr || err?.message || '').trim() }));
  });
}
const no = (fault, reason, wayOut) => ({ error: { fault, reason, wayOut } });
const firstLine = (s) => String(s || '').split('\n').find(Boolean)?.slice(0, 200) || '';
const versionIn = (text) => { try { return JSON.parse(text).version || null; } catch { return null; } };

/** Only host and path are shown: a remote address can carry a user name and token (https://user:token@host/…). */
function safeRemote(url) {
  const u = String(url || '').trim();
  const scp = !u.includes('://') && /^[^@\s]+@([^:\s]+):(.+)$/.exec(u);
  if (scp) return `${scp[1]}/${scp[2].replace(/\.git$/, '')}`;
  try { const x = new URL(u); return x.host + x.pathname.replace(/\.git$/, ''); } catch { return path.basename(u); }
}

/** Where this folder stands against the branch it came from, after asking GitHub (fetch: false skips the asking). */
export async function check(dir, { fetch = true } = {}) {
  if (!fs.existsSync(path.join(dir, '.git'))) return no('This copy cannot update itself.', 'It was not downloaded with git (a zip, perhaps), so it has no link to GitHub.', `Download the newest version from GitHub and copy your data folder across, or get it with: git clone ${REPO}`);
  const bad = await gitConfigProblem(dir);
  if (bad) return no('The office did not run git in its own folder.', bad === 'program' ? 'Its git settings name a program (a filter, hook or similar).' : 'Its git settings could not be read safely.', 'Update it by hand: git pull --ff-only in the office\'s folder, after checking .git/config.');
  const branch = await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch.missing) return no('Git is not installed.', 'Updating needs git to ask GitHub for the newest version.', 'Install it (winget install --id Git.Git -e), then press Check again.');
  if (!branch.ok || branch.out === 'HEAD') return no('This copy is not on a branch.', 'It is checked out at one saved point, so there is nothing to bring it up to.', 'In the office\'s folder: git switch main, then press Check again.');
  const remote = await git(dir, ['remote', 'get-url', 'origin']);
  if (!remote.ok) return no('This copy has no GitHub address.', 'Its git has no remote called origin.', `Add it: git remote add origin ${REPO}`);
  if (fetch) {
    const f = await git(dir, ['fetch', '--quiet', '--no-tags', 'origin', branch.out], 60000);
    if (!f.ok) return no('GitHub could not be asked.', firstLine(f.err) || 'No answer.', 'Check this PC is online, then press Check again.');
  }
  const up = `origin/${branch.out}`;
  const [behind, ahead, log, changed, here, there] = await Promise.all([
    git(dir, ['rev-list', '--count', `HEAD..${up}`]),
    git(dir, ['rev-list', '--count', `${up}..HEAD`]),
    git(dir, ['log', '--format=%h%x09%cs%x09%s', '-n', '30', `HEAD..${up}`]),
    git(dir, ['status', '--porcelain', '--untracked-files=no', '--ignore-submodules=all']),
    git(dir, ['rev-parse', '--short', 'HEAD']),
    git(dir, ['show', `${up}:package.json`]),
  ]);
  if (!behind.ok) return no('The newest version could not be compared.', firstLine(behind.err), 'Press Check again; if it stays, run git fetch in the office\'s folder to see why.');
  return {
    ok: true, branch: branch.out, remote: safeRemote(remote.out), at: here.out,
    behind: Number(behind.out) || 0, ahead: Number(ahead.out) || 0,
    changed: changed.out ? changed.out.split('\n').map((l) => l.slice(3)).slice(0, 20) : [],
    newVersion: versionIn(there.out),
    commits: log.out ? log.out.split('\n').map((l) => { const [id, date, ...s] = l.split('\t'); return { id, date, text: s.join('\t') }; }) : [],
  };
}

/** Takes the newer version: a fast-forward only, after the same checks (without asking GitHub again). */
export async function pull(dir) {
  const c = await check(dir, { fetch: false });
  if (c.error) return c;
  if (!c.behind) return no('There is nothing to take.', 'This copy is already the newest version.', 'Nothing to do.');
  if (c.changed.length) return no('Files in the office\'s folder were changed here.', `An update could overwrite them (${c.changed.slice(0, 3).join(', ')}${c.changed.length > 3 ? ', …' : ''}).`, 'Keep or undo those changes yourself, then press Update again. Your data folder is not one of them.');
  if (c.ahead) return no('This copy has its own saved changes.', `It has ${c.ahead} saved change${c.ahead === 1 ? '' : 's'} that GitHub does not, so it cannot simply move forward.`, 'Bring it up to date by hand in the office\'s folder (git pull), or ask whoever made those changes.');
  const m = await git(dir, ['merge', '--ff-only', '--quiet', `origin/${c.branch}`], 60000);
  if (!m.ok) return no('The update did not go in.', firstLine(m.err) || 'git refused it.', 'Nothing was changed. Run git pull --ff-only in the office\'s folder to see why.');
  const now = await git(dir, ['rev-parse', '--short', 'HEAD']);
  return { ok: true, from: c.at, to: now.out, took: c.behind, newVersion: c.newVersion };
}

/**
 * Starts this office again once it has stopped: a small helper waits for this process to end, then starts it the same
 * way. On Windows that is the start file in a new window (the old window closes by itself); AI_OFFICE_OPEN=0 stops a
 * second browser tab, since the page reloads itself in its own.
 */
export function restartAfterExit(dir) {
  const cmd = path.join(dir, 'Start AI Office Overview.cmd');
  const win = process.platform === 'win32' && fs.existsSync(cmd);
  const run = win ? ['cmd.exe', '/c', 'start', '"AI Office Overview"', `"${cmd}"`] : [process.execPath, ...process.argv.slice(1).filter((a) => a !== '--open')];
  const wait = `const pid=+process.argv[1];const go=()=>{try{process.kill(pid,0);setTimeout(go,300)}catch{require('child_process').spawn(process.argv[2],process.argv.slice(3),{detached:true,stdio:'ignore',windowsHide:${win ? 'false' : 'true'},windowsVerbatimArguments:${win},env:{...process.env,AI_OFFICE_OPEN:'0'}}).unref()}};go()`;
  spawn(process.execPath, ['-e', wait, String(process.pid), ...run], { detached: true, stdio: 'ignore', windowsHide: true, cwd: dir }).unref();
}
