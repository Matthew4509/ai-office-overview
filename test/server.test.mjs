// The office over HTTP: scratch offices on ports of their own, over temp folders only (startOffice in helpers.mjs
// refuses to start one whose data, transcripts, app records, Claude settings file or shortcut folder is not in temp).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tempHome, startOffice, freePort, lines, SERVER, HOOK } from './helpers.mjs';

/** Sends raw bytes and gives back what came back (until the office closes the connection or a second passes). */
function raw(port, text) {
  return new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1');
    let got = '';
    const end = () => { sock.destroy(); resolve(got); };
    sock.setTimeout(1000, end);
    sock.on('data', (c) => { got += c; if (/\r\n\r\n/.test(got) && /connection: close/i.test(got)) end(); });
    sock.on('end', end);
    sock.on('error', end);
    sock.write(text);
  });
}

/**
 * One request, with the Host, content type and key chosen by the test: { status, text, json }.
 * body: sent as JSON; raw: sent as it is; type: the content type (null for none); key: the x-ai-office-key header.
 */
function call(port, method, pathname, { body, raw: rawBody, key, host = `127.0.0.1:${port}`, type = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const data = rawBody ?? (body === undefined ? '' : JSON.stringify(body));
    const headers = { host, connection: 'close' };
    if (method !== 'GET' || data) headers['content-length'] = Buffer.byteLength(data);
    if (type) headers['content-type'] = type;
    if (key) headers['x-ai-office-key'] = key;
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers, agent: false }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON: the page */ }
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

/** A scratch office on its own port, with its own data, transcripts and AI-app settings: never the real ones.
 * prepare(h) runs before it starts (transcripts, data files). */
async function scratchOffice(prepare) {
  const h = tempHome();
  try {
    fs.writeFileSync(h.settings, '{}\n');
    if (prepare) prepare(h);
    const o = await startOffice(h);
    return { ...o, h, data: h.data, done: async () => { await o.stop(); h.done(); } };
  } catch (e) {
    h.done();
    throw e;
  }
}

/** The key the page was served with (the meta line in index.html). */
async function pageKey(port) {
  const page = await raw(port, `GET / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
  const m = /<meta name="ai-office-key" content="([^"]+)">/.exec(page);
  assert.ok(m, 'the page carries a key');
  assert.notEqual(m[1], '__AI_OFFICE_KEY__', 'the key is filled in');
  return m[1];
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('a malformed request address gets a 400, and the office keeps running', async () => {
  const o = await scratchOffice();
  try {
    const got = await raw(o.port, `GET http://[ HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nConnection: close\r\n\r\n`);
    assert.match(got, /^HTTP\/1\.1 400 /, `a 400 answer, got: ${JSON.stringify(got.slice(0, 200))}`);
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(o.alive(), 'the office is still running');
    const state = await raw(o.port, `GET /api/state HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nx-ai-office-key: ${await pageKey(o.port)}\r\nConnection: close\r\n\r\n`);
    assert.match(state, /^HTTP\/1\.1 200 /, 'and still answers its page');
  } finally {
    await o.done();
  }
});

test('a folder called __proto__ is refused with a way out, and the office keeps running', async () => {
  const o = await scratchOffice();
  try {
    const body = JSON.stringify({ folder: '__proto__', seat: 1, nick: 'Sneaky' });
    const got = await raw(o.port, `POST /api/edit HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nx-ai-office-key: ${await pageKey(o.port)}\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`);
    assert.match(got, /^HTTP\/1\.1 400 /);
    assert.match(got, /cannot be kept/);
    assert.ok(o.alive());
  } finally {
    await o.done();
  }
});

test('every API request needs the key the page was served with; the hook route does not', async () => {
  const o = await scratchOffice();
  try {
    const key = await pageKey(o.port);
    const none = await raw(o.port, `GET /api/state HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nConnection: close\r\n\r\n`);
    assert.match(none, /^HTTP\/1\.1 403 /, 'without the key');
    assert.match(none, /older run/);
    const wrong = await raw(o.port, `GET /api/state HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nx-ai-office-key: ${key.slice(1)}x\r\nConnection: close\r\n\r\n`);
    assert.match(wrong, /^HTTP\/1\.1 403 /, 'with another key');
    const right = await raw(o.port, `GET /api/state HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nx-ai-office-key: ${key}\r\nConnection: close\r\n\r\n`);
    assert.match(right, /^HTTP\/1\.1 200 /, 'with the key');
    const body = JSON.stringify({ event: 'Stop', session: 'abc' });
    const hook = await raw(o.port, `POST /api/hook HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`);
    assert.match(hook, /^HTTP\/1\.1 200 /, 'the hook route takes a plain event');
    assert.ok(o.alive());
  } finally {
    await o.done();
  }
});

test('About > Quit stops the office, and --status and --stop see the run file', async () => {
  const o = await scratchOffice();
  const env = { ...process.env, PORT: String(o.port), AI_OFFICE_DATA: o.data };
  try {
    assert.ok(fs.existsSync(path.join(o.data, 'run.json')), 'the run file is written at start');
    const st = spawnSync(process.execPath, [SERVER, '--status'], { env, encoding: 'utf8' });
    assert.equal(st.status, 0, st.stdout + st.stderr);
    assert.match(st.stdout, new RegExp(`running: http://127\\.0\\.0\\.1:${o.port}/`));
    // A second office over the same data folder is refused.
    const twice = spawnSync(process.execPath, [SERVER], { env: { ...env, PORT: String(await freePort()) }, encoding: 'utf8', timeout: 15000 });
    assert.equal(twice.status, 1);
    assert.match(twice.stderr, /already running/);
    const stop = spawnSync(process.execPath, [SERVER, '--stop'], { env, encoding: 'utf8', timeout: 15000 });
    assert.equal(stop.status, 0, stop.stdout + stop.stderr);
    assert.match(stop.stdout, /has stopped/);
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(!o.alive(), 'the office ended');
    assert.ok(!fs.existsSync(path.join(o.data, 'run.json')), 'the run file is gone');
    const gone = spawnSync(process.execPath, [SERVER, '--status'], { env, encoding: 'utf8' });
    assert.equal(gone.status, 1);
  } finally {
    await o.done();
  }
  const q = await scratchOffice();
  try {
    const key = await pageKey(q.port);
    const quit = await raw(q.port, `POST /api/quit HTTP/1.1\r\nHost: 127.0.0.1:${q.port}\r\nx-ai-office-key: ${key}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`);
    assert.match(quit, /^HTTP\/1\.1 200 /);
    await new Promise((r) => setTimeout(r, 600));
    assert.ok(!q.alive(), 'Quit ended the office');
    assert.ok(!fs.existsSync(path.join(q.data, 'run.json')));
  } finally {
    await q.done();
  }
});

test('only the office\'s own page gets in: another Host, a POST that is not JSON, a wrong method and a body over 16 KB are turned away', async () => {
  const o = await scratchOffice();
  try {
    const key = await pageKey(o.port);
    const seats = path.join(o.data, 'seats.json');
    // The Host gate (a page on another name pointed at 127.0.0.1, DNS rebinding): refused, key or not, page or API.
    for (const host of ['evil.example', `evil.example:${o.port}`, `127.0.0.1:${o.port + 1}`, `127.0.0.2:${o.port}`]) {
      const r = await call(o.port, 'GET', '/api/state', { key, host });
      assert.equal(r.status, 403, `Host ${host}`);
      assert.match(r.json.error.fault, /turned away/);
      assert.equal((await call(o.port, 'GET', '/', { host })).status, 403, `the page itself for Host ${host}`);
    }
    assert.equal((await call(o.port, 'GET', '/api/state', { key, host: `localhost:${o.port}` })).status, 200, 'localhost (still this PC) is let in');
    // A POST must say it is JSON (a plain form from another page cannot), the hook route included.
    const form = await call(o.port, 'POST', '/api/nickname', { key, type: 'text/plain', body: { folder: 'proj', seat: 1, nick: 'Form' } });
    assert.equal(form.status, 403);
    assert.equal((await call(o.port, 'POST', '/api/nickname', { key, type: null, body: { folder: 'proj', seat: 1, nick: 'Form' } })).status, 403, 'no content type at all');
    assert.equal((await call(o.port, 'POST', '/api/hook', { type: 'application/x-www-form-urlencoded', raw: 'event=Stop&session=abc' })).status, 403);
    assert.ok(!fs.existsSync(seats), 'nothing was kept');
    // A method the office does not take.
    for (const [method, at] of [['PUT', '/api/state'], ['DELETE', '/api/nickname'], ['PATCH', '/api/favourite'], ['POST', '/index.html'], ['PUT', '/']]) {
      const r = await call(o.port, method, at, { key, body: {} });
      assert.equal(r.status, 405, `${method} ${at}`);
      assert.match(r.json.error.fault, /cannot be done here/);
    }
    // Over 16 KB: refused with a reason, nothing kept; just under it is fine.
    const big = await call(o.port, 'POST', '/api/nickname', { key, body: { folder: 'proj', seat: 1, nick: 'x'.repeat(17 * 1024) } });
    assert.equal(big.status, 400);
    assert.match(big.json.error.reason, /over 16 KB/);
    assert.ok(!fs.existsSync(seats), 'nothing was kept from the big one');
    const under = await call(o.port, 'POST', '/api/nickname', { key, body: { folder: 'proj', seat: 1, nick: `Ada ${'x'.repeat(15 * 1024)}` } });
    assert.equal(under.status, 200, 'just under 16 KB goes in');
    assert.equal(readJson(seats).proj['1'].nick.length, 40, 'and the name is cut to 40 characters');
    // Not JSON: a 400 with a way out, not a crash.
    const junk = await call(o.port, 'POST', '/api/nickname', { key, raw: '{"folder": ' });
    assert.equal(junk.status, 400);
    assert.ok(junk.json.error.wayOut);
    assert.ok(o.alive());
    assert.equal((await call(o.port, 'GET', '/api/state', { key })).status, 200, 'and the office still answers');
  } finally {
    await o.done();
  }
});

test('a nickname and the stars (a person, a whole project, hidden) are kept in the data folder and shown in the state', async () => {
  const o = await scratchOffice();
  try {
    const key = await pageKey(o.port);
    const state = async () => (await call(o.port, 'GET', '/api/state', { key })).json;
    const who = (s, seat) => s.people.find((p) => p.folder === 'proj' && p.seat === seat);
    const seats = path.join(o.data, 'seats.json');

    assert.equal((await call(o.port, 'POST', '/api/nickname', { body: { folder: 'proj', seat: 2, nick: 'No key' } })).status, 403, 'without the key');
    const nick = await call(o.port, 'POST', '/api/nickname', { key, body: { folder: 'proj', seat: 2, nick: '  Ada   Lovelace  ' } });
    assert.equal(nick.status, 200);
    assert.deepEqual(nick.json, { ok: true });
    assert.equal(who(await state(), 2)?.nick, 'Ada Lovelace', 'spaces tidied');
    assert.equal(who(await state(), 2).name, 'Ada Lovelace');
    assert.equal(readJson(seats).proj['2'].nick, 'Ada Lovelace');
    assert.equal((await call(o.port, 'POST', '/api/nickname', { key, body: { folder: 'proj', seat: 2, nick: '' } })).status, 200);
    assert.equal(who(await state(), 2), undefined, 'an empty name takes it off again');

    assert.equal((await call(o.port, 'POST', '/api/favourite', { key, body: { folder: 'proj', seat: 3, on: true } })).status, 200);
    let p = who(await state(), 3);
    assert.ok(p?.fav && p.favSeat && !p.favHidden, JSON.stringify(p));
    assert.equal((await call(o.port, 'POST', '/api/favourite', { key, body: { folder: 'proj', seat: 3, hidden: true } })).status, 200);
    p = who(await state(), 3);
    assert.ok(p.fav && p.favHidden, 'hidden, and still a favourite');
    assert.equal(readJson(seats).proj['3'].favHidden, true);
    assert.equal((await call(o.port, 'POST', '/api/favourite', { key, body: { folder: 'proj', seat: 3, on: false } })).status, 200);
    assert.equal(who(await state(), 3), undefined, 'the star off: nothing left to show');

    assert.equal((await call(o.port, 'POST', '/api/favourite', { key, body: { folder: 'proj', project: true, on: true } })).status, 200);
    assert.deepEqual((await state()).favProjects, ['proj']);
    assert.deepEqual(readJson(path.join(o.data, 'settings.json')).favProjects, ['proj']);
    assert.equal((await call(o.port, 'POST', '/api/favourite', { key, body: { folder: 'proj', project: true, on: false } })).status, 200);
    assert.deepEqual((await state()).favProjects, []);

    for (const folder of ['__proto__', 'constructor', 'toString']) {
      for (const [at, body] of [['/api/nickname', { folder, seat: 1, nick: 'Sneaky' }], ['/api/favourite', { folder, seat: 1, on: true }], ['/api/favourite', { folder, project: true, on: true }]]) {
        const r = await call(o.port, 'POST', at, { key, body });
        assert.equal(r.status, 400, `${at} ${JSON.stringify(body)}`);
        assert.match(r.json.error.fault, /cannot be kept/);
      }
    }
    assert.deepEqual((await state()).favProjects, [], 'no odd project kept');
    assert.ok(o.alive());
  } finally {
    await o.done();
  }
});

test('Needs attention, the shop and the hook script over HTTP: done, buy and a permission prompt from hook.mjs', async () => {
  const now = Date.now();
  const o = await scratchOffice((h) => {
    // The office opened a day ago, so the tokens written since count for the shop.
    fs.mkdirSync(h.data, { recursive: true });
    fs.writeFileSync(path.join(h.data, 'settings.json'), JSON.stringify({ openedAt: new Date(now - 24 * 3600000).toISOString() }));
    lines('t-ask', now - 10 * 60000).prompt(0, 'go').reply(1, 'Shall I carry on?', 300000).write(path.join(h.transcripts, 'C--Work-projects', 't-ask.jsonl'));
    lines('t-work', now - 2 * 60000).prompt(0, 'run it').tool(1, 'Bash', { command: 'npm test', description: 'Run the tests' }, 10).write(path.join(h.transcripts, 'C--Work-projects', 't-work.jsonl'));
  });
  try {
    const key = await pageKey(o.port);
    const state = async () => (await call(o.port, 'GET', '/api/state', { key })).json;
    let s = await state();
    assert.ok(s.waiting.some((w) => w.id === 't-ask'), `t-ask needs you: ${JSON.stringify(s.waiting)}`);
    assert.equal(s.earned, 300010);

    // Done: off the list, kept in done.json; a thread the office does not know is a 404.
    const done = await call(o.port, 'POST', '/api/done', { key, body: { id: 't-ask' } });
    assert.equal(done.status, 200);
    assert.ok(!(await state()).waiting.some((w) => w.id === 't-ask'), 'off Needs attention');
    assert.ok(Object.hasOwn(readJson(path.join(o.data, 'done.json')), 't-ask'));
    for (const id of ['no-such-thread', '__proto__', '']) assert.equal((await call(o.port, 'POST', '/api/done', { key, body: { id } })).status, 404, `id ${JSON.stringify(id)}`);

    // The shop: 300,010 tokens buy one coffee round (200,000), not two; unknown items are refused.
    const coffee = await call(o.port, 'POST', '/api/buy', { key, body: { item: 'coffee' } });
    assert.equal(coffee.status, 200, coffee.text);
    assert.equal(coffee.json.item, 'coffee');
    assert.deepEqual(coffee.json.shop.purse, { earned: 300010, spent: 200000, left: 100010 });
    assert.deepEqual(readJson(path.join(o.data, 'office.json')).bought.map((b) => b.item), ['coffee']);
    const again = await call(o.port, 'POST', '/api/buy', { key, body: { item: 'coffee' } });
    assert.equal(again.status, 409);
    assert.match(again.json.error.fault, /Not enough tokens/);
    for (const item of ['yacht', '__proto__', '']) {
      const r = await call(o.port, 'POST', '/api/buy', { key, body: { item } });
      assert.equal(r.status, 409, `item ${JSON.stringify(item)}`);
      assert.match(r.json.error.fault, /not in the shop/);
    }
    assert.equal(readJson(path.join(o.data, 'office.json')).bought.length, 1, 'nothing else was bought');

    // hook.mjs, as Claude runs it: prints nothing on stdout or stderr, ends with 0, and the person needs you at once.
    const t = spawnSync(process.execPath, [HOOK, String(o.port), '--ai-office-overview-hook'], {
      input: JSON.stringify({ hook_event_name: 'Notification', session_id: 't-work', message: 'Claude needs your permission to use Bash' }),
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(t.status, 0);
    assert.equal(t.stdout, '', 'nothing on stdout');
    assert.equal(t.stderr, '', 'nothing on stderr');
    s = await state();
    const worker = s.people.find((p) => p.thread?.id === 't-work');
    assert.equal(worker?.state, 'needs', JSON.stringify(worker));
    assert.equal(worker.words, 'Waiting for your permission');
    assert.ok(s.setup.lastHookAt > 0, 'the setup tab sees the hook');
    assert.ok(Object.hasOwn(readJson(path.join(o.data, 'hooks.json')), 't-work'));

    // The hook route straight (no key needed), and a body that is not JSON.
    assert.equal((await call(o.port, 'POST', '/api/hook', { body: { event: 'UserPromptSubmit', session: 't-ask' } })).status, 200);
    const asker = (await state()).people.find((p) => p.thread?.id === 't-ask');
    assert.equal(asker?.state, 'working', JSON.stringify(asker));
    assert.equal(asker.words, 'Reading your message');
    assert.equal((await call(o.port, 'POST', '/api/hook', { raw: 'not json' })).status, 400);
    assert.ok(o.alive());
  } finally {
    await o.done();
  }
});

test('hook.mjs with the office closed: ends with 0 and prints nothing on stdout or stderr', async () => {
  const port = await freePort();
  for (const input of [JSON.stringify({ hook_event_name: 'Stop', session_id: 'x' }), 'not json', '']) {
    const r = spawnSync(process.execPath, [HOOK, String(port), '--ai-office-overview-hook'], { input, encoding: 'utf8', timeout: 5000 });
    assert.equal(r.status, 0, `input ${JSON.stringify(input)}`);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  }
});

test('advanced setup over HTTP: only the temp settings file changes, what was there is kept, and it comes off again', async () => {
  const BEEPS = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: '[console]::beep(659,90)', shell: 'powershell', timeout: 5 }] }] } };
  const o = await scratchOffice((h) => fs.writeFileSync(h.settings, `${JSON.stringify(BEEPS, null, 2)}\n`));
  try {
    const file = o.h.settings;
    const key = await pageKey(o.port);
    const s = (await call(o.port, 'GET', '/api/state', { key })).json.setup;
    assert.equal(path.resolve(s.settingsFile), path.resolve(file), 'the office reads the temp settings file');
    assert.equal(s.mode, 'easy');

    assert.equal((await call(o.port, 'POST', '/api/setup', { body: { advanced: true } })).status, 403, 'without the key');
    assert.deepEqual(readJson(file), BEEPS);

    const on = await call(o.port, 'POST', '/api/setup', { key, body: { advanced: true } });
    assert.equal(on.status, 200, on.text);
    assert.equal(on.json.status.mode, 'advanced');
    assert.equal(on.json.status.hookHere, true);
    assert.ok(on.json.backup && path.dirname(path.resolve(on.json.backup)) === path.dirname(path.resolve(file)), 'the copy is beside the temp file');
    assert.deepEqual(readJson(on.json.backup), BEEPS);
    const now = readJson(file);
    assert.equal(now.model, 'opus');
    assert.deepEqual(now.hooks.Stop[0], BEEPS.hooks.Stop[0], 'the beep stays first');
    for (const ev of ['UserPromptSubmit', 'Notification', 'Stop']) {
      const ours = now.hooks[ev].at(-1).hooks[0];
      assert.match(ours.command, new RegExp(`hook\\.mjs" ${o.port} --ai-office-overview-hook$`), ev);
      assert.equal(ours.timeout, 3);
    }
    assert.equal((await call(o.port, 'GET', '/api/state', { key })).json.setup.mode, 'advanced');

    const off = await call(o.port, 'POST', '/api/setup', { key, body: { advanced: false } });
    assert.equal(off.status, 200, off.text);
    assert.equal(off.json.status.mode, 'easy');
    assert.deepEqual(readJson(file), BEEPS, 'back as it was');

    fs.writeFileSync(file, '{ "hooks": ');
    const bad = await call(o.port, 'POST', '/api/setup', { key, body: { advanced: true } });
    assert.equal(bad.status, 409);
    assert.match(bad.json.error.fault, /could not be read/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{ "hooks": ', 'a damaged file is not touched');
    assert.ok(o.alive());
  } finally {
    await o.done();
  }
});

// Check, take (pull) and restart act on the office's own folder (a git fetch from GitHub, a merge, a new office): a
// scratch office is a test copy and refuses all three, which is what is tested here. Taking an update itself is tested
// against little repositories in update.test.mjs.
test('Setup › Update in a test copy: check, take and restart are refused with a way out, and the office keeps running', async () => {
  const o = await scratchOffice();
  try {
    const key = await pageKey(o.port);
    for (const at of ['/api/update/check', '/api/update/pull', '/api/update/restart']) {
      assert.equal((await call(o.port, 'POST', at, { body: {} })).status, 403, `${at} without the key`);
      const r = await call(o.port, 'POST', at, { key, body: {} });
      assert.equal(r.status, 409, at);
      assert.match(r.json.error.fault, /test copy does not update/);
      assert.ok(r.json.error.wayOut);
    }
    await new Promise((r) => setTimeout(r, 500));
    assert.ok(o.alive(), 'restart refused: still running');
    assert.equal((await call(o.port, 'GET', '/api/state', { key })).status, 200);
  } finally {
    await o.done();
  }
});
