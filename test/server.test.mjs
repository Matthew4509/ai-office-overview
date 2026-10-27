import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { tempHome } from './helpers.mjs';

const SERVER = path.join(import.meta.dirname, '..', 'server.mjs');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

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

/** A scratch office on its own port, with its own data, transcripts and AI-app settings: never the real ones. */
async function scratchOffice() {
  const h = tempHome();
  const port = await freePort();
  const settings = path.join(h.dir, 'settings.json');
  fs.writeFileSync(settings, '{}\n');
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), AI_OFFICE_DATA: h.data, AI_OFFICE_TRANSCRIPTS: h.transcripts, AI_OFFICE_SETTINGS: settings, AI_OFFICE_OPEN: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.on('data', (c) => { out += c; });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`the office did not open: ${out}`)), 10000);
    const look = () => { if (out.includes('All transcripts read')) { clearTimeout(t); resolve(); } };
    child.stdout.on('data', look);
    child.on('exit', (code) => { clearTimeout(t); reject(new Error(`the office ended (${code}): ${out}`)); });
  });
  child.removeAllListeners('exit');
  return {
    port,
    child,
    data: h.data,
    alive: () => child.exitCode === null && child.signalCode === null,
    done: () => new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) { h.done(); resolve(); return; }
      child.on('exit', () => { h.done(); resolve(); });
      child.kill();
    }),
  };
}

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

/** The key the page was served with (the meta line in index.html). */
async function pageKey(port) {
  const page = await raw(port, `GET / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
  const m = /<meta name="ai-office-key" content="([^"]+)">/.exec(page);
  assert.ok(m, 'the page carries a key');
  assert.notEqual(m[1], '__AI_OFFICE_KEY__', 'the key is filled in');
  return m[1];
}

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
  const { spawnSync } = await import('node:child_process');
  const env = { ...process.env, PORT: String(o.port), AI_OFFICE_DATA: o.data };
  try {
    assert.ok(fs.existsSync(path.join(o.data, 'run.json')), 'the run file is written at start');
    const st = spawnSync(process.execPath, [SERVER, '--status'], { env, encoding: 'utf8' });
    assert.equal(st.status, 0, st.stdout + st.stderr);
    assert.match(st.stdout, new RegExp(`running: http://127\\.0\\.0\\.1:${o.port}/`));
    // A second office over the same data folder is refused.
    const twice = spawnSync(process.execPath, [SERVER], { env: { ...env, PORT: String(o.port + 1) }, encoding: 'utf8', timeout: 15000 });
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
