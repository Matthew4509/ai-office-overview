import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { apply, status, onHook, withOurs, withoutOurs, hookCommand, UNSAFE_HOOK_PATH } from '../src/setup.mjs';
import { Office } from '../src/office.mjs';
import { tempHome, lines, ROOT } from './helpers.mjs';

const BEEPS = {
  model: 'opus',
  hooks: {
    Stop: [{ hooks: [{ type: 'command', command: '[console]::beep(659,90)', shell: 'powershell', timeout: 5 }] }],
    Notification: [{ hooks: [{ type: 'command', command: '[console]::beep(988,130)', shell: 'powershell', timeout: 5 }] }],
  },
};

function withSettings(h, data) {
  const file = path.join(h.dir, 'settings.json');
  if (data !== undefined) fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  process.env.AI_OFFICE_SETTINGS = file;
  return file;
}

test('advanced setup adds its three hooks beside the ones already there, keeps a copy, and comes off cleanly', () => {
  const h = tempHome();
  try {
    const file = withSettings(h, BEEPS);
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    const on = apply(office, { advanced: true }, { port: 8860, hookScript: 'C:\\x\\ai office overview\\hook.mjs' });
    assert.equal(on.ok, true);
    assert.equal(on.status.mode, 'advanced');
    assert.ok(fs.existsSync(on.backup), 'a copy of the file from before');
    assert.deepEqual(JSON.parse(fs.readFileSync(on.backup, 'utf8')), BEEPS);
    const now = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(now.model, 'opus', 'other settings untouched');
    assert.equal(now.hooks.Stop[0].hooks[0].command, '[console]::beep(659,90)', 'the beep stays first');
    assert.equal(now.hooks.Stop.length, 2);
    assert.equal(now.hooks.UserPromptSubmit.length, 1);
    assert.match(now.hooks.Stop[1].hooks[0].command, /^node "C:\/x\/ai office overview\/hook\.mjs" 8860 --ai-office-overview-hook$/);
    // Turning it on twice does not add it twice.
    apply(office, { advanced: true }, { port: 8860, hookScript: 'C:\\x\\ai office overview\\hook.mjs' });
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop.length, 2);
    const off = apply(office, { advanced: false }, { port: 8860, hookScript: 'x' });
    assert.equal(off.status.mode, 'easy');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), BEEPS, 'back exactly as it was');
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});

test('hooks an earlier version wrote, under its old mark, still count as ours: on, replaced, and taken off', () => {
  const h = tempHome();
  try {
    const old = (ev) => ({ hooks: [{ type: 'command', command: 'node "C:/x/old office/hook.mjs" 8860 --claude-office-hook', timeout: 3 }] });
    const file = withSettings(h, { ...BEEPS, hooks: { ...BEEPS.hooks, Stop: [...BEEPS.hooks.Stop, old()], Notification: [...BEEPS.hooks.Notification, old()], UserPromptSubmit: [old()] } });
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    assert.equal(status(office).mode, 'advanced');
    apply(office, { advanced: true }, { port: 8860, hookScript: 'C:\\x\\ai office overview\\hook.mjs' });
    const now = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(now.hooks.Stop.length, 2, 'the old one replaced, not added beside');
    assert.match(now.hooks.Stop[1].hooks[0].command, /--ai-office-overview-hook$/);
    fs.writeFileSync(file, JSON.stringify({ ...BEEPS, hooks: { ...BEEPS.hooks, Stop: [...BEEPS.hooks.Stop, old()] } }));
    apply(office, { advanced: false }, { port: 8860, hookScript: 'x' });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), BEEPS, 'the old one taken off, the beeps kept');
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});

// Another program's hooks that look like ours (a hook.mjs, a port, a --…-hook mark): AI Head Office Overview's, and two
// made-up ones whose marks only contain ours.
const OTHERS = [
  'node "C:/x/ai head office overview/office/hook.mjs" 8870 --ai-head-office-hook',
  'node "C:/x/other/hook.mjs" 9000 --my-claude-office-hook',
  'node "C:/x/other/hook.mjs" 9000 --not-ai-office-overview-hook',
];
const othersOn = () => ({
  ...BEEPS,
  hooks: {
    ...BEEPS.hooks,
    Stop: [...BEEPS.hooks.Stop, ...OTHERS.map((command) => ({ hooks: [{ type: 'command', command, timeout: 3 }] }))],
    UserPromptSubmit: OTHERS.map((command) => ({ hooks: [{ type: 'command', command, timeout: 3 }] })),
  },
});

test('another program\'s hooks are not ours: they never count as advanced, and turning it on or off keeps them', () => {
  const h = tempHome();
  try {
    const file = withSettings(h, othersOn());
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    assert.equal(status(office).mode, 'easy', 'only the other programs\' hooks are there');
    const on = apply(office, { advanced: true }, { port: 8860, hookScript: 'C:\\x\\ai office overview\\hook.mjs' });
    assert.equal(on.status.mode, 'advanced');
    const now = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(now.hooks.Stop.slice(0, 4), othersOn().hooks.Stop, 'the beep and the other programs\' hooks kept, in place');
    assert.equal(now.hooks.Stop.length, 5);
    assert.equal(now.hooks.UserPromptSubmit.length, 4);
    apply(office, { advanced: false }, { port: 8860, hookScript: 'x' });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), othersOn(), 'back exactly as it was: only ours taken off');
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});

test('a settings file that is not valid JSON is never touched', () => {
  const h = tempHome();
  try {
    const file = withSettings(h, '{ "hooks": ');
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    const r = apply(office, { advanced: true }, { port: 8860, hookScript: 'x' });
    assert.match(r.error.fault, /could not be read/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{ "hooks": ');
    assert.equal(status(office).readable, false);
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});

test('a settings file saved with a byte-order mark (Notepad, PowerShell 5) is read: advanced setup goes on and keeps the hooks there', () => {
  const h = tempHome();
  try {
    const file = withSettings(h, '\uFEFF' + JSON.stringify(BEEPS, null, 2));
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    assert.equal(status(office).readable, true);
    const r = apply(office, { advanced: true }, { port: 8860, hookScript: 'C:\\x\\office\\hook.mjs' });
    assert.equal(r.error, undefined);
    const after = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(after.model, 'opus');
    assert.ok(after.hooks.Stop.some((g) => g.hooks[0].command.includes('beep')), 'the beep is kept');
    assert.ok(after.hooks.Stop.some((g) => g.hooks[0].command.includes('--ai-office-overview-hook')), 'ours is added');
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});

test('no settings file yet: advanced setup makes one with only its hooks', () => {
  const merged = withOurs({}, hookCommand('C:/a/hook.mjs', 8860));
  assert.deepEqual(Object.keys(merged.hooks).sort(), ['Notification', 'Stop', 'UserPromptSubmit']);
  assert.deepEqual(withoutOurs(merged), {});
});

test('a permission prompt from a hook makes the thread "Needs you" at once; "waiting for input" alone does not', () => {
  const h = tempHome();
  try {
    lines('t1').prompt(0, 'go').tool(1, 'Bash', { command: 'npm test', description: 'Run the tests' }, 10, `${ROOT}\\ai office overview`).write(path.join(h.transcripts, 'C--Work-projects', 't1.jsonl'));
    let now = Date.parse('2026-10-12T00:01:05Z');
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts, now: () => now });
    office.settings.root = ROOT;
    office.scan();
    const me = () => office.snapshot().people.find((p) => p.folder === 'ai office overview');
    assert.equal(me().state, 'working');
    onHook(office, { event: 'Notification', session: 't1', message: 'Claude needs your permission to use Bash' });
    assert.equal(me().state, 'needs');
    assert.equal(me().words, 'Waiting for your permission');
    now += 1000;
    onHook(office, { event: 'Notification', session: 't1', message: 'Claude is waiting for your input' });
    assert.equal(me().state, 'idle');
  } finally {
    h.done();
  }
});

test('the hook script ends cleanly and prints nothing when the office is closed', () => {
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '..', 'hook.mjs'), '1', '--ai-office-overview-hook'], { input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'x' }), timeout: 5000 });
  assert.equal(r.status, 0);
  assert.equal(String(r.stdout), '');
});

test('a folder path with $, a backtick, a " or % is refused for advanced setup, and the settings file is not touched', () => {
  const h = tempHome();
  try {
    const file = withSettings(h, '{}');
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    for (const bad of ['C:\\x\\%PATH%\\hook.mjs', 'C:\\x\\$(calc)\\hook.mjs', 'C:\\x\\`calc`\\hook.mjs', 'C:\\x\\a"b\\hook.mjs']) {
      const r = apply(office, { advanced: true }, { port: 8860, hookScript: bad });
      assert.match(r.error?.fault || '', /cannot be turned on/);
      assert.ok(r.error.wayOut);
    }
    assert.equal(fs.readFileSync(file, 'utf8'), '{}');
    assert.equal(UNSAFE_HOOK_PATH.test('C:\\x\\ai office overview\\hook.mjs'), false);
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});

test('after the office folder moves, status says the hooks no longer point here, and turning it on again fixes them', () => {
  const h = tempHome();
  try {
    withSettings(h, {});
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    const old = { port: 8860, hookScript: 'C:\\old place\\ai office overview\\hook.mjs' };
    const now = { port: 8860, hookScript: 'C:\\new place\\ai office overview\\hook.mjs' };
    apply(office, { advanced: true }, old);
    assert.equal(status(office, old).hookHere, true);
    const moved = status(office, now);
    assert.equal(moved.mode, 'advanced');
    assert.equal(moved.hookHere, false);
    assert.equal(status(office, { ...now, hookScript: old.hookScript, port: 8865 }).hookHere, false, 'another port too');
    const again = apply(office, { advanced: true }, now);
    assert.equal(again.ok, true);
    assert.equal(again.status.hookHere, true);
    assert.equal(status(office).hookHere, null, 'not asked without a place');
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});
