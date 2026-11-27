// Setup › Update: is there a newer office on GitHub, and taking it in one click. GitHub is asked only when the user
// presses Check (one `git fetch` of the office's own repository, from an https:// address only); nothing about the user
// is sent. Taking it is a fast-forward of this folder to the branch it was cloned from: refused when files here were
// changed or saved here (never overwritten, reset or stashed), and run with hooks off. git is not run at all in a folder
// whose git settings name a program (a filter, hook or similar), so a setting in the folder cannot start one. git itself
// is run by its full path. A note is kept in the folder's .git while the update is written, so one that was stopped
// half way is told apart from changes of the person's; and the commit it came from is kept, so it can be gone back to.
// The office then restarts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';

const REPO = 'https://github.com/Matthew4509/ai-office-overview.git';

// ---- Which git ----
// git is run by its full path, found once: on Windows a bare name is looked for in the working folder first. Only
// folders on the PATH given in full are looked in, then Git for Windows' usual places. Not found: "Git is not installed"
// (and it is looked for again next time, in case it was installed meanwhile).
let GIT_EXE = null;
function gitExe() {
  if (GIT_EXE && fs.existsSync(GIT_EXE)) return GIT_EXE;
  const win = process.platform === 'win32';
  const full = (d) => (win ? /^([a-z]:[\\/]|\\\\)/i.test(d) : d.startsWith('/'));
  const dirs = String(process.env.PATH || '').split(path.delimiter).map((d) => d.trim().replace(/^"(.*)"$/, '$1')).filter((d) => d && full(d));
  if (win) {
    for (const base of [process.env.ProgramW6432, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]) {
      if (base) dirs.push(path.join(base, 'Git', 'cmd'));
    }
  }
  for (const d of dirs) {
    const f = path.join(d, win ? 'git.exe' : 'git');
    try { if (fs.statSync(f).isFile()) return (GIT_EXE = f); } catch { /* not here */ }
  }
  GIT_EXE = null;
  return null;
}

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

// The folder's own git folder (.git, or the one a .git file points at), or null when that cannot be worked out.
function gitDirOf(dir) {
  const dotgit = path.join(dir, '.git');
  try {
    if (fs.statSync(dotgit).isDirectory()) return dotgit;
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(dotgit, 'utf8'));
    if (!m) return null;
    const gitdir = path.resolve(dir, m[1]);
    return fs.statSync(gitdir).isDirectory() ? gitdir : null;
  } catch { return null; }
}

// Every config file git would read for the repository in dir, or null when that cannot be worked out (refused).
const MODULE_SKIP = new Set(['objects', 'refs', 'logs', 'hooks', 'info', 'lfs', 'worktrees']);
function configFiles(dir) {
  const gitdir = gitDirOf(dir);
  if (!gitdir) return null;
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
  const exe = gitExe();
  if (!exe) return Promise.resolve(null); // no git: the first git below says "Git is not installed"
  return new Promise((resolve) => execFile(exe, ['config', '--file', file, '--no-includes', '--list', '-z'], { cwd: os.tmpdir(), encoding: 'utf8', windowsHide: true, timeout: 8000, env: CONFIG_ENV() }, (err, out) => {
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
// The folder is made new, with a name no other user can guess and claim first, and taken away when the office ends.
let NO_HOOKS = '';
function noHooks() {
  if (NO_HOOKS && fs.existsSync(NO_HOOKS)) return NO_HOOKS;
  try {
    NO_HOOKS = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-no-hooks-'));
    process.once('exit', () => { try { fs.rmSync(NO_HOOKS, { recursive: true, force: true }); } catch { /* temp folder */ } });
  } catch {
    // A folder that is not there holds no hooks either.
    NO_HOOKS = path.join(os.tmpdir(), `ai-office-no-hooks-${process.pid}-${Date.now()}-missing`);
  }
  return NO_HOOKS;
}
// The tests fetch from a bare repository in a temp folder; only they set this. Everyone else fetches over https only.
const localOrigin = () => process.env.AI_OFFICE_TEST_LOCAL_ORIGIN === '1';
// Which ways of reaching a remote git may use, whatever the folder's own settings say: GIT_ALLOW_PROTOCOL overrides
// every protocol.*.allow setting, so an ext:: (a program) or fd:: address is never followed.
const allowProtocols = () => (localOrigin() ? 'https:file' : 'https');
function git(dir, args, timeout = 8000, input) {
  const exe = gitExe();
  if (!exe) return Promise.resolve({ ok: false, missing: true, out: '', err: 'git was not found' });
  return new Promise((resolve) => {
    const child = execFile(exe, ['-c', 'core.fsmonitor=false', '-c', `core.hooksPath=${noHooks()}`, '-c', 'log.showSignature=false', '-C', dir, ...args], {
      timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
      // The PC-wide git config is used (Git for Windows keeps its HTTPS certificates and sign-in there); only the
      // administrator can change it, so it is not checked like the folder's own config.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_ALLOW_PROTOCOL: allowProtocols(), LC_ALL: 'C' },
    }, (err, stdout, stderr) => resolve({ ok: !err, missing: err?.code === 'ENOENT', out: String(stdout || '').trimEnd(), err: String(stderr || err?.message || '').trim() }));
    if (input != null) { child.stdin.on('error', () => { /* git ended first */ }); child.stdin.end(input); }
  });
}
const no = (fault, reason, wayOut) => ({ error: { fault, reason, wayOut } });
const firstLine = (s) => String(s || '').split('\n').find(Boolean)?.slice(0, 200) || '';
const versionIn = (text) => { try { return JSON.parse(text).version || null; } catch { return null; } };
const short = (id) => String(id || '').slice(0, 12);
const listed = (files) => `${files.slice(0, 3).join(', ')}${files.length > 3 ? ', …' : ''}`;

/** Only host and path are shown: a remote address can carry a user name and token (https://user:token@host/…). */
function safeRemote(url) {
  const u = String(url || '').trim();
  // An ext:: or other <helper>:: "address" is a command line for a program: never shown as an address.
  if (/^[a-z0-9+.-]+::/i.test(u) || /[\0-\x1f\x7f]/.test(u)) return 'not an address (it names a program)';
  const scp = !u.includes('://') && /^[^@\s]+@([^:\s]+):(.+)$/.exec(u);
  if (scp) return `${scp[1]}/${scp[2].replace(/\.git$/, '')}`;
  if (/^[a-z][a-z0-9+.-]+:\/\//i.test(u)) {
    try {
      const x = new URL(u);
      if (['https:', 'http:', 'ssh:', 'git:', 'file:'].includes(x.protocol)) return x.host + x.pathname.replace(/\.git$/, '');
    } catch { /* not an address */ }
    return 'not an address';
  }
  return path.isAbsolute(u) ? path.basename(u) : 'not an address';
}

// The addresses Check may fetch from: https:// only (and, for the tests, a folder given in full or file://). An ext::
// or fd:: address would have git start a program; ssh, git:// and http:// are not needed to reach GitHub.
const PROGRAM_ADDRESS = /^\s*[a-z0-9+.-]+::/i;
function fetchable(url) {
  const u = String(url || '').trim();
  if (!u || /[\0-\x1f\x7f]/.test(u) || PROGRAM_ADDRESS.test(u)) return false;
  if (/^https:\/\//i.test(u)) { try { return new URL(u).protocol === 'https:'; } catch { return false; } }
  if (!localOrigin()) return false;
  return /^file:\/\//i.test(u) || /^[a-z]:[\\/]/i.test(u) || u.startsWith('/') || u.startsWith('\\\\');
}
// Every address git would use for origin, as git works them out: the setting itself, and with url.*.insteadOf and
// pushInsteadOf applied. null when they are fine to fetch from; otherwise why not.
async function remoteProblem(dir) {
  const [raw, fetchUrl, pushUrls, vcs] = await Promise.all([
    git(dir, ['config', '--get-all', 'remote.origin.url']),
    git(dir, ['ls-remote', '--get-url', 'origin']),
    git(dir, ['remote', 'get-url', '--push', '--all', 'origin']),
    git(dir, ['config', '--get', 'remote.origin.vcs']),
  ]);
  if (!raw.ok || !fetchUrl.ok) return 'unreadable';
  const fetches = [...raw.out.split('\n'), fetchUrl.out].filter((l) => l.trim());
  const pushes = pushUrls.ok ? pushUrls.out.split('\n').filter((l) => l.trim()) : [];
  // remote.origin.vcs has git use a helper program for origin, whatever its address.
  if (vcs.out.trim() || [...fetches, ...pushes].some((u) => PROGRAM_ADDRESS.test(u))) return 'program';
  return fetches.every(fetchable) ? null : 'not-https';
}

// The office's folder must be the folder git writes the files into: a core.worktree setting can point elsewhere.
function sameFolder(a, b) {
  const real = (p) => { try { return fs.realpathSync.native(path.resolve(p)); } catch { return path.resolve(p); } };
  const x = real(a), y = real(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

// `git status --porcelain -z`: each changed file (renamed and copied ones carry the old name too, which is skipped).
function statusEntries(out) {
  const parts = String(out || '').split('\0');
  const list = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (!e) continue;
    list.push({ xy: e.slice(0, 2), file: e.slice(3) });
    if (/[RC]/.test(e[0])) i++;
  }
  return list;
}

// Is every file changed here already the version in commit `to` (or gone, where `to` has none)? Then the changes are
// what an update that stopped half way wrote, not the person's own.
async function onlyTheUpdate(dir, entries, to) {
  if (!entries.length || entries.length > 5000 || entries.some((e) => /[\n\r]/.test(e.file))) return false;
  const tree = await git(dir, ['ls-tree', '-r', '-z', '--full-tree', to], 15000);
  if (!tree.ok) return false;
  const blob = new Map();
  for (const e of tree.out.split('\0')) { const m = /^\d+ blob ([0-9a-f]+)\t([\s\S]+)$/.exec(e); if (m) blob.set(m[2], m[1]); }
  const here = entries.filter((e) => fs.existsSync(path.join(dir, e.file)));
  if (entries.some((e) => !here.includes(e) && blob.has(e.file))) return false;
  if (!here.length) return true;
  const h = await git(dir, ['hash-object', '--stdin-paths'], 30000, `${here.map((e) => e.file).join('\n')}\n`);
  if (!h.ok) return false;
  const ids = h.out.split('\n');
  return here.every((e, i) => blob.get(e.file) === ids[i]?.trim());
}

// ---- The notes kept in the folder's .git ----
// ai-office-update.json: written just before the files are moved forward and taken away once git has finished, so a
// note still there means the update was stopped part way (a signal, a stop, the PC turned off).
// ai-office-update-last.json: the commit the last update came from, so it can be gone back to.
const noteFile = (dir, name) => { const g = gitDirOf(dir); return g ? path.join(g, name) : null; };
const UNDER_WAY = 'ai-office-update.json';
const LAST = 'ai-office-update-last.json';
function readNote(dir, name) {
  const f = noteFile(dir, name);
  try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j && /^[0-9a-f]{40,64}$/.test(j.from) && /^[0-9a-f]{40,64}$/.test(j.to) ? j : null; } catch { return null; }
}
function writeNote(dir, name, value) {
  const f = noteFile(dir, name);
  if (!f) return false;
  try { fs.writeFileSync(f, `${JSON.stringify(value)}\n`); return true; } catch { return false; }
}
function dropNote(dir, name) { const f = noteFile(dir, name); try { if (f) fs.rmSync(f, { force: true }); } catch { /* left behind: read again next time */ } }
const goBackText = (from) => `If the newer version does not start, go back in the office's folder with: git reset --keep ${short(from)}, then start the office again.`;

// An update that was stopped while it wrote the newer files. The way out finishes it: every file is put at the newer
// version. (git merge --ff-only and git reset --keep both refuse while those half-written files are there.)
function halfWay(to, files, mixed) {
  return no('An earlier update stopped half way.',
    mixed
      ? `It was stopped while it wrote the newer files, and some files here (${listed(files)}) are neither the old nor the newer version.`
      : `It was stopped while it wrote the newer files, so some (${listed(files)}) are already the newer version. They are not changes of yours.`,
    mixed
      ? `Keep a copy of any of those files you changed yourself, then finish it in the office's folder: git reset --hard ${short(to)} (your data folder is not touched). Then restart the office.`
      : `Finish it in the office's folder: git reset --hard ${short(to)} (it puts every file at the newer version; your data folder is not touched). Then restart the office.`);
}

/** Where this folder stands against the branch it came from, after asking GitHub (fetch: false skips the asking). */
export async function check(dir, opts) {
  const r = await look(dir, opts);
  delete r.entries;
  return r;
}

async function look(dir, { fetch = true } = {}) {
  if (!fs.existsSync(path.join(dir, '.git'))) return no('This copy cannot update itself.', fs.existsSync(path.join(dir, 'node', 'node.exe')) ? 'It was put here by the installer, which has no link to GitHub.' : 'It was not downloaded with git (a zip, perhaps), so it has no link to GitHub.', fs.existsSync(path.join(dir, 'node', 'node.exe')) ? 'Download the newest installer from https://github.com/Matthew4509/ai-office-overview/releases and run it: your data folder is kept.' : `Download the newest version from GitHub and copy your data folder across, or get it with: git clone ${REPO}`);
  const bad = await gitConfigProblem(dir);
  if (bad) return no('The office did not run git in its own folder.', bad === 'program' ? 'Its git settings name a program (a filter, hook or similar).' : 'Its git settings could not be read safely.', 'Update it by hand: git pull --ff-only in the office\'s folder, after checking .git/config.');
  const top = await git(dir, ['rev-parse', '--show-toplevel']);
  if (top.missing) return no('Git is not installed.', 'Updating needs git to ask GitHub for the newest version.', 'Install it (winget install --id Git.Git -e), then press Check again.');
  if (!top.ok || !sameFolder(top.out, dir)) return no('The office did not run git in its own folder.', 'Its git settings put the files somewhere other than the office\'s folder (core.worktree).', 'Update it by hand: git pull --ff-only in the office\'s folder, after checking .git/config.');
  const branch = await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch.ok || branch.out === 'HEAD') return no('This copy is not on a branch.', 'It is checked out at one saved point, so there is nothing to bring it up to.', 'In the office\'s folder: git switch main, then press Check again.');
  const remote = await git(dir, ['remote', 'get-url', 'origin']);
  if (!remote.ok) return no('This copy has no GitHub address.', 'Its git has no remote called origin.', `Add it: git remote add origin ${REPO}`);
  if (fetch) {
    // Checked before git fetch runs: the address origin really leads to, once the folder's own settings are applied.
    const r = await remoteProblem(dir);
    if (r === 'program' || r === 'unreadable') return no('The office did not run git in its own folder.', r === 'program' ? 'Its GitHub address (origin) is not an address: it would have git start a program.' : 'Its GitHub address (origin) could not be read safely.', `Set it in the office's folder: git remote set-url origin ${REPO}, after checking .git/config.`);
    if (r) return no('The office did not ask GitHub.', `Its GitHub address (origin) is not an https:// address (it is ${safeRemote(remote.out)}).`, `Set it in the office's folder: git remote set-url origin ${REPO}, then press Check again.`);
    const only = localOrigin() ? ['-c', 'protocol.file.allow=always'] : [];
    const f = await git(dir, ['-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'protocol.ext.allow=never', '-c', 'protocol.fd.allow=never', ...only, 'fetch', '--quiet', '--no-tags', 'origin', branch.out], 60000);
    if (!f.ok) return no('GitHub could not be asked.', firstLine(f.err) || 'No answer.', 'Check this PC is online, then press Check again.');
  }
  const up = `origin/${branch.out}`;
  const [behind, ahead, log, changed, here, there] = await Promise.all([
    git(dir, ['rev-list', '--count', `HEAD..${up}`]),
    git(dir, ['rev-list', '--count', `${up}..HEAD`]),
    git(dir, ['log', '--format=%h%x09%cs%x09%s', '-n', '30', `HEAD..${up}`]),
    git(dir, ['status', '--porcelain', '-z', '--untracked-files=no', '--ignore-submodules=all']),
    git(dir, ['rev-parse', '--short', 'HEAD']),
    git(dir, ['show', `${up}:package.json`]),
  ]);
  if (!behind.ok) return no('The newest version could not be compared.', firstLine(behind.err), 'Press Check again; if it stays, run git fetch in the office\'s folder to see why.');
  // A status that failed says nothing about the files: it never counts as "nothing changed".
  if (!changed.ok) return no('The office could not see whether files in its folder were changed.', firstLine(changed.err) || 'git status gave no answer.', 'Press Check again; if it stays, run git status in the office\'s folder to see why.');
  const entries = statusEntries(changed.out);
  const last = readNote(dir, LAST);
  return {
    ok: true, branch: branch.out, remote: safeRemote(remote.out), at: here.out,
    behind: Number(behind.out) || 0, ahead: Number(ahead.out) || 0,
    changed: entries.map((e) => e.file).slice(0, 20), entries,
    newVersion: versionIn(there.out),
    commits: log.out ? log.out.split('\n').map((l) => { const [id, date, ...s] = l.split('\t'); return { id, date, text: s.join('\t') }; }) : [],
    ...(last ? { back: goBackText(last.from), lastFrom: short(last.from) } : {}),
  };
}

/** Updates being taken just now: Restart waits while one moves the office's folder (it could stop half way). */
let pulling = 0;
export const taking = () => pulling > 0;

/** Takes the newer version: a fast-forward only, after the same checks (without asking GitHub again). */
export async function pull(dir) {
  pulling++;
  try { return await pullNow(dir); } finally { pulling--; }
}

async function pullNow(dir) {
  const c = await look(dir, { fetch: false });
  if (c.error) return c;
  const { entries } = c;
  const [headR, upR] = await Promise.all([git(dir, ['rev-parse', 'HEAD']), git(dir, ['rev-parse', `origin/${c.branch}`])]);
  if (!headR.ok || !upR.ok) return no('The newest version could not be compared.', firstLine(headR.err || upR.err), 'Press Check again; if it stays, run git fetch in the office\'s folder to see why.');
  const head = headR.out.trim(), to = upR.out.trim();
  // A note from an update that was stopped part way.
  const under = readNote(dir, UNDER_WAY);
  if (under) {
    if (head === under.to) { writeNote(dir, LAST, { from: under.from, to: under.to }); dropNote(dir, UNDER_WAY); } // git had finished
    else if (head === under.from && entries.length) return halfWay(under.to, c.changed, !(await onlyTheUpdate(dir, entries, under.to)));
    else dropNote(dir, UNDER_WAY); // nothing was written, or the folder has moved on since
  }
  if (!c.behind) return no('There is nothing to take.', 'This copy is already the newest version.', 'Nothing to do.');
  if (c.changed.length) {
    // Files that are already exactly the newer version were written by an update, not changed by the person.
    if (!c.ahead && await onlyTheUpdate(dir, entries, to)) return halfWay(to, c.changed, false);
    return no('Files in the office\'s folder were changed here.', `An update could overwrite them (${listed(c.changed)}).`, 'Keep or undo those changes yourself, then press Update again. Your data folder is not one of them.');
  }
  if (c.ahead) return no('This copy has its own saved changes.', `It has ${c.ahead} saved change${c.ahead === 1 ? '' : 's'} that GitHub does not, so it cannot simply move forward.`, 'Bring it up to date by hand in the office\'s folder (git pull), or ask whoever made those changes.');
  writeNote(dir, UNDER_WAY, { from: head, to, branch: c.branch });
  // --no-overwrite-ignore: a file of yours that git ignores is never replaced by one the update brings; the merge stops.
  const m = await git(dir, ['merge', '--ff-only', '--no-overwrite-ignore', '--quiet', to], 60000);
  if (!m.ok) {
    // git refuses before it writes anything; only a merge stopped part way (it ran too long) leaves files behind.
    const [h, st] = await Promise.all([git(dir, ['rev-parse', 'HEAD']), git(dir, ['status', '--porcelain', '-z', '--untracked-files=no', '--ignore-submodules=all'])]);
    const nowAt = h.ok ? h.out.trim() : '';
    if (nowAt === head && st.ok && !st.out) {
      dropNote(dir, UNDER_WAY);
      return no('The update did not go in.', firstLine(m.err) || 'git refused it.', 'Nothing was changed. Run git pull --ff-only in the office\'s folder to see why.');
    }
    if (nowAt !== to) {
      const left = st.ok ? statusEntries(st.out) : [];
      return halfWay(to, left.map((e) => e.file), !st.ok || !(await onlyTheUpdate(dir, left, to)));
    }
    // HEAD is at the newer version: git had finished all the same.
  }
  writeNote(dir, LAST, { from: head, to });
  dropNote(dir, UNDER_WAY);
  const now = await git(dir, ['rev-parse', '--short', 'HEAD']);
  return { ok: true, from: c.at, to: now.out, took: c.behind, newVersion: c.newVersion, back: goBackText(head) };
}

/**
 * What restartAfterExit runs on Windows, in the office's folder: cmd.exe starts the start file in a new window. The
 * folder's path is never written into a command line (it is the working folder instead), so a path holding &, ^, % or
 * spaces cannot be read by cmd.exe as part of a command. /s keeps the start file's own quotes; /d skips AutoRun.
 */
export function restartCommand() {
  const CMD = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
  return [CMD, '/d', '/c', 'start', '"AI Office Overview"', `"${CMD}"`, '/d', '/s', '/c', '"".\\Start AI Office Overview.cmd""'];
}

/**
 * Starts this office again once it has stopped: a small helper waits for this process to end, then starts it the same
 * way. On Windows that is the start file in a new window (the old window closes by itself); AI_OFFICE_OPEN=0 stops a
 * second browser tab, since the page reloads itself in its own. Nothing here can tell whether the newer version
 * started: the update's answer (`back`) and Check (after it) say how to go back to the commit it came from.
 */
export function restartAfterExit(dir) {
  const cmd = path.join(dir, 'Start AI Office Overview.cmd');
  const win = process.platform === 'win32' && fs.existsSync(cmd);
  // `start` alone would run the start file with cmd /K, which leaves the window open at a prompt after the office stops.
  // cmd.exe by its full path: a bare name is looked for in the working folder first.
  const run = win ? restartCommand() : [process.execPath, ...process.argv.slice(1).filter((a) => a !== '--open')];
  const wait = `const pid=+process.argv[1];const go=()=>{try{process.kill(pid,0);setTimeout(go,300)}catch{require('child_process').spawn(process.argv[2],process.argv.slice(3),{detached:true,stdio:'ignore',windowsHide:${win ? 'false' : 'true'},windowsVerbatimArguments:${win},env:{...process.env,AI_OFFICE_OPEN:'0'}}).unref()}};go()`;
  // The helper runs in the office's folder, and what it starts runs there too (the start file is found there).
  spawn(process.execPath, ['-e', wait, String(process.pid), ...run], { detached: true, stdio: 'ignore', windowsHide: true, cwd: dir }).unref();
}
