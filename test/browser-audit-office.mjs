// Browser audit of the office page (not part of npm test): a scratch office over made-up transcripts, driven in headless
// Edge over the DevTools protocol with Node's own WebSocket and fetch. Run: node test/browser-audit-office.mjs
// A P0 check that fails sets exit code 1; a P1 check prints an "info" line instead of failing.
//   EDGE   path to msedge.exe (default: the usual install place)
//   CDP_PORT  the DevTools port (default 9345)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { tempHome, startOffice } from './helpers.mjs';

const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = Number(process.env.CDP_PORT) || 9345;
let failed = 0;
const pass = (id, what) => console.log(`ok    ${id}: ${what}`);
const fail = (id, what) => { failed++; console.log(`FAIL  ${id}: ${what}`); };
const info = (id, what) => console.log(`info  ${id} (P1): ${what}`);

const h = tempHome();
const now = Date.now();
const iso = (m) => new Date(now + m * 60000).toISOString();
const id1 = 'b0000001-0000-4000-8000-000000000001';
const id2 = 'b0000002-0000-4000-8000-000000000002';
const dir = path.join(h.transcripts, 'C--Work-projects');
const line = (o) => JSON.stringify(o);
// Thread 1: a reply with HTML and script in it, a custom title with markup, and a question at the end.
fs.writeFileSync(path.join(dir, `${id1}.jsonl`), [
  line({ type: 'custom-title', customTitle: '<img src=x onerror="window.__pwned=1">Title', sessionId: id1 }),
  line({ type: 'user', timestamp: iso(-5), cwd: 'C:\\Work\\projects', sessionId: id1, message: { role: 'user', content: '<script>window.__pwned=2</script> hello' } }),
  line({ type: 'assistant', timestamp: iso(-4), cwd: 'C:\\Work\\projects', sessionId: id1, message: { id: 'm1', stop_reason: 'end_turn', usage: { output_tokens: 5 }, content: [{ type: 'text', text: '<b onmouseover="window.__pwned=3">bold</b>\nShall I go on with <i>this</i>?' }] } }),
].join('\n') + '\n');
// Thread 2: at work right now, running a command whose description holds a marker word from the thread.
fs.writeFileSync(path.join(dir, `${id2}.jsonl`), [
  line({ type: 'user', timestamp: iso(-1), cwd: 'C:\\Work\\projects', sessionId: id2, message: { role: 'user', content: 'go' } }),
  line({ type: 'assistant', timestamp: iso(-0.1), cwd: 'C:\\Work\\projects', sessionId: id2, message: { id: 'm2', stop_reason: 'tool_use', usage: { output_tokens: 5 }, content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm run build', description: 'Build the Zanzibarquartz client invoice tool' } }] } }),
].join('\n') + '\n');

const office = await startOffice(h);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aoo-edge-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
console.log(`office pid ${office.child.pid} port ${office.port}; edge pid ${edge.pid} cdp ${CDP_PORT}`);

let ws, seq = 0;
const waiting = new Map();
const errors = [];
function cdp(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
}
const js = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (k, code = k, extra = {}) => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: { Tab: 9, Escape: 27, ArrowRight: 39, ArrowLeft: 37, Enter: 13 }[k] || 0, ...extra })
  .then(() => cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: { Tab: 9, Escape: 27, ArrowRight: 39, ArrowLeft: 37, Enter: 13 }[k] || 0, ...extra }));

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(250); }
  }
  if (!target) throw new Error('headless Edge did not open its DevTools port');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { const w = waiting.get(d.id); waiting.delete(d.id); d.error ? w.reject(new Error(d.error.message)) : w.resolve(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 760, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${office.port}/` });
  await sleep(4500);

  // B1: transcript text (titles, messages, questions) is shown as letters and never run as HTML.
  await js(`document.getElementById('tab-list').click()`);
  await sleep(800);
  const pwned = await js('window.__pwned || 0');
  const injected = await js(`document.querySelectorAll('img[src="x"], b[onmouseover], #side-needs i').length`);
  const shown = await js(`document.body.innerText.includes('Shall I go on with <i>this</i>?')`);
  if (!pwned && !injected && shown) pass('B1', 'transcript HTML shown as text, never run');
  else fail('B1', `transcript text ran as HTML (flag ${pwned}, elements ${injected}, question shown as text ${shown})`);

  // B2: Needs attention lists the thread that asked.
  const needs = await js(`document.getElementById('side-needs').innerText`);
  if (/Shall I go on/.test(needs)) pass('B2', 'Needs attention lists the question'); else fail('B2', 'the question is not on Needs attention');

  // B3: no horizontal scroll at 1000 px and at phone width.
  for (const [w, hgt] of [[1000, 760], [375, 812]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: hgt, deviceScaleFactor: 1, mobile: w < 600 });
    await sleep(1200);
    const sw = await js('document.documentElement.scrollWidth');
    if (sw <= w + 1) pass('B3', `no sideways scroll at ${w} px`); else fail('B3', `the page is ${sw} px wide in a ${w} px window`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 760, deviceScaleFactor: 1, mobile: false });
  await js(`document.getElementById('tab-office').click()`);
  await sleep(800);

  // B4: the view tab strip is one Tab stop, and the arrow keys move along it.
  await js(`document.getElementById('tab-office').focus()`);
  await key('ArrowRight', 'ArrowRight');
  await sleep(300);
  const moved = await js(`[document.activeElement?.id, document.getElementById('tab-list').getAttribute('aria-selected'), [...document.querySelectorAll('.view-tabs [role=tab]')].filter(t => t.tabIndex === 0).length]`);
  if (moved[0] === 'tab-list' && moved[1] === 'true' && moved[2] === 1) pass('B4', 'arrow keys move along the view tabs, one Tab stop');
  else fail('B4', `arrow keys on the view tabs: focus ${moved[0]}, List chosen ${moved[1]}, Tab stops ${moved[2]}`);
  await js(`document.getElementById('tab-office').click()`);

  // B5: Setup opens with the focus inside, and Escape closes it with the focus back on the gear.
  await js(`document.getElementById('open-setup').focus(); document.getElementById('open-setup').click()`);
  await sleep(700);
  const inside = await js(`!document.getElementById('setup').hidden && document.getElementById('setup').contains(document.activeElement)`);
  await key('Escape', 'Escape');
  await sleep(700);
  const closed = await js(`[document.getElementById('setup').hidden, document.activeElement?.id]`);
  if (inside && closed[0] && closed[1] === 'open-setup') pass('B5', 'Setup takes the focus, Escape closes it and gives the focus back');
  else fail('B5', `Setup: focus inside ${inside}, closed by Escape ${closed[0]}, focus after ${closed[1]}`);

  // B6 (P1): Thoughts shows no words from the threads beyond a file's short name (a command's description is the AI's
  // own text from the transcript).
  // The words are picked at random from a few templates, most of which carry the description: a few loads are looked at.
  let thoughts = '';
  for (let i = 0; i < 6 && !/Zanzibarquartz/i.test(thoughts); i++) {
    if (i) { await cdp('Page.reload'); }
    await sleep(4000);
    thoughts += ` ${await js(`[...document.querySelectorAll('.thoughts')].map(n => n.innerText).join(' | ')`)}`;
  }
  if (/Zanzibarquartz/i.test(thoughts || '')) info('B6', 'Thoughts shows a command description written in the thread');
  else pass('B6', `Thoughts shows no thread words (${(thoughts || 'empty').slice(0, 60).replace(/\s+/g, ' ')})`);

  // B7: no script errors on the page.
  if (!errors.length) pass('B7', 'no script errors'); else fail('B7', `script errors: ${errors.slice(0, 3).join(' / ')}`);
} catch (e) {
  fail('setup', e.message);
} finally {
  try { ws?.close(); } catch { /* gone */ }
  // Edge's own helper processes go with it: its tree, by its process id.
  try { spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ }
  await office.stop();
  await sleep(1500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Edge may still hold it for a moment */ }
  h.done();
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exitCode = failed ? 1 : 0;
