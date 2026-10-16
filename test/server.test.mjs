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
    const state = await raw(o.port, `GET /api/state HTTP/1.1\r\nHost: 127.0.0.1:${o.port}\r\nConnection: close\r\n\r\n`);
    assert.match(state, /^HTTP\/1\.1 200 /, 'and still answers its page');
  } finally {
    await o.done();
  }
});
