// Made-up transcripts for the tests, written into a temp folder that each test removes; and a scratch office on a port of
// its own, with every place it reads or writes in that temp folder.

import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = 'C:\\Work\\projects';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SERVER = path.join(HERE, '..', 'server.mjs');
export const HOOK = path.join(HERE, '..', 'hook.mjs');

/** The places outside the office's own data folder that the code under test can reach: the desktop app's thread
 * records, Claude's settings file (advanced setup) and the shortcut folders. They always point into a temp folder. */
const GUARDED = ['AI_OFFICE_APP_SESSIONS', 'AI_OFFICE_SETTINGS', 'AI_OFFICE_SHORTCUT_DIR'];
// A test file that loads this one gets them pointed somewhere harmless from the start, even outside a tempHome(): a
// folder in temp that is never made, so nothing real is read and nothing at all is found there.
const GUARD = path.join(os.tmpdir(), `ai-office-test-guard-${process.pid}`);
const GUARD_PLACES = { AI_OFFICE_APP_SESSIONS: path.join(GUARD, 'app-sessions'), AI_OFFICE_SETTINGS: path.join(GUARD, 'settings.json'), AI_OFFICE_SHORTCUT_DIR: path.join(GUARD, 'shortcuts') };
for (const k of GUARDED) if (!process.env[k]) process.env[k] = GUARD_PLACES[k];

/**
 * A temp home with transcripts/ and data/; call done() to remove it. Until then the desktop app's records, Claude's
 * settings file and the shortcut folders are temp ones in it too (a test may point one elsewhere in temp), and done()
 * puts back what they were before.
 */
export function tempHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-test-'));
  const transcripts = path.join(dir, 'transcripts');
  const data = path.join(dir, 'data');
  fs.mkdirSync(path.join(transcripts, 'C--Work-projects'), { recursive: true });
  const before = Object.fromEntries(GUARDED.map((k) => [k, process.env[k]]));
  const appSessions = path.join(dir, 'app-sessions');
  const settings = path.join(dir, 'claude-settings.json');
  const shortcuts = path.join(dir, 'shortcuts');
  process.env.AI_OFFICE_APP_SESSIONS = appSessions;
  process.env.AI_OFFICE_SETTINGS = settings;
  process.env.AI_OFFICE_SHORTCUT_DIR = shortcuts;
  return {
    dir, transcripts, data, appSessions, settings, shortcuts,
    done: () => {
      for (const k of GUARDED) {
        if (before[k] === undefined) delete process.env[k];
        else process.env[k] = before[k];
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A port nobody listens on just now (never 8860, where the real office runs). Another program can still take it before
 * the office does: startOffice() then tries again with another. */
export async function freePort() {
  for (;;) {
    const port = await new Promise((resolve, reject) => {
      const s = net.createServer();
      s.on('error', reject);
      s.listen(0, '127.0.0.1', () => { const { port: p } = s.address(); s.close(() => resolve(p)); });
    });
    if (port !== 8860) return port;
  }
}

/**
 * Starts a scratch office over the temp home h and waits until every transcript is read. Its data, transcripts, the
 * desktop app's records, Claude's settings file and the shortcut folders are all in temp (it refuses to start otherwise),
 * and it may not update itself. A port taken between freePort() and the start is tried again with a fresh one.
 * env: more settings for the office (for example AI_OFFICE_SETTINGS pointed at another temp file).
 */
export async function startOffice(h, env = {}) {
  const tmp = path.resolve(os.tmpdir()).toLowerCase();
  let lastOut = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const port = await freePort();
    const childEnv = {
      ...process.env,
      PORT: String(port),
      AI_OFFICE_DATA: h.data,
      AI_OFFICE_TRANSCRIPTS: h.transcripts,
      AI_OFFICE_APP_SESSIONS: process.env.AI_OFFICE_APP_SESSIONS,
      AI_OFFICE_SETTINGS: process.env.AI_OFFICE_SETTINGS,
      AI_OFFICE_SHORTCUT_DIR: process.env.AI_OFFICE_SHORTCUT_DIR,
      AI_OFFICE_OPEN: '0',
      ...env,
    };
    if (!('AI_OFFICE_UPDATE_TEST' in env)) delete childEnv.AI_OFFICE_UPDATE_TEST;
    for (const k of ['AI_OFFICE_DATA', 'AI_OFFICE_TRANSCRIPTS', ...GUARDED]) {
      const v = path.resolve(String(childEnv[k] || '')).toLowerCase();
      if (!childEnv[k] || !v.startsWith(tmp + path.sep.toLowerCase())) throw new Error(`a scratch office needs ${k} in the temp folder, not ${childEnv[k]}`);
    }
    const child = spawn(process.execPath, [SERVER], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    const how = await new Promise((resolve) => {
      const t = setTimeout(() => resolve('slow'), 15000);
      child.stdout.on('data', () => { if (out.includes('All transcripts read')) { clearTimeout(t); resolve('up'); } });
      // 'close', not 'exit': by then everything it wrote (the port-in-use line) has come in.
      child.on('close', () => { clearTimeout(t); resolve('ended'); });
    });
    child.removeAllListeners('close');
    if (how === 'up') {
      return {
        port,
        child,
        out: () => out,
        alive: () => child.exitCode === null && child.signalCode === null,
        stop: () => new Promise((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
          child.on('exit', () => resolve());
          child.kill();
        }),
      };
    }
    lastOut = out;
    if (how === 'ended' && /already in use/.test(out)) continue; // another program took the port first
    if (how === 'slow') await new Promise((resolve) => { child.on('exit', resolve); child.kill(); });
    throw new Error(how === 'slow' ? `the office did not open: ${out}` : `the office ended (${child.exitCode}): ${out}`);
  }
  throw new Error(`no free port after 5 tries: ${lastOut}`);
}

/** Builds transcript lines. `at` is minutes after a fixed start. */
export function lines(id, base = Date.parse('2026-10-12T00:00:00Z')) {
  const out = [];
  const ts = (m) => new Date(base + m * 60000).toISOString();
  let n = 0;
  const api = {
    prompt(m, text, cwd = ROOT) { out.push({ type: 'user', timestamp: ts(m), cwd, sessionId: id, message: { role: 'user', content: text } }); return api; },
    tool(m, name, input, outTokens = 10, cwd = ROOT) {
      out.push({ type: 'assistant', timestamp: ts(m), cwd, sessionId: id, message: { id: `msg${++n}`, stop_reason: 'tool_use', usage: { output_tokens: outTokens }, content: [{ type: 'tool_use', name, input }] } });
      out.push({ type: 'user', timestamp: ts(m + 0.01), cwd, sessionId: id, message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } });
      return api;
    },
    reply(m, text, outTokens = 20, cwd = ROOT) {
      out.push({ type: 'assistant', timestamp: ts(m), cwd, sessionId: id, message: { id: `msg${++n}`, stop_reason: 'end_turn', usage: { output_tokens: outTokens }, content: [{ type: 'text', text }] } });
      return api;
    },
    title(t) { out.push({ type: 'custom-title', customTitle: t, sessionId: id }); return api; },
    raw(l) { out.push(l); return api; },
    text() { return out.map((l) => JSON.stringify(l)).join('\n') + '\n'; },
    write(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, api.text()); return api; },
  };
  return api;
}
