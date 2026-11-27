// Setup › Update's guards (src/update.mjs): an origin that names a program, a worktree elsewhere, git found by its full
// path, a git status that fails, an update that stopped half way, the way back, and Restart from an odd folder name.
// Little repositories in a temp folder, as in update.test.mjs: a bare "GitHub", the office's clone, and a maker clone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as update from '../src/update.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-update-guards-'));
const emptyConfig = path.join(tmp, 'empty.gitconfig');
fs.writeFileSync(emptyConfig, '');
process.env.GIT_CONFIG_GLOBAL = emptyConfig;
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.AI_OFFICE_TEST_LOCAL_ORIGIN = '1';
const win = process.platform === 'win32';
const git = (dir, ...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'init.defaultBranch=main', '-c', 'commit.gpgsign=false', ...a], { stdio: 'pipe' }).toString().trim();
const pkg = (v) => `${JSON.stringify({ name: 'ai-office-overview', version: v })}\n`;
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* left in temp */ } });

let n = 0;
/** A bare origin, a clone of it (the office), and one newer commit waiting on origin (already fetched). */
function repos() {
  const d = path.join(tmp, `r${++n}`);
  const hub = path.join(d, 'hub.git'), maker = path.join(d, 'maker'), office = path.join(d, 'office');
  fs.mkdirSync(maker, { recursive: true });
  execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', '--bare', hub]);
  git(maker, 'init', '-q');
  fs.writeFileSync(path.join(maker, 'package.json'), pkg('1.0.0'));
  fs.writeFileSync(path.join(maker, 'a.txt'), 'old a\n');
  git(maker, 'add', '.'); git(maker, 'commit', '-q', '-m', 'one');
  git(maker, 'remote', 'add', 'origin', hub); git(maker, 'push', '-q', 'origin', 'main');
  execFileSync('git', ['clone', '-q', hub, office], { stdio: 'pipe' });
  fs.writeFileSync(path.join(maker, 'package.json'), pkg('1.0.1'));
  fs.writeFileSync(path.join(maker, 'a.txt'), 'new a\n');
  fs.writeFileSync(path.join(maker, 'b.txt'), 'new b\n');
  git(maker, 'add', '.'); git(maker, 'commit', '-q', '-m', 'two'); git(maker, 'push', '-q', 'origin', 'main');
  git(office, 'fetch', '-q', 'origin');
  return { d, hub, maker, office };
}

test('UPD-01: an ext:: origin with protocol.ext.allow is refused before git fetch, and its program is not shown', async () => {
  const { d, office } = repos();
  const ran = path.join(d, 'RAN').replace(/\\/g, '/');
  git(office, 'config', 'protocol.ext.allow', 'always');
  git(office, 'config', 'remote.origin.url', `ext::node -e require('fs').writeFileSync('${ran}','x')`);
  const r = await update.check(office);
  assert.equal(fs.existsSync(ran), false);
  assert.match(r.error?.fault || '', /did not run git/);
  assert.doesNotMatch(JSON.stringify(r), /writeFileSync|node -e/);
});

test('UPD-01: an ext:: address reached through url.*.insteadOf (and protocol.allow=always) is refused too', async () => {
  const { d, office } = repos();
  const ran = path.join(d, 'RAN2').replace(/\\/g, '/');
  git(office, 'config', 'protocol.allow', 'always');
  git(office, 'config', `url.ext::node -e require('fs').writeFileSync('${ran}','x') #.insteadOf`, 'https://example.invalid/');
  git(office, 'config', 'remote.origin.url', 'https://example.invalid/office.git');
  const r = await update.check(office);
  assert.equal(fs.existsSync(ran), false);
  assert.match(r.error?.fault || '', /did not run git/);
});

test('UPD-01: a pushInsteadOf that names a program is refused, and an ssh or http origin is not fetched from', async () => {
  const { office } = repos();
  git(office, 'config', 'url.ext::evil.exe #.pushInsteadOf', path.join(path.dirname(office), 'hub.git'));
  assert.match((await update.check(office)).error?.fault || '', /did not run git/);
  git(office, 'config', '--remove-section', 'url.ext::evil.exe #');
  for (const url of ['git@github.com:someone/office.git', 'http://example.invalid/office.git', 'fd::3']) {
    git(office, 'config', 'remote.origin.url', url);
    const r = await update.check(office);
    assert.ok(r.error, url);
    assert.doesNotMatch(r.error.reason, /fd::3/);
  }
});

test('UPD-01: outside the tests a local origin is refused too (https:// only); without asking, it still shows where', async () => {
  const { office } = repos();
  delete process.env.AI_OFFICE_TEST_LOCAL_ORIGIN;
  try {
    const r = await update.check(office);
    assert.match(r.error?.fault || '', /did not ask GitHub/);
    const quiet = await update.check(office, { fetch: false });
    assert.ok(quiet.ok && quiet.remote === 'hub.git', JSON.stringify(quiet));
  } finally { process.env.AI_OFFICE_TEST_LOCAL_ORIGIN = '1'; }
});

test('UPD-04: a core.worktree setting that points outside the office folder is refused', async () => {
  const { d, office } = repos();
  fs.mkdirSync(path.join(d, 'elsewhere'));
  git(office, 'config', 'core.worktree', path.join(d, 'elsewhere').replace(/\\/g, '/'));
  const r = await update.check(office, { fetch: false });
  assert.match(r.error?.fault || '', /did not run git/);
  assert.match(r.error.reason, /core\.worktree/);
  assert.match((await update.pull(office)).error?.fault || '', /did not run git/);
  assert.deepEqual(fs.readdirSync(path.join(d, 'elsewhere')), []);
});

test('DRIFT-13: git is run by its full path; with none found it says "Git is not installed" (a git in the folder is not run)', () => {
  const { office } = repos();
  const ran = path.join(office, 'fake-git-ran.txt');
  fs.writeFileSync(path.join(office, win ? 'git.cmd' : 'git'), win ? `@echo x> "${ran}"\r\n` : `#!/bin/sh\necho x > "${ran}"\n`, { mode: 0o755 });
  const nowhere = path.join(tmp, 'nowhere');
  fs.mkdirSync(nowhere, { recursive: true });
  const env = { ...process.env, PATH: '.', Path: '.', ProgramW6432: nowhere, ProgramFiles: nowhere, 'ProgramFiles(x86)': nowhere, LOCALAPPDATA: nowhere };
  const code = `const u = await import(${JSON.stringify(pathToFileURL(path.resolve('src/update.mjs')).href)}); console.log(JSON.stringify(await u.check(${JSON.stringify(office)}, { fetch: false })));`;
  const out = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: office, env, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(JSON.parse(out.stdout).error?.fault || '', /Git is not installed/);
  assert.equal(fs.existsSync(ran), false);
});

test('a git status that fails is not taken as "nothing changed": Check and Update refuse plainly', async () => {
  const { office } = repos();
  fs.writeFileSync(path.join(office, '.git', 'index'), 'not an index');
  const r = await update.check(office, { fetch: false });
  assert.match(r.error?.fault || '', /could not see whether files/);
  assert.ok(r.error.wayOut);
  const p = await update.pull(office);
  assert.match(p.error?.fault || '', /could not see whether files/);
  assert.equal(fs.readFileSync(path.join(office, 'a.txt'), 'utf8').replace(/\r\n/g, '\n'), 'old a\n');
});

test('UPD-03: an update stopped half way (no note) is told apart from changes of the person\'s, and its way out works', async () => {
  const { office } = repos();
  // What a merge stopped part way leaves: some files already the newer version, HEAD still the old commit.
  fs.writeFileSync(path.join(office, 'package.json'), git(office, 'show', 'origin/main:package.json') + '\n');
  const r = await update.pull(office);
  assert.match(r.error?.fault || '', /stopped half way/);
  assert.match(r.error.reason, /not changes of yours/);
  const to = git(office, 'rev-parse', 'origin/main');
  assert.ok(r.error.wayOut.includes(`git reset --hard ${to.slice(0, 12)}`), r.error.wayOut);
  // A file of the person's own still counts as theirs.
  fs.writeFileSync(path.join(office, 'a.txt'), 'mine\n');
  assert.match((await update.pull(office)).error?.fault || '', /changed here/);
  // The way out, as it says.
  git(office, 'reset', '-q', '--hard', to.slice(0, 12));
  assert.match((await update.pull(office)).error?.fault || '', /nothing to take/);
});

test('UPD-03: the note left by an interrupted update is found, cleared when git had finished, and kept out of the way otherwise', async () => {
  const { office } = repos();
  const from = git(office, 'rev-parse', 'HEAD'), to = git(office, 'rev-parse', 'origin/main');
  const note = path.join(office, '.git', 'ai-office-update.json');
  fs.writeFileSync(note, JSON.stringify({ from, to, branch: 'main' }));
  fs.writeFileSync(path.join(office, 'a.txt'), 'new a\n');
  fs.writeFileSync(path.join(office, 'package.json'), 'half writ');
  const r = await update.pull(office);
  assert.match(r.error?.fault || '', /stopped half way/);
  assert.match(r.error.reason, /neither the old nor the newer/);
  assert.ok(fs.existsSync(note));
  // Put back as it was: nothing had been written, the note goes and the update goes in.
  git(office, 'checkout', '--', '.');
  const p = await update.pull(office);
  assert.ok(p.ok && p.took === 1, JSON.stringify(p));
  assert.equal(fs.existsSync(note), false);
  // A note left after git had finished (HEAD already at the newer commit) is just cleared.
  fs.writeFileSync(note, JSON.stringify({ from, to, branch: 'main' }));
  assert.match((await update.pull(office)).error?.fault || '', /nothing to take/);
  assert.equal(fs.existsSync(note), false);
});

test('AUD-UP-04: the update says how to go back to the commit it came from, Check says it again, and that way back works', async () => {
  const { office } = repos();
  const from = git(office, 'rev-parse', 'HEAD');
  const p = await update.pull(office);
  assert.ok(p.ok, JSON.stringify(p));
  assert.ok(p.back.includes(`git reset --keep ${from.slice(0, 12)}`), p.back);
  const c = await update.check(office, { fetch: false });
  assert.ok(c.ok && c.back === p.back && !('entries' in c), JSON.stringify(c));
  git(office, 'reset', '-q', '--keep', from.slice(0, 12));
  assert.equal(JSON.parse(fs.readFileSync(path.join(office, 'package.json'), 'utf8')).version, '1.0.0');
});

test('UPD-02: Restart\'s command starts the start file from a folder whose path holds &, ^, % and spaces', { skip: !win && 'Windows only', timeout: 20000 }, async () => {
  const d = path.join(tmp, 'copy a&b ^x %PATH% y');
  fs.mkdirSync(d);
  const marker = path.join(d, 'started.txt');
  fs.writeFileSync(path.join(d, 'Start AI Office Overview.cmd'), '@echo off\r\necho x> "%~dp0started.txt"\r\n');
  const [file, ...args] = update.restartCommand();
  const r = spawnSync(file, args, { cwd: d, windowsVerbatimArguments: true, stdio: 'ignore', windowsHide: true });
  assert.equal(r.status, 0);
  for (let i = 0; i < 60 && !fs.existsSync(marker); i++) await new Promise((res) => setTimeout(res, 200));
  assert.ok(fs.existsSync(marker), 'the start file did not run');
  assert.ok(!update.restartCommand().join(' ').includes(d), 'the folder is never in the command line');
});
