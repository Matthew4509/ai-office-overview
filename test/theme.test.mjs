// The page's colours: public/sun.js (the Auto theme: sunrise and sunset close to the published times, the polar days,
// where a time zone puts the sun), the theme kept in the office settings, and the page served in it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Office } from '../src/office.mjs';
import { settings, status, theme } from '../src/setup.mjs';
import { tempHome } from './helpers.mjs';

const sun = (() => { const m = { exports: {} }; new Function('module', fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'sun.js'), 'utf8'))(m); return m.exports; })();
// Minutes past midnight UTC of a time in ms.
const utcMin = (ms) => { const d = new Date(ms); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const near = (got, want, slack, what) => assert.ok(Math.abs(got - want) <= slack, `${what}: ${got} minutes, expected about ${want}`);

test('London at the June solstice: up about 03:43 UTC, down about 20:21 UTC (within 10 minutes)', () => {
  const t = sun.times(Date.UTC(2026, 5, 21, 12), 51.51, -0.13);
  near(utcMin(t.rise), 223, 10, 'sunrise');
  near(utcMin(t.set), 1221, 10, 'sunset');
});

test('Sydney at the December solstice: a day of about 14 h 25 min', () => {
  const t = sun.times(Date.UTC(2026, 11, 21, 2), -33.87, 151.21);
  near(Math.round((t.set - t.rise) / 60000), 865, 12, 'day length');
});

test('a zone ahead of UTC by 13 hours (Auckland in summer) gets its own day: light at 10:00 and 14:00 local', () => {
  const TZ = process.env.TZ;
  process.env.TZ = 'Pacific/Auckland';
  try {
    const at10 = Date.UTC(2026, 0, 14, 21); // 15 Jan 10:00 in Auckland (UTC+13)
    const t = sun.times(at10, -36.85, 174.76);
    // Published: up about 06:15 and down about 20:45 local, that is 17:15 and 07:45 UTC.
    near(utcMin(t.rise), 17 * 60 + 15, 15, 'sunrise');
    near(utcMin(t.set), 7 * 60 + 45, 15, 'sunset');
    assert.ok(t.rise < at10 && at10 < t.set, 'the sun is up at 10:00');
    assert.ok(t.set > at10 + 4 * 3600000, 'and still up at 14:00');
  } finally {
    if (TZ === undefined) delete process.env.TZ; else process.env.TZ = TZ;
  }
});

test('the far north: no sunset in June, no sunrise in December', () => {
  assert.equal(sun.times(Date.UTC(2026, 5, 21, 12), 78, 15).polar, 'day');
  assert.equal(sun.times(Date.UTC(2026, 11, 21, 12), 78, 15).polar, 'night');
});

test('a listed zone gives its city; an unlisted one a rough place from its region', () => {
  const s = sun.place('Australia/Sydney');
  assert.ok(s.city === 'Sydney' && !s.rough && s.lat < 0, JSON.stringify(s));
  const r = sun.place('Europe/Nowhere');
  assert.ok(r.rough && r.lat === 50 && r.city === 'Nowhere', JSON.stringify(r));
});

test('Auto means light or dark; the other choices stay as they are', () => {
  assert.ok(['light', 'dark'].includes(sun.resolve('auto')));
  for (const c of ['light', 'dark', 'system']) assert.equal(sun.resolve(c), c);
});

test('the theme is kept in the office settings: auto, dark, light or system, and nothing else', () => {
  const h = tempHome();
  process.env.AI_OFFICE_SETTINGS = path.join(h.dir, 'settings.json');
  try {
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    assert.equal(status(office).theme, '');
    assert.equal(theme(office), 'light', 'light (day) until one is chosen');
    assert.equal(settings(office, { theme: 'dark' }).ok, true);
    assert.equal(status(office).theme, 'dark');
    assert.equal(JSON.parse(fs.readFileSync(path.join(h.data, 'settings.json'), 'utf8')).theme, 'dark');
    const bad = settings(office, { theme: '"><script>' });
    assert.match(bad.error.fault, /theme/);
    assert.equal(theme(office), 'dark', 'a refused theme leaves the one chosen before');
    assert.equal(settings(office, { theme: 'system' }).ok, true);
    assert.equal(new Office({ dataDir: h.data, transcriptsDir: h.transcripts }).settings.theme, 'system', 'read back after a restart');
  } finally {
    delete process.env.AI_OFFICE_SETTINGS;
    h.done();
  }
});

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

test('the page comes in its theme on <html>: light until one is chosen, then the one chosen (Auto as light or dark)', async () => {
  const h = tempHome();
  const port = await freePort();
  const file = path.join(h.dir, 'settings.json');
  fs.writeFileSync(file, '{}\n');
  // A scratch office: its own port, data, transcripts and AI-app settings, never the real ones.
  const child = spawn(process.execPath, [path.join(import.meta.dirname, '..', 'server.mjs')], {
    env: { ...process.env, PORT: String(port), AI_OFFICE_DATA: h.data, AI_OFFICE_TRANSCRIPTS: h.transcripts, AI_OFFICE_SETTINGS: file, AI_OFFICE_OPEN: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    let out = '';
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`the office did not open: ${out}`)), 10000);
      child.stdout.on('data', (c) => { out += c; if (out.includes('All transcripts read')) { clearTimeout(t); resolve(); } });
      child.stderr.on('data', (c) => { out += c; });
      child.on('exit', (code) => { clearTimeout(t); reject(new Error(`the office ended (${code}): ${out}`)); });
    });
    const base = `http://127.0.0.1:${port}`;
    const tag = async (at = '/') => (await (await fetch(base + at)).text()).match(/<html lang="en" data-theme-choice="(\w+)" data-theme="(\w+)">/)?.slice(1);
    const key = /<meta name="ai-office-key" content="([^"]+)">/.exec(await (await fetch(base)).text())[1];
    const choose = (t) => fetch(`${base}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ai-office-key': key }, body: JSON.stringify({ theme: t }) });
    assert.deepEqual(await tag(), ['light', 'light']);
    assert.equal((await choose('dark')).status, 200);
    assert.deepEqual(await tag(), ['dark', 'dark']);
    assert.deepEqual(await tag('/index.html'), ['dark', 'dark'], 'the page by its own name too');
    assert.equal((await choose('purple')).status, 400);
    assert.deepEqual(await tag(), ['dark', 'dark']);
    await choose('auto');
    const [choice, shown] = await tag();
    assert.equal(choice, 'auto');
    assert.equal(shown, sun.resolve('auto'));
    assert.ok((await (await fetch(`${base}/sun.js`)).text()).includes('officeSun'), 'sun.js is served for the page');
  } finally {
    child.removeAllListeners('exit');
    await new Promise((resolve) => { child.on('exit', resolve); child.kill(); });
    h.done();
  }
});
