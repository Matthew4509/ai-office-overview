// Made-up transcripts for the tests, written into a temp folder that each test removes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ROOT = 'C:\\Work\\projects';

/** A temp home with transcripts/ and data/; call done() to remove it. */
export function tempHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-test-'));
  const transcripts = path.join(dir, 'transcripts');
  const data = path.join(dir, 'data');
  fs.mkdirSync(path.join(transcripts, 'C--Work-projects'), { recursive: true });
  // The desktop app's thread records (the open-thread button): a made-up folder, never the real one.
  process.env.AI_OFFICE_APP_SESSIONS = path.join(dir, 'app-sessions');
  return { dir, transcripts, data, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
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
