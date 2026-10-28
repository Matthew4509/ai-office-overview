// Install and uninstall: the three shortcuts, the hooks taken out of a copy of Claude's settings, and the console tool.
// Nothing real is changed: shortcuts go to a temp folder (AI_OFFICE_SHORTCUT_DIR), the settings file is a copy
// (AI_OFFICE_SETTINGS), and the office the tool tries to stop has a temp data folder with nothing running.
// The shortcut checks need Windows (PowerShell and .lnk files) and are skipped elsewhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tempHome } from './helpers.mjs';
import * as install from '../src/install.mjs';
import { withOurs } from '../src/setup.mjs';

const onWindows = process.platform === 'win32';
const TOOL = path.join(import.meta.dirname, '..', 'tools', 'setup.mjs');
const lnk = (dir, where) => path.join(dir, where, 'AI Office Overview.lnk');
const BEEPS = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: '[console]::beep(659,90)', shell: 'powershell', timeout: 5 }] }] } };

function scratch() {
  const h = tempHome();
  const sc = path.join(h.dir, 'shortcuts');
  const settings = path.join(h.dir, 'claude-settings.json');
  process.env.AI_OFFICE_SHORTCUT_DIR = sc;
  process.env.AI_OFFICE_SETTINGS = settings;
  const env = { ...process.env, AI_OFFICE_SHORTCUT_DIR: sc, AI_OFFICE_SETTINGS: settings, AI_OFFICE_DATA: h.data, AI_OFFICE_TRANSCRIPTS: h.transcripts };
  return { h, sc, settings, env, done: () => { delete process.env.AI_OFFICE_SHORTCUT_DIR; delete process.env.AI_OFFICE_SETTINGS; h.done(); } };
}

test('status: the folder, Node.js and each shortcut place', async () => {
  const s = scratch();
  try {
    const st = await install.status();
    assert.equal(st.folder, install.HERE);
    assert.ok(fs.existsSync(path.join(st.folder, 'server.mjs')), 'HERE is the office folder');
    assert.equal(st.node.ok, true);
    assert.equal(st.node.min, 20);
    for (const where of install.PLACES) assert.equal(st[where].exists, false, `${where}: nothing yet`);
  } finally { s.done(); }
});

test('shortcuts: each place is made, points here, and is taken away again (Windows)', { skip: !onWindows && 'shortcuts are made on Windows only' }, async () => {
  const s = scratch();
  try {
    const made = await install.apply({ startmenu: true, desktop: true, startup: true });
    assert.deepEqual(made.errors, []);
    for (const where of install.PLACES) {
      const r = made.results.find((x) => x.where === where);
      assert.equal(r.exists, true, `${where} exists`);
      assert.equal(r.here, true, `${where} points at this office`);
      assert.equal(path.resolve(r.path), path.resolve(lnk(s.sc, where)));
      assert.ok(fs.existsSync(lnk(s.sc, where)));
    }
    // What the shortcut runs: the start file in this folder, and "quiet" only for Start with Windows.
    const read = (where) => spawnSync('powershell', ['-NoProfile', '-Command', `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk(s.sc, where)}'); $s.TargetPath + '|' + $s.Arguments + '|' + $s.WindowStyle`], { encoding: 'utf8' }).stdout.trim();
    assert.equal(read('desktop'), `${path.join(install.HERE, 'Start AI Office Overview.cmd')}||7`);
    assert.equal(read('startup'), `${path.join(install.HERE, 'Start AI Office Overview.cmd')}|quiet|7`);
    const left = await install.apply({ desktop: false });
    assert.deepEqual(left.errors, []);
    assert.ok(!fs.existsSync(lnk(s.sc, 'desktop')), 'the desktop one is gone');
    assert.ok(fs.existsSync(lnk(s.sc, 'startmenu')), 'the others stay');
    const st = await install.status();
    assert.equal(st.desktop.exists, false);
    assert.equal(st.startup.exists, true);
  } finally { s.done(); }
});

test('uninstall: every shortcut away, and only this office\'s hooks out of a copy of Claude\'s settings', async () => {
  const s = scratch();
  try {
    if (onWindows) await install.apply({ startmenu: true, desktop: true, startup: true });
    const withBoth = withOurs(BEEPS, 'node "C:/x/ai office overview/hook.mjs" 8860 --ai-office-overview-hook');
    withBoth.hooks.Stop.push({ hooks: [{ type: 'command', command: 'node "C:/old/claude office/hook.mjs" 8860 --claude-office-hook', timeout: 3 }] });
    withBoth.hooks.Stop.push({ hooks: [{ type: 'command', command: 'node "C:/other/office/hook.mjs" 8880 --ai-head-office-hook', timeout: 3 }] });
    fs.writeFileSync(s.settings, JSON.stringify(withBoth, null, 2));
    const r = await install.uninstall();
    assert.deepEqual(r.errors, []);
    if (onWindows) for (const where of install.PLACES) assert.ok(!fs.existsSync(lnk(s.sc, where)), `${where} gone`);
    const hooks = r.results.find((x) => x.where === 'hooks');
    assert.equal(hooks.removed, true);
    assert.ok(fs.existsSync(hooks.backup), 'a copy of the file from before');
    const now = JSON.parse(fs.readFileSync(s.settings, 'utf8'));
    assert.equal(now.model, 'opus');
    assert.equal(now.hooks.Stop.length, 2, 'the beep and the other program\'s hook stay');
    assert.equal(now.hooks.Stop[0].hooks[0].command, '[console]::beep(659,90)');
    assert.match(now.hooks.Stop[1].hooks[0].command, /--ai-head-office-hook$/);
    assert.equal(now.hooks.UserPromptSubmit, undefined, 'our event arrays are gone');
    // Nothing of ours left: a second uninstall changes nothing and keeps no new copy.
    const again = install.removeHooks();
    assert.equal(again.none, true);
  } finally { s.done(); }
});

test('removeHooks: a settings file that is not JSON is left alone, with a plain reason', () => {
  const s = scratch();
  try {
    fs.writeFileSync(s.settings, '{ "hooks": [ --ai-office-overview-hook');
    const r = install.removeHooks();
    assert.match(r.error, /not valid JSON/);
    assert.equal(fs.readFileSync(s.settings, 'utf8'), '{ "hooks": [ --ai-office-overview-hook');
  } finally { s.done(); }
});

test('removeHooks: a settings file saved with a byte-order mark (Notepad, PowerShell 5) is read, and only our hook goes', () => {
  const s = scratch();
  try {
    const ours = { hooks: [{ type: 'command', command: 'node "C:/x/office/hook.mjs" 8860 --ai-office-overview-hook', timeout: 3 }] };
    fs.writeFileSync(s.settings, '\uFEFF' + JSON.stringify({ hooks: { Stop: [BEEPS.hooks.Stop[0], ours] } }, null, 2));
    const r = install.removeHooks();
    assert.equal(r.error, undefined, 'no "not valid JSON"');
    const left = JSON.parse(fs.readFileSync(s.settings, 'utf8').replace(/^\uFEFF/, ''));
    assert.deepEqual(left.hooks.Stop, [BEEPS.hooks.Stop[0]]);
  } finally { s.done(); }
});

test('tools/setup.mjs install: "n" to both leaves them out, the Start menu one is still made; --yes makes all three; uninstall takes them away (Windows)', { skip: !onWindows && 'shortcuts are made on Windows only' }, () => {
  const s = scratch();
  try {
    const run = (args, input = '') => spawnSync(process.execPath, [TOOL, ...args], { env: s.env, input, encoding: 'utf8', timeout: 60000 });
    let r = run(['install'], 'n\nn\n');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(lnk(s.sc, 'startmenu')), 'Start menu made');
    assert.ok(!fs.existsSync(lnk(s.sc, 'desktop')) && !fs.existsSync(lnk(s.sc, 'startup')), 'nothing made after "n"');
    r = run(['install', '--yes']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const where of install.PLACES) assert.ok(fs.existsSync(lnk(s.sc, where)), `${where} made with --yes`);
    r = run(['uninstall']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const where of install.PLACES) assert.ok(!fs.existsSync(lnk(s.sc, where)), `${where} gone`);
    assert.match(r.stdout, /Delete that folder/);
    assert.ok(!fs.existsSync(s.settings), 'no settings file was made where there was none');
  } finally { s.done(); }
});
