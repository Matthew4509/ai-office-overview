// Setup › Update (src/update.mjs) against little repositories in a temp folder: a "GitHub" bare repository, a clone of
// it as the office's folder, and a second clone that adds the newer version.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as update from '../src/update.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-update-'));
const git = (dir, ...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'init.defaultBranch=main', ...a], { stdio: 'pipe' }).toString().trim();
const save = (d, file, text) => { fs.writeFileSync(path.join(d, file), text); git(d, 'add', file); git(d, 'commit', '-q', '-m', `save ${file}`); };
const pkg = (v) => `${JSON.stringify({ name: 'ai-office-overview', version: v })}\n`;

const hub = path.join(tmp, 'hub.git');
execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q', '--bare', hub]);
const maker = path.join(tmp, 'maker');
fs.mkdirSync(maker);
git(maker, 'init', '-q');
save(maker, 'package.json', pkg('0.1.0'));
git(maker, 'remote', 'add', 'origin', hub);
git(maker, 'push', '-q', 'origin', 'main');
const office = path.join(tmp, 'office');
execFileSync('git', ['clone', '-q', hub, office], { stdio: 'pipe' });

test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* left in temp */ } });

test('a folder without git cannot update, and says why', async () => {
  const d = path.join(tmp, 'zip'); fs.mkdirSync(d);
  const r = await update.check(d);
  assert.match(r.error?.fault || '', /cannot update itself/);
  assert.ok(r.error.wayOut);
});

test('freshly cloned: the newest version, nothing to take', async () => {
  const r = await update.check(office);
  assert.ok(r.ok && r.behind === 0 && r.ahead === 0 && r.branch === 'main', JSON.stringify(r));
  const p = await update.pull(office);
  assert.match(p.error?.fault || '', /nothing to take/);
});

test('newer changes on GitHub are counted and listed, a changed file stops the update, data is kept', async () => {
  save(maker, 'package.json', pkg('0.1.1'));
  save(maker, 'b.txt', 'new file');
  git(maker, 'push', '-q', 'origin', 'main');
  const r = await update.check(office);
  assert.ok(r.ok && r.behind === 2 && r.commits.length === 2 && r.newVersion === '0.1.1' && r.commits[0].text === 'save b.txt', JSON.stringify(r));

  fs.writeFileSync(path.join(office, 'package.json'), 'mine\n');
  const refused = await update.pull(office);
  assert.match(refused.error?.fault || '', /changed here/);
  assert.match(refused.error.reason, /package\.json/);
  assert.equal(fs.readFileSync(path.join(office, 'package.json'), 'utf8'), 'mine\n');
  git(office, 'checkout', '--', 'package.json');

  // A file git does not track (like the data folder) does not stop it, and is kept.
  fs.mkdirSync(path.join(office, 'data'));
  fs.writeFileSync(path.join(office, 'data', 'seats.json'), '{"mine":true}');
  const p = await update.pull(office);
  assert.ok(p.ok && p.took === 2 && p.newVersion === '0.1.1', JSON.stringify(p));
  assert.equal(JSON.parse(fs.readFileSync(path.join(office, 'package.json'), 'utf8')).version, '0.1.1');
  assert.equal(fs.readFileSync(path.join(office, 'data', 'seats.json'), 'utf8'), '{"mine":true}');
});

test('a change saved only here: refused (it cannot simply move forward)', async () => {
  save(office, 'c.txt', 'local');
  save(maker, 'd.txt', 'remote');
  git(maker, 'push', '-q', 'origin', 'main');
  const r = await update.check(office);
  assert.ok(r.ok && r.behind === 1 && r.ahead === 1, JSON.stringify(r));
  const p = await update.pull(office);
  assert.match(p.error?.fault || '', /own saved changes/);
});

test('a hook in the folder is not run by the update', async () => {
  const d = path.join(tmp, 'hooked');
  execFileSync('git', ['clone', '-q', hub, d], { stdio: 'pipe' });
  git(d, 'reset', '-q', '--hard', 'HEAD~1');
  const ran = path.join(tmp, 'hook-ran.txt');
  fs.writeFileSync(path.join(d, '.git', 'hooks', 'post-merge'), `#!/bin/sh\necho ran > "${ran.replace(/\\/g, '/')}"\n`, { mode: 0o755 });
  const p = await update.pull(d);
  assert.ok(p.ok, JSON.stringify(p));
  assert.ok(!fs.existsSync(ran));
});

test('a git setting that names a program: git is not run at all', async () => {
  const d = path.join(tmp, 'risky');
  execFileSync('git', ['clone', '-q', hub, d], { stdio: 'pipe' });
  git(d, 'config', 'core.pager', 'evil.exe');
  const r = await update.check(d);
  assert.match(r.error?.fault || '', /did not run git/);
});

test('a file of yours that git ignores is never replaced by one the update brings', async () => {
  const d = path.join(tmp, 'ignored');
  execFileSync('git', ['clone', '-q', hub, d], { stdio: 'pipe' });
  fs.appendFileSync(path.join(d, '.git', 'info', 'exclude'), 'notes.txt\n');
  fs.writeFileSync(path.join(d, 'notes.txt'), 'mine\n');
  save(maker, 'notes.txt', 'theirs\n');
  git(maker, 'push', '-q', 'origin', 'main');
  const r = await update.check(d);
  assert.ok(r.ok && r.behind >= 1 && !r.changed.length, JSON.stringify(r));
  const p = await update.pull(d);
  assert.match(p.error?.fault || '', /did not go in/);
  assert.equal(fs.readFileSync(path.join(d, 'notes.txt'), 'utf8'), 'mine\n');
});

test('while an update is being taken, taking() says so (Restart waits for it), and not after', async () => {
  const d = path.join(tmp, 'busy');
  execFileSync('git', ['clone', '-q', hub, d], { stdio: 'pipe' });
  git(d, 'reset', '-q', '--hard', 'HEAD~1');
  assert.equal(update.taking(), false);
  const p = update.pull(d);
  assert.equal(update.taking(), true);
  assert.ok((await p).ok);
  assert.equal(update.taking(), false);
});
