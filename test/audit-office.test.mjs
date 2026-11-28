// Audit of 2026-11-28: one test per fault found. P0 tests fail until the fault is fixed; P1 tests are marked todo, so
// they stay green and say what must hold. Run: node tools/run-tests.mjs test/audit-office.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { tempHome, startOffice, freePort, lines, SERVER, ROOT } from './helpers.mjs';
import { Office } from '../src/office.mjs';
import { buy } from '../src/shop.mjs';
import * as install from '../src/install.mjs';
import * as setup from '../src/setup.mjs';

const HOOK_SCRIPT = path.join(install.HERE, 'hook.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyOf = async (o) => /name="ai-office-key" content="([^"]+)"/.exec(await (await fetch(`http://127.0.0.1:${o.port}/`)).text())[1];
const api = async (o, key, p, body) => (await fetch(`http://127.0.0.1:${o.port}${p}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'x-ai-office-key': key, 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})).json();
const hook = (o, b) => fetch(`http://127.0.0.1:${o.port}/api/hook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const transcript = (h, id) => path.join(h.transcripts, 'C--Work-projects', `${id}.jsonl`);

test('A1: uninstall takes the hooks out and keeps every long number in Claude\'s settings with its own digits', () => {
  const h = tempHome();
  try {
    const cmd = setup.hookCommand(HOOK_SCRIPT, 8860);
    fs.writeFileSync(h.settings, `{\n  "survey": { "lastShownTime": 17000000000000000001 },\n  "hooks": { "Stop": [ { "hooks": [ { "type": "command", "command": ${JSON.stringify(cmd)}, "timeout": 3 } ] } ] }\n}\n`);
    const r = install.removeHooks();
    assert.equal(r.removed, true);
    const after = fs.readFileSync(h.settings, 'utf8');
    assert.ok(!after.includes('--ai-office-overview-hook'), 'the hook is out');
    assert.ok(after.includes('17000000000000000001'), `the long number was written back with other digits: ${after.match(/lastShownTime"\s*:\s*([^\s,}]+)/)?.[1]}`);
  } finally { h.done(); }
});

test('A2: a purchase never drops what was bought before, even an item this version of the shop does not sell', () => {
  const h = tempHome();
  try {
    fs.mkdirSync(h.data, { recursive: true });
    const file = path.join(h.data, 'office.json');
    // Bought in a newer version (the update's own answer says how to go back to the older one).
    fs.writeFileSync(file, JSON.stringify({ bought: [{ item: 'coffee', price: 200000, at: '2026-11-01T00:00:00.000Z' }, { item: 'hottub', price: 5000000, at: '2026-11-02T00:00:00.000Z' }] }));
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    office.snapshot = () => ({ earned: 1e9 });
    const r = buy(office, 'coffee');
    assert.ok(r.ok, JSON.stringify(r));
    const kept = fs.readFileSync(file, 'utf8').includes('hottub')
      || fs.readdirSync(h.data).some((f) => f.startsWith('office.') && f !== 'office.json' && fs.readFileSync(path.join(h.data, f), 'utf8').includes('hottub'));
    assert.ok(kept, 'the earlier purchase is gone from office.json and no copy of it was kept');
  } finally { h.done(); }
});

test('A3: a line whose time is readable text but not in the usual form never freezes a thread\'s last activity (its question is listed)', async () => {
  const h = tempHome();
  let o;
  try {
    const id = 'a3000000-0000-4000-8000-000000000003';
    const base = Date.now() - 3 * 60000;
    // The first line's time is written the long way (a date nine days ago); the rest are written now.
    lines(id, base).raw({ type: 'user', timestamp: new Date(Date.now() - 9 * 86400000).toUTCString(), cwd: ROOT, sessionId: id, message: { role: 'user', content: 'first' } })
      .prompt(0, 'go on').reply(1, 'Do you want the red one or the blue one?').write(transcript(h, id));
    o = await startOffice(h);
    const s = await api(o, await keyOf(o), '/api/state');
    assert.ok(s.waiting.some((w) => w.id === id), `the thread that asked now is not on Needs attention (people: ${s.people.map((p) => `${p.name} ${p.state}`).join(', ')})`);
  } finally { await o?.stop(); h.done(); }
});

test('A4: Answered keeps a thread off Needs attention when the "waiting for your input" notice comes a minute later (advanced setup)', async () => {
  const h = tempHome();
  let o;
  try {
    const id = 'a4000000-0000-4000-8000-000000000004';
    lines(id, Date.now() - 3 * 60000).prompt(0, 'hello').reply(1, 'Shall I go on?').write(transcript(h, id));
    o = await startOffice(h);
    const key = await keyOf(o);
    await hook(o, { event: 'Stop', session: id });
    assert.ok((await api(o, key, '/api/state')).waiting.some((w) => w.id === id), 'listed first');
    await api(o, key, '/api/done', { id });
    assert.ok(!(await api(o, key, '/api/state')).waiting.some((w) => w.id === id), 'taken off');
    await sleep(1200);
    await hook(o, { event: 'Notification', session: id, message: 'Claude is waiting for your input' });
    const s = await api(o, key, '/api/state');
    assert.ok(!s.waiting.some((w) => w.id === id), 'the thread came back on Needs attention without asking again');
  } finally { await o?.stop(); h.done(); }
});

test('A5: --stop while the office is busy reading never says it is not running, nor removes its run file, while it still runs', { timeout: 240000 }, async () => {
  const h = tempHome();
  let child;
  try {
    // Ten big transcripts: the first read of one batch keeps the office busy for several seconds.
    const l = `${JSON.stringify({ type: 'assistant', timestamp: new Date().toISOString(), cwd: ROOT, message: { id: 'm', stop_reason: 'tool_use', usage: { output_tokens: 1 }, content: [{ type: 'text', text: 'x'.repeat(2000) }] } })}\n`;
    const big = l.repeat(12000);
    for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(h.transcripts, 'C--Work-projects', `big${i}.jsonl`), big);
    const env = { ...process.env, PORT: String(await freePort()), AI_OFFICE_DATA: h.data, AI_OFFICE_TRANSCRIPTS: h.transcripts, AI_OFFICE_OPEN: '0' };
    delete env.AI_OFFICE_UPDATE_TEST;
    child = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    for (let i = 0; i < 300 && !out.includes('is open'); i++) await sleep(50);
    await sleep(300);
    const r = spawnSync(process.execPath, [SERVER, '--stop'], { env, encoding: 'utf8', timeout: 60000 });
    const runFile = fs.existsSync(path.join(h.data, 'run.json'));
    // An office that took the stop is gone within a moment; only one that is still there afterwards was missed.
    await sleep(2000);
    const stillRunning = child.exitCode === null;
    if (stillRunning) {
      assert.ok(!/is not running/.test(r.stdout), `--stop said "${r.stdout.trim()}" (exit ${r.status}) while the office still runs`);
      assert.ok(runFile, 'the run file of the office that still runs was removed');
    }
  } finally {
    if (child && child.exitCode === null) { child.kill(); await new Promise((r) => child.on('exit', r)); }
    h.done();
  }
});

test('A6: advanced setup on and off keeps an empty hook list and an empty hooks object of the user\'s', { todo: 'P1' }, () => {
  const h = tempHome();
  try {
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    fs.writeFileSync(h.settings, JSON.stringify({ a: 1, hooks: { PreToolUse: [] }, z: 2 }, null, 2));
    setup.apply(office, { advanced: true }, { port: 8860, hookScript: HOOK_SCRIPT });
    setup.apply(office, { advanced: false }, { port: 8860, hookScript: HOOK_SCRIPT });
    assert.deepEqual(JSON.parse(fs.readFileSync(h.settings, 'utf8')), { a: 1, hooks: { PreToolUse: [] }, z: 2 });
  } finally { h.done(); }
});

test('A7: Answered keeps a thread off Needs attention when one of its helpers finishes afterwards', { todo: 'P1' }, async () => {
  const h = tempHome();
  let o;
  try {
    const id = 'a7000000-0000-4000-8000-000000000007';
    lines(id, Date.now() - 3 * 60000).prompt(0, 'hello').reply(1, 'Which one do you want?').write(transcript(h, id));
    o = await startOffice(h);
    const key = await keyOf(o);
    await api(o, key, '/api/done', { id });
    lines('agent-x').raw({ type: 'assistant', timestamp: new Date().toISOString(), cwd: ROOT, message: { id: 'h1', stop_reason: 'end_turn', usage: { output_tokens: 5 }, content: [{ type: 'text', text: 'report done' }] } })
      .write(path.join(h.transcripts, 'C--Work-projects', id, 'subagents', 'agent-x.jsonl'));
    await sleep(4000);
    assert.ok(!(await api(o, key, '/api/state')).waiting.some((w) => w.id === id));
  } finally { await o?.stop(); h.done(); }
});

test('A8: a damaged data file is copied aside once, not again at every start', { todo: 'P1' }, () => {
  const h = tempHome();
  try {
    fs.mkdirSync(h.data, { recursive: true });
    fs.writeFileSync(path.join(h.data, 'done.json'), '');
    new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    assert.equal(fs.readdirSync(h.data).filter((f) => f.startsWith('done.damaged-')).length, 1);
  } finally { h.done(); }
});

test('A9: an address with a broken %-escape is answered 404 (or 400), not as a fault of the office (500)', { todo: 'P1' }, async () => {
  const h = tempHome();
  let o;
  try {
    o = await startOffice(h);
    const r = await fetch(`http://127.0.0.1:${o.port}/%ZZ`);
    assert.ok(r.status === 404 || r.status === 400, `answered ${r.status}`);
  } finally { await o?.stop(); h.done(); }
});
