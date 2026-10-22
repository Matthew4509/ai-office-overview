// AI Office Overview: a small server on this PC only (127.0.0.1). It reads the AI app's transcripts every few seconds and
// serves the office page. Nothing is sent anywhere. Start: node server.mjs (or Start AI Office Overview.cmd).
//   PORT                     default 8860
//   AI_OFFICE_DATA       where the office keeps its own files (default: data/ beside this file)
//   AI_OFFICE_TRANSCRIPTS where the AI app keeps transcripts (default: its projects folder in the home folder)

import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Office, safeKey } from './src/office.mjs';
import { shopOf, buy } from './src/shop.mjs';
import * as setup from './src/setup.mjs';
import * as update from './src/update.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8860;
const dataDir = process.env.AI_OFFICE_DATA || path.join(here, 'data');
const office = new Office({ dataDir, transcriptsDir: process.env.AI_OFFICE_TRANSCRIPTS });
const PUBLIC = path.join(here, 'public');
// The page's sun reckoning (public/sun.js), also run here so the page comes in its colours. It is written for the page and
// for CommonJS, and this folder is ES modules, so it is run with a module object of its own.
const SUN = (() => { const m = { exports: {} }; new Function('module', fs.readFileSync(path.join(PUBLIC, 'sun.js'), 'utf8'))(m); return m.exports; })();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const SCAN_MS = 3000;
const VERSION = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8')).version;
// A test copy (its own data or transcripts folder) runs from the same folder as the real office, so only the real one updates it.
const TEST_COPY = !!(process.env.AI_OFFICE_DATA || process.env.AI_OFFICE_TRANSCRIPTS) && process.env.AI_OFFICE_UPDATE_TEST !== '1';
const notHere = () => (TEST_COPY ? { error: { fault: 'A test copy does not update.', reason: 'It runs from the same folder as your real office.', wayOut: 'Open the real office and use Setup › Update there.' } } : null);
/** One update step at a time: a second press waits for the first. */
let updating = null;
const once = (job) => { if (!updating) updating = job().finally(() => { updating = null; }); return updating; };
// Restart waits while an update is being taken (a second tab could stop the office half way through it).
const midUpdate = () => (update.taking() ? { error: { fault: 'The office cannot restart just now.', reason: 'It is taking an update, and stopping half way could leave its folder between two versions.', wayOut: 'Wait a minute for it to finish, then try again.' } } : null);

// A folder called __proto__, constructor or prototype would reach the object every map is built on: never kept.
const badFolder = (res) => fail(res, 400, 'That folder name cannot be kept.', 'The office keeps __proto__, constructor and prototype for itself.', 'Rename the folder, or leave this one without a name or star.');

let lastScanError = '';
/** While the first read is going: how far it has got ({ done, total, first }); null once every transcript is read. */
let loading = null;
function tick() {
  if (loading) return;
  try {
    office.scan();
    office.snapshot(); // keeps the ledger up to date even when no page is open
    office.save();
    lastScanError = '';
  } catch (e) {
    lastScanError = String(e?.message || e);
    console.error('[scan]', e);
  }
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  });
  res.end(data);
}

function fail(res, code, fault, reason, wayOut) {
  send(res, code, { error: { fault, reason, wayOut } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (c) => {
      size += c.length;
      // Over the limit: the rest is read and dropped, so the page gets an answer (a cut connection would not say why).
      if (size > 16 * 1024) { parts.length = 0; reject(new Error('The request was too big: over 16 KB.')); return; }
      parts.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { reject(new Error('not json')); }
    });
    req.on('error', reject);
  });
}

/** Only this PC may talk to the office: other pages in the browser cannot (no CORS, JSON only, our Host only). */
function allowed(req) {
  const host = String(req.headers.host || '').toLowerCase();
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return false;
  if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) return false;
  return true;
}

const server = http.createServer(async (req, res) => {
  if (!allowed(req)) return fail(res, 403, 'That request was turned away.', 'The office only answers its own page on this PC.', `Open http://127.0.0.1:${PORT}/ instead.`);
  let url;
  try { url = new URL(req.url, `http://127.0.0.1:${PORT}`); } catch {
    return fail(res, 400, 'That address could not be read.', 'It is not a web address the office understands.', `Open http://127.0.0.1:${PORT}/ instead.`);
  }
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const s = office.snapshot({ preview: !!loading });
      return send(res, 200, { ...s, loading, shop: shopOf(office, s.earned), scanError: lastScanError, setup: setup.status(office), version: VERSION });
    }
    if (req.method === 'POST' && url.pathname === '/api/nickname') {
      const b = await readBody(req);
      if (!safeKey(b.folder)) return badFolder(res);
      office.setNickname(b.folder ?? '', b.seat, b.nick);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/favourite') {
      // A star on a person ({ folder, seat, on }) or a whole project ({ folder, project: true, on }); or an old
      // favourite hidden from the Favourites tab and the beach ({ folder, seat, hidden }).
      const b = await readBody(req);
      if (!safeKey(b.folder)) return badFolder(res);
      if (typeof b.hidden === 'boolean') office.setFavouriteHidden(b.folder ?? '', b.seat, b.hidden);
      else if (b.project === true) office.setFavouriteProject(b.folder ?? '', !!b.on);
      else office.setFavourite(b.folder ?? '', b.seat, !!b.on);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/edit') {
      // EDIT on a card: the seat's nickname and look together. look: an object, or null for the made-up look again.
      const b = await readBody(req);
      if (!safeKey(b.folder)) return badFolder(res);
      if (b.look !== undefined && !office.setLook(b.folder ?? '', b.seat, b.look)) return fail(res, 400, 'That look could not be kept.', 'One of its parts is not one the office knows.', 'Pick the parts again in the editor, then save.');
      if (b.nick !== undefined) office.setNickname(b.folder ?? '', b.seat, b.nick);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/done') {
      const b = await readBody(req);
      if (!office.markDone(String(b.id || ''))) return fail(res, 404, 'That thread could not be taken off the list.', 'The office has no record of it.', 'Refresh the page and try again.');
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/buy') {
      const b = await readBody(req);
      if (loading) return send(res, 409, { error: { fault: 'The shop opens once every transcript is read.', reason: `The office has read ${loading.done} of ${loading.total} so far, so the purse is not counted yet.`, wayOut: 'Try again in a moment.' } });
      const r = buy(office, String(b.item || ''));
      if (r.error) return send(res, 409, { error: r.error });
      return send(res, 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/hook') {
      const b = await readBody(req);
      setup.onHook(office, b);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/setup') {
      const b = await readBody(req);
      const r = setup.apply(office, b, { port: PORT, hookScript: path.join(here, 'hook.mjs') });
      if (r.error) return send(res, 409, { error: r.error });
      return send(res, 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/settings') {
      const b = await readBody(req);
      const r = setup.settings(office, b);
      if (r.error) return send(res, 400, { error: r.error });
      return send(res, 200, r);
    }
    if (req.method === 'POST' && (url.pathname === '/api/update/check' || url.pathname === '/api/update/pull')) {
      // Asks GitHub (only now) what is newer; then takes it (a fast-forward only).
      const r = notHere() || await once(() => (url.pathname.endsWith('check') ? update.check(here) : update.pull(here)));
      return send(res, r.error ? 409 : 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/update/restart') {
      const refused = notHere() || midUpdate();
      if (refused) return send(res, 409, refused);
      update.restartAfterExit(here);
      send(res, 200, { ok: true });
      setTimeout(() => { try { office.save(); } catch { /* the next start reads what is new */ } process.exit(0); }, 200);
      return;
    }
    if (req.method === 'GET') {
      const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      if (!/^[\w.-]+$/.test(name)) return fail(res, 404, 'Nothing here.', 'That address is not part of the office.', 'Go to the office home page.');
      const file = path.join(PUBLIC, name);
      let data;
      try { data = fs.readFileSync(file); } catch { return fail(res, 404, 'Nothing here.', 'That address is not part of the office.', 'Go to the office home page.'); }
      // The page comes in its theme (one of setup.THEMES, so safe to write in), so it never shows light for a moment
      // before turning dark. Auto is light from sunrise to sunset where this PC's time zone is (public/sun.js).
      if (name === 'index.html') {
        const choice = setup.theme(office);
        data = data.toString('utf8').replace('<html lang="en">', `<html lang="en" data-theme-choice="${choice}" data-theme="${SUN.resolve(choice)}">`);
      }
      return send(res, 200, data, TYPES[path.extname(name)] || 'application/octet-stream');
    }
    return fail(res, 405, 'That cannot be done here.', 'The office does not take that kind of request.', 'Use the office page.');
  } catch (e) {
    return fail(res, 400, 'That could not be done.', String(e?.message || e), 'Refresh the page and try again.');
  }
});

// The page opens at once; the transcripts are read in batches behind it, newest first, so today's threads show within
// seconds while older history fills in. The very first start reads everything (about 30 seconds for 1.6 GB); later
// starts read only what is new. Until it is done the page shows a preview and nothing half-read is kept.
const BATCH = 10;
async function load() {
  const list = office.listFiles();
  const first = !fs.existsSync(path.join(dataDir, 'cache.json'));
  loading = { done: 0, total: list.length, first };
  console.log(first
    ? `Reading your Claude transcripts for the first time (${list.length} files, newest first). This can take a minute: keep this window open. The page shows people as they are read.`
    : `Catching up on ${list.length} transcripts…`);
  let told = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    try { office.readSome(list.slice(i, i + BATCH)); } catch (e) { lastScanError = String(e?.message || e); console.error('[read]', e); }
    loading.done = Math.min(list.length, i + BATCH);
    // Kept every 100 files: a window closed half way through starts from there next time.
    if (loading.done % 100 === 0) { try { office.save(); } catch { /* next time */ } }
    if (first && loading.done - told >= list.length / 4 && loading.done < list.length) {
      told = loading.done;
      console.log(`  ${loading.done} of ${list.length} read…`);
    }
    await new Promise((r) => setImmediate(r)); // let the page in between batches
  }
  loading = null;
  tick(); // the first full count: seats, the ledger, and what was deleted since last time
  console.log('All transcripts read: the office is up to date.');
  setInterval(tick, SCAN_MS).unref();
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AI Office Overview is open: http://127.0.0.1:${PORT}/ (keep this window open while you use it)`);
  console.log(`Reading ${office.transcriptsDir}; keeping its own files in ${dataDir}.`);
  // Start AI Office Overview.cmd asks for the page to open: it opens at once and shows the reading as it goes.
  if (process.argv.includes('--open') && process.env.AI_OFFICE_OPEN !== '0' && process.platform === 'win32') spawn('cmd', ['/c', 'start', '', `http://127.0.0.1:${PORT}/`], { detached: true, stdio: 'ignore' }).unref();
  load();
});
// One request that goes wrong in a way nobody caught must not close the office for every other one: say it and carry on.
process.on('unhandledRejection', (e) => { console.error('[unhandled]', e); });

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use: the office may already be open at http://127.0.0.1:${PORT}/ .`);
  else console.error(e);
  process.exit(1);
});
