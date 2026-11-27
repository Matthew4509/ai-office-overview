// Guards around install and uninstall, the .cmd files, the installer build and the Auto theme's sun:
// - uninstall takes only THIS folder's hooks and shortcuts, never another copy's (a clone, a zip copy, the installed one);
// - a shortcut starts a folder whose name holds %PATH%, & or ^;
// - install.cmd and uninstall.cmd end with a failure code after a failure;
// - build.cmd never ships node.exe without Node.js's licence; the installer empties its program folders and refuses a
//   folder with $, %, a backtick or "; the drift checker finds Head Office from the clone;
// - the sun is reckoned near the right latitude for southern-hemisphere zones.
// Everything happens in temp folders: no real shortcut, settings file or Start menu is touched.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempHome } from './helpers.mjs';
import * as install from '../src/install.mjs';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const onWindows = process.platform === 'win32';
const SYS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
const CMD = path.join(SYS, 'cmd.exe');
const PS = path.join(SYS, 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const START = 'Start AI Office Overview.cmd';
const OUR_HOOK = path.join(install.HERE, 'hook.mjs').replace(/\\/g, '/');
const hook = (command) => ({ hooks: [{ type: 'command', command, timeout: 3 }] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tmp(name = 'x') {
  const d = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-guards-')), name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ---- Hooks: only this folder's ----

test('hookScriptOf: the hook.mjs a command runs, quoted or bare, with the plain or the bundled Node.js', () => {
  assert.equal(install.hookScriptOf('node "C:/a b/hook.mjs" 8860 --ai-office-overview-hook'), 'C:/a b/hook.mjs');
  assert.equal(install.hookScriptOf('"C:/a b/node/node.exe" "C:/a b/hook.mjs" 8860 --ai-office-overview-hook'), 'C:/a b/hook.mjs');
  assert.equal(install.hookScriptOf('node C:/ab/hook.mjs 8860 --claude-office-hook'), 'C:/ab/hook.mjs');
  assert.equal(install.hookScriptOf('node --ai-office-overview-hook'), '');
});

test('isThisFoldersHook: this folder in any spelling (slashes, case) counts; another folder, another mark or no path does not', () => {
  const here = install.HERE;
  const back = path.join(here, 'hook.mjs');
  assert.equal(install.isThisFoldersHook({ command: `node "${OUR_HOOK}" 8860 --ai-office-overview-hook` }), true);
  assert.equal(install.isThisFoldersHook({ command: `node "${back}" 8860 --ai-office-overview-hook` }), true);
  assert.equal(install.isThisFoldersHook({ command: `node "${OUR_HOOK.toUpperCase()}" 8860 --claude-office-hook` }), onWindows, 'case does not matter on Windows');
  assert.equal(install.isThisFoldersHook({ command: 'node "C:/Somewhere/else/ai office overview/hook.mjs" 8860 --ai-office-overview-hook' }), false);
  assert.equal(install.isThisFoldersHook({ command: 'node "C:/Somewhere/else/claude office/hook.mjs" 8860 --claude-office-hook' }), false, 'the old mark alone is not enough');
  assert.equal(install.isThisFoldersHook({ command: `node "${OUR_HOOK}" 8880 --ai-head-office-hook` }), false, 'another program\'s mark');
  assert.equal(install.isThisFoldersHook({ command: '--ai-office-overview-hook' }), false, 'no hook.mjs at all');
  assert.equal(install.isThisFoldersHook({}), false);
});

test('removeHooks: another copy\'s hooks (either mark) stay; only this folder\'s go, and a file with only another copy\'s is not rewritten', () => {
  const h = tempHome();
  const settings = path.join(h.dir, 'settings.json');
  process.env.AI_OFFICE_SETTINGS = settings;
  try {
    const other = 'node "C:/Somewhere/else/ai office overview/hook.mjs" 8860 --ai-office-overview-hook';
    const otherOld = '"C:/Users/x/AppData/Local/Programs/AI Office Overview/node/node.exe" "C:/Users/x/AppData/Local/Programs/AI Office Overview/hook.mjs" 8860 --claude-office-hook';
    const ours = `node "${OUR_HOOK.replace(/\//g, '\\')}" 8860 --ai-office-overview-hook`;
    const beep = { hooks: [{ type: 'command', command: '[console]::beep(659,90)', shell: 'powershell' }] };
    // Only another copy's: nothing changes, and no backup is made.
    const onlyOthers = { hooks: { Stop: [hook(other), hook(otherOld)] } };
    fs.writeFileSync(settings, JSON.stringify(onlyOthers, null, 2));
    const before = fs.readFileSync(settings, 'utf8');
    let r = install.removeHooks();
    assert.equal(r.none, true);
    assert.equal(r.others, true);
    assert.equal(fs.readFileSync(settings, 'utf8'), before);
    assert.deepEqual(fs.readdirSync(h.dir).filter((f) => f.includes('.before-')), []);
    // Ours beside theirs, in one group and in groups of their own.
    fs.writeFileSync(settings, JSON.stringify({ model: 'opus', hooks: {
      Stop: [beep, hook(other), hook(ours)],
      Notification: [{ hooks: [{ type: 'command', command: ours }, { type: 'command', command: otherOld }] }],
      UserPromptSubmit: [hook(ours)],
    } }, null, 2));
    r = install.removeHooks();
    assert.equal(r.removed, true);
    assert.equal(r.others, true, 'it says another copy\'s were left');
    assert.ok(fs.existsSync(r.backup));
    const now = JSON.parse(fs.readFileSync(settings, 'utf8'));
    assert.equal(now.model, 'opus');
    assert.deepEqual(now.hooks.Stop, [beep, hook(other)]);
    assert.deepEqual(now.hooks.Notification, [{ hooks: [{ type: 'command', command: otherOld }] }]);
    assert.equal(now.hooks.UserPromptSubmit, undefined, 'an event left empty goes');
  } finally { delete process.env.AI_OFFICE_SETTINGS; h.done(); }
});

// ---- Shortcuts: only this folder's ----

/** A made-up office folder with the real shortcut.ps1 and a start file that writes started.txt (with its argument). */
function fakeOffice(dir) {
  fs.mkdirSync(path.join(dir, 'src', 'windows'), { recursive: true });
  fs.copyFileSync(path.join(APP, 'src', 'windows', 'shortcut.ps1'), path.join(dir, 'src', 'windows', 'shortcut.ps1'));
  fs.writeFileSync(path.join(dir, START), '@echo off\r\necho %1> "%~dp0started.txt"\r\n');
  return dir;
}
function shortcut(office, action, folder, where = 'startmenu') {
  const out = spawnSync(PS, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(office, 'src', 'windows', 'shortcut.ps1'), '-Where', where, '-Action', action, '-Folder', folder], { encoding: 'utf8' });
  try { return JSON.parse(out.stdout.trim()); } catch { return { error: out.stderr.trim() || 'no answer' }; }
}

test('shortcuts: one copy\'s setup and uninstall leave another copy\'s shortcut of the same name alone (Windows)', { skip: !onWindows && 'Windows only', timeout: 120000 }, () => {
  const root = tmp('copies');
  const a = fakeOffice(path.join(root, 'copy a'));
  const b = fakeOffice(path.join(root, 'copy b'));
  const sc = path.join(root, 'sc');
  fs.mkdirSync(sc);
  let r = shortcut(a, 'create', sc);
  assert.equal(r.here, true, r.error);
  // B neither takes it over nor removes it, and says whose it is.
  r = shortcut(b, 'create', sc);
  assert.match(r.error || '', /starts the copy of the office in .*copy a/);
  assert.equal(r.here, false);
  r = shortcut(b, 'remove', sc);
  assert.equal(r.exists, true);
  assert.equal(r.kept, true);
  assert.equal(path.resolve(r.owner), path.resolve(a));
  assert.equal(shortcut(a, 'status', sc).here, true, 'A\'s shortcut still starts A');
  // A removes its own.
  r = shortcut(a, 'remove', sc);
  assert.equal(r.exists, false);
  // A shortcut whose copy is gone (moved, deleted) starts nothing: B may point it at itself.
  shortcut(a, 'create', sc);
  fs.rmSync(a, { recursive: true, force: true });
  r = shortcut(b, 'create', sc);
  assert.equal(r.error, undefined);
  assert.equal(r.here, true);
});

test('shortcuts: one an older version or the installer made (the start file by its full path) counts as that folder\'s (Windows)', { skip: !onWindows && 'Windows only', timeout: 60000 }, () => {
  const root = tmp('legacy');
  const a = fakeOffice(path.join(root, 'installed'));
  const b = fakeOffice(path.join(root, 'clone'));
  const lnk = path.join(root, 'AI Office Overview.lnk');
  const made = spawnSync(PS, ['-NoProfile', '-Command', `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}'); $s.TargetPath='${path.join(a, START)}'; $s.WorkingDirectory='${a}'; $s.Save()`], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  assert.equal(shortcut(a, 'status', root).here, true);
  const r = shortcut(b, 'remove', root);
  assert.equal(r.kept, true, 'the clone leaves the installer\'s shortcut');
  assert.ok(fs.existsSync(lnk));
  assert.equal(shortcut(a, 'remove', root).exists, false);
});

test('shortcuts: a shortcut starts a folder whose name holds %PATH%, & or ^ (Windows)', { skip: !onWindows && 'Windows only', timeout: 120000 }, async () => {
  for (const name of ['copy%PATH%x', 'a & (b) ^c %OS% d%']) {
    const root = tmp('odd');
    const office = fakeOffice(path.join(root, name));
    const sc = path.join(root, 'sc');
    fs.mkdirSync(sc);
    const r = shortcut(office, 'create', sc, 'startup');
    assert.equal(r.here, true, r.error);
    // Opened the way Explorer opens it (through the shell), in temp.
    spawnSync(PS, ['-NoProfile', '-Command', `(New-Object -ComObject Shell.Application).ShellExecute('${path.join(sc, 'AI Office Overview.lnk').replace(/'/g, "''")}')`], { encoding: 'utf8' });
    const started = path.join(office, 'started.txt');
    for (let i = 0; i < 40 && !fs.existsSync(started); i++) await sleep(250);
    assert.ok(fs.existsSync(started), `the shortcut for "${name}" started nothing`);
    for (let i = 0; i < 20 && !fs.readFileSync(started, 'utf8').trim(); i++) await sleep(100);
    assert.equal(fs.readFileSync(started, 'utf8').trim(), 'quiet');
  }
});

// ---- The .cmd files ----

test('install.cmd ends with a failure code when setup fails, and 0 when it works (Windows)', { skip: !onWindows && 'Windows only', timeout: 60000 }, () => {
  const d = tmp('install cmd');
  fs.mkdirSync(path.join(d, 'tools'));
  fs.copyFileSync(path.join(APP, 'install.cmd'), path.join(d, 'install.cmd'));
  const run = () => spawnSync(CMD, ['/d', '/c', path.join(d, 'install.cmd')], { input: '\r\n\r\n', encoding: 'utf8', env: { ...process.env, AI_OFFICE_INSTALL_NO_START: '1', AI_OFFICE_SHORTCUT_DIR: path.join(d, 'sc') } });
  fs.writeFileSync(path.join(d, 'tools', 'setup.mjs'), 'process.exit(1)\n');
  assert.equal(run().status, 1);
  fs.writeFileSync(path.join(d, 'tools', 'setup.mjs'), 'process.exit(0)\n');
  assert.equal(run().status, 0);
});

test('uninstall.cmd passes on a failed uninstall', () => {
  const t = fs.readFileSync(path.join(APP, 'uninstall.cmd'), 'utf8');
  assert.match(t, /tools\\setup\.mjs uninstall \|\| set "CODE=1"/);
  assert.match(t, /exit \/b %CODE%\s*$/);
});

test('the .cmd and .ps1 files are pure ASCII with Windows line endings', () => {
  for (const f of ['install.cmd', 'uninstall.cmd', START, 'installer/build.cmd', 'src/windows/shortcut.ps1']) {
    const b = fs.readFileSync(path.join(APP, f));
    assert.ok(b.every((c) => c < 128), `${f} holds a letter outside ASCII`);
    const t = b.toString('latin1');
    assert.equal(t.replace(/\r\n/g, '').includes('\n'), false, `${f} has a line without CRLF`);
  }
});

// ---- The installer ----

test('build.cmd ships Node.js\'s licence with node.exe, or refuses and says where to get it', () => {
  const t = fs.readFileSync(path.join(APP, 'installer', 'build.cmd'), 'utf8');
  assert.match(t, /node-LICENSE/);
  assert.match(t, /https:\/\/github\.com\/nodejs\/node\/blob\/%NODE_VERSION%\/LICENSE/);
  assert.match(t, /if not defined NODE_LICENSE \([\s\S]*?exit \/b 1/);
  assert.match(t, /copy \/y "%NODE_LICENSE%" "stage\\node\\LICENSE" >nul \|\| exit \/b 1/);
  assert.ok(t.indexOf('if not defined NODE_LICENSE (') < t.indexOf('rmdir /s /q stage'), 'checked before the stage is made');
  assert.match(fs.readFileSync(path.join(APP, '.gitignore'), 'utf8'), /^\/installer\/node-LICENSE$/m, 'the local copy stays out of git');
});

test('the installer empties its program folders on an upgrade (never data) and refuses a folder with $, %, ` or "', () => {
  const t = fs.readFileSync(path.join(APP, 'installer', 'ai-office-overview.iss'), 'utf8');
  const del = (t.split('[InstallDelete]')[1] || '').split(/^\[/m)[0].split(/\r?\n/).filter((l) => !l.startsWith(';')).join('\n');
  for (const d of ['src', 'public', 'test', 'tools']) assert.match(del, new RegExp(`Name: "\\{app\\}\\\\${d}"`));
  assert.doesNotMatch(del, /data/i);
  assert.match(t, /function NextButtonClick[\s\S]*wpSelectDir[\s\S]*FolderIsPlain/);
  assert.match(t, /function PrepareToInstall[\s\S]*FolderIsPlain/);
  for (const c of ["'$'", "'%'", "'`'", `'"'`]) assert.ok(t.includes(`Pos(${c}, Dir)`), `${c} is checked`);
});

// ---- The drift checker ----

test('head-office-check finds Head Office\'s office beside the clone\'s folder, one level up', () => {
  const root = tmp('layout');
  const clone = path.join(root, 'claude office', 'ai office overview');
  fs.mkdirSync(path.join(clone, 'tools'), { recursive: true });
  for (const f of ['head-office-check.mjs', 'head-office-differences.json']) fs.copyFileSync(path.join(APP, 'tools', f), path.join(clone, 'tools', f));
  fs.mkdirSync(path.join(root, 'ai head office overview', 'office', 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ai head office overview', 'office', 'public', 'office.js'), '');
  const env = { ...process.env };
  delete env.HEAD_OFFICE;
  const r = spawnSync(process.execPath, [path.join(clone, 'tools', 'head-office-check.mjs')], { encoding: 'utf8', env });
  assert.doesNotMatch(r.stderr, /was not found/, r.stderr);
  // A path given still wins.
  const given = spawnSync(process.execPath, [path.join(clone, 'tools', 'head-office-check.mjs'), path.join(root, 'nowhere')], { encoding: 'utf8', env });
  assert.equal(given.status, 2);
  assert.match(given.stderr, /nowhere/);
});

// ---- The sun ----

const sun = (() => { const m = { exports: {} }; new Function('module', fs.readFileSync(path.join(APP, 'public', 'sun.js'), 'utf8'))(m); return m.exports; })();

test('sun: southern-hemisphere zones are reckoned south of the equator (Montevideo, Buenos Aires, Santiago, Sao Paulo, Auckland, Johannesburg, Australia)', () => {
  for (const z of ['America/Montevideo', 'America/Argentina/Buenos_Aires', 'America/Santiago', 'America/Sao_Paulo', 'America/Asuncion', 'Pacific/Auckland', 'Africa/Johannesburg', 'Australia/Sydney', 'Australia/Perth', 'Australia/Lord_Howe']) {
    const p = sun.place(z);
    assert.equal(p.rough, false, `${z} is listed`);
    assert.ok(p.lat < -20, `${z} at latitude ${p.lat}`);
  }
  // Not listed: Argentina's other zones, and an American zone at UTC-3, are guessed south too.
  assert.ok(sun.place('America/Argentina/San_Luis').lat < -20);
});

test('sun: Montevideo\'s sun sets after 19:30 local time on 21 December (about 20:05)', () => {
  const p = sun.place('America/Montevideo');
  // Montevideo is UTC-3 all year: local noon on 21 Dec 2026 is 15:00 UTC.
  const t = sun.times(Date.UTC(2026, 11, 21, 15), p.lat, p.lon);
  // times() works from the local calendar day of the PC, so read the set as minutes after that day's UTC midnight.
  const setUtc = new Date(t.set).getUTCHours() * 60 + new Date(t.set).getUTCMinutes();
  const local = (setUtc - 180 + 1440) % 1440;
  assert.ok(local >= 19 * 60 + 30 && local <= 20 * 60 + 30, `sunset at ${Math.floor(local / 60)}:${String(local % 60).padStart(2, '0')}`);
});
