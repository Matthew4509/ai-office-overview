// AI Office Overview: a small server on this PC only (127.0.0.1). It reads the AI app's transcripts every few seconds and
// serves the office page. Nothing is sent anywhere. Start: node server.mjs (or Start AI Office Overview.cmd).
//   node server.mjs --open     also opens the page in the browser once the office is listening
//   node server.mjs --stop     stops the office that runs over this data folder (uninstall.cmd and the installer use it)
//   node server.mjs --status   says whether one runs (exit code 0) or not (1)
//   PORT                     default 8860
//   AI_OFFICE_DATA       where the office keeps its own files (default: data/ beside this file)
//   AI_OFFICE_TRANSCRIPTS where the AI app keeps transcripts (default: its projects folder in the home folder)

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Office, folderKey, seatKey } from './src/office.mjs';
import { shopOf, buy } from './src/shop.mjs';
import * as setup from './src/setup.mjs';
import * as update from './src/update.mjs';
import * as install from './src/install.mjs';
import * as win from './src/windows.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// The office works from its own folder: a program run by a bare name is looked for in the working folder first.
process.chdir(here);
const PORT = Number(process.env.PORT) || 8860;
const dataDir = process.env.AI_OFFICE_DATA || path.join(here, 'data');
/** Which office runs over this data folder: { pid, port, key, started }, written at start and removed at a clean stop. */
const RUN_FILE = path.join(dataDir, 'run.json');
function readRun() {
  let r;
  try { r = JSON.parse(fs.readFileSync(RUN_FILE, 'utf8')); } catch { return null; }
  if (!Number.isInteger(r?.port) || r.port <= 0 || r.port > 65535 || typeof r.key !== 'string' || !r.key) return null;
  return r;
}
/** Asks the office named in run.json, with its key, who it is. A process id alone proves nothing: after a hard stop
 * (Task Manager, a power cut) Windows can give it to any other program. Only this office, with this key, answers. */
function ask(r, method, pathname) {
  return new Promise((resolve) => {
    const q = http.request({ host: '127.0.0.1', port: r.port, path: pathname, method, timeout: 3000,
      headers: { host: `127.0.0.1:${r.port}`, 'x-ai-office-key': r.key, 'content-type': 'application/json', connection: 'close' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (body.length < 100_000) body += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(body); } catch { /* not the office */ } resolve({ status: res.statusCode, json }); });
    });
    q.on('timeout', () => q.destroy());
    q.on('error', () => resolve(null));
    q.end(method === 'POST' ? '{}' : undefined);
  });
}
const isOffice = (a) => a?.status === 200 && a.json?.app === 'ai-office-overview' && typeof a.json.version === 'string';
/** The office running over this data folder, proven by its answer; null when none is (a stale run file is ignored). */
async function running() {
  const r = readRun();
  if (!r) return null;
  return isOffice(await ask(r, 'GET', '/api/ping')) ? r : null;
}
if (process.argv.includes('--stop') || process.argv.includes('--status')) {
  const r = await running();
  if (process.argv.includes('--status')) {
    console.log(r ? `AI Office Overview is running: http://127.0.0.1:${r.port}/ (started ${r.started}).` : 'AI Office Overview is not running.');
    process.exit(r ? 0 : 1);
  }
  // Nothing is ever ended by its process id: the office is asked to Quit with its own key, and saves first.
  if (!r) {
    try { if (fs.existsSync(RUN_FILE)) fs.unlinkSync(RUN_FILE); } catch { /* left for the next start, which ignores it */ }
    console.log('AI Office Overview is not running.');
    process.exit(0);
  }
  const a = await ask(r, 'POST', '/api/quit');
  if (a?.status !== 200) {
    console.error(`AI Office Overview did not accept the stop: ${a?.json?.error?.reason || 'it did not answer'}`);
    process.exit(1);
  }
  const until = Date.now() + 10000;
  while (Date.now() < until && isOffice(await ask(r, 'GET', '/api/ping'))) await new Promise((res) => setTimeout(res, 150));
  if (isOffice(await ask(r, 'GET', '/api/ping'))) { console.error('AI Office Overview did not stop.'); process.exit(1); }
  // The office takes its run file with it; give it a moment to finish exiting.
  for (let i = 0; i < 20 && fs.existsSync(RUN_FILE); i++) await new Promise((res) => setTimeout(res, 100));
  console.log('AI Office Overview has stopped.');
  process.exit(0);
}
// A data file another program holds at start (an antivirus, a backup) stops the start with a plain line, not a stack.
let office;
try { office = new Office({ dataDir, transcriptsDir: process.env.AI_OFFICE_TRANSCRIPTS }); } catch (e) {
  console.error(`AI Office Overview could not start: ${e?.code === 'EHELD' ? e.message : `its data folder could not be read (${e?.code || 'an error'}).`}`);
  process.exit(1);
}
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
/** One update step at a time: a second press of the same step waits for the first and shares its answer; a press of
 * the other step (Check while Update runs) waits for it, then runs on its own. */
let updating = null;
let updatingKind = '';
function once(kind, job) {
  if (updating && updatingKind === kind) return updating;
  const p = (updating || Promise.resolve()).catch(() => {}).then(job).finally(() => { if (updating === p) { updating = null; updatingKind = ''; } });
  updating = p;
  updatingKind = kind;
  return p;
}
// Restart waits while an update is being taken (a second tab could stop the office half way through it).
const midUpdate = () => (update.taking() ? { error: { fault: 'The office cannot restart just now.', reason: 'It is taking an update, and stopping half way could leave its folder between two versions.', wayOut: 'Wait a minute for it to finish, then try again.' } } : null);

// Every request from the page carries the key this run was served with (a header a web page in the browser cannot
// add: it would need a preflight, which is never answered). A page from an earlier run gets 403 and reloads itself.
// The one route without it is the hook, which the AI app's hook.mjs calls with a plain JSON event.
const KEY = crypto.randomBytes(18).toString('base64url');
const keyOk = (req) => {
  const got = Buffer.from(String(req.headers['x-ai-office-key'] || ''));
  const want = Buffer.from(KEY);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
};

/** Stops the office cleanly: what it knows is saved, its run file goes, and the process ends. */
function shutdown() {
  try { office.save(); } catch { /* the next start reads what is new */ }
  process.exit(0);
}

// A folder called __proto__, constructor or prototype would reach the object every map is built on: never kept.
const badSeat = (res) => fail(res, 400, 'That could not be kept.', 'The seat or the name sent was not one the office can keep (a seat is a small whole number; a name is text).', 'Refresh the page and try again.');
const badFolder = (res) => fail(res, 400, 'That folder name cannot be kept.', 'The office keeps __proto__, constructor and prototype for itself.', 'Rename the folder, or leave this one without a name or star.');

let lastScanError = '';
/** While the first read is going: how far it has got ({ done, total, first }); null once every transcript is read. */
let loading = null;
function tick() {
  if (loading) return;
  try {
    office.scan();
    office.snapshot(); // keeps the ledger up to date even when no page is open
    office.save({ atMost: 30_000 }); // shutdown() saves the rest

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
    'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  });
  res.end(data);
}

function fail(res, code, fault, reason, wayOut) {
  send(res, code, { error: { fault, reason, wayOut } });
}

/** A request the office cannot read: answered 400 with this reason, in plain words. */
function badBody(reason) { const e = new Error(reason); e.plain = true; return e; }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (c) => {
      size += c.length;
      // Over the limit: the rest is read and dropped, so the page gets an answer (a cut connection would not say why).
      if (size > 16 * 1024) { parts.length = 0; reject(badBody('The request was too big: over 16 KB.')); return; }
      parts.push(c);
    });
    req.on('end', () => {
      let b;
      try { b = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}'); } catch { reject(badBody('It was not JSON.')); return; }
      // Every route takes a set of named fields: a list, a number, text or null is refused, never read as empty.
      if (!b || typeof b !== 'object' || Array.isArray(b)) { reject(badBody('It was not a set of named fields.')); return; }
      resolve(b);
    });
    req.on('error', reject);
  });
}

/** Only this PC may talk to the office: other pages in the browser cannot (no CORS, JSON only, our Host only). */
function allowed(req) {
  const host = String(req.headers.host || '').toLowerCase();
  // Port 80 is left out of the Host header by browsers.
  const hosts = PORT === 80 ? ['127.0.0.1', 'localhost', '127.0.0.1:80', 'localhost:80'] : [`127.0.0.1:${PORT}`, `localhost:${PORT}`];
  if (!hosts.includes(host)) return false;
  if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) return false;
  return true;
}

/** The office's own API addresses (the routes below). */
const ROUTES = new Set(['/api/ping', '/api/state', '/api/nickname', '/api/favourite', '/api/edit', '/api/done', '/api/buy', '/api/hook', '/api/setup', '/api/settings', '/api/update/check', '/api/update/pull', '/api/update/restart', '/api/install', '/api/quit', '/api/uninstall']);

const server = http.createServer(async (req, res) => {
  if (!allowed(req)) return fail(res, 403, 'That request was turned away.', 'The office only answers its own page on this PC.', `Open http://127.0.0.1:${PORT}/ instead.`);
  let url;
  try { url = new URL(req.url, `http://127.0.0.1:${PORT}`); } catch {
    return fail(res, 400, 'That address could not be read.', 'It is not a web address the office understands.', `Open http://127.0.0.1:${PORT}/ instead.`);
  }
  if (url.pathname.startsWith('/api/') && !(req.method === 'POST' && url.pathname === '/api/hook') && !keyOk(req)) {
    return fail(res, 403, 'This page is from an older run of the office.', 'The office was started again since the page was opened, so its key has changed.', 'Reload the page.');
  }
  try {
    // node server.mjs --status and --stop ask this with the key from run.json: only this run of the office answers it.
    if (req.method === 'GET' && url.pathname === '/api/ping') return send(res, 200, { app: 'ai-office-overview', version: VERSION, port: PORT });
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const s = office.snapshot({ preview: !!loading });
      return send(res, 200, { ...s, loading, shop: shopOf(office, s.earned), scanError: lastScanError, setup: setup.status(office, { port: PORT, hookScript: path.join(here, 'hook.mjs') }), version: VERSION });
    }
    if (req.method === 'POST' && url.pathname === '/api/nickname') {
      const b = await readBody(req);
      if (folderKey(b.folder) === null) return badFolder(res);
      if (!office.setNickname(b.folder ?? '', b.seat, b.nick)) return badSeat(res);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/favourite') {
      // A star on a person ({ folder, seat, on }) or a whole project ({ folder, project: true, on }); or an old
      // favourite hidden from the Favourites tab and the beach ({ folder, seat, hidden }).
      const b = await readBody(req);
      if (folderKey(b.folder) === null) return badFolder(res);
      let done;
      if (typeof b.hidden === 'boolean') done = office.setFavouriteHidden(b.folder ?? '', b.seat, b.hidden);
      else if (b.project === true) done = office.setFavouriteProject(b.folder ?? '', !!b.on);
      else done = office.setFavourite(b.folder ?? '', b.seat, !!b.on);
      if (!done) return badSeat(res);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/edit') {
      // EDIT on a card: the seat's nickname and look together. look: an object, or null for the made-up look again.
      const b = await readBody(req);
      if (folderKey(b.folder) === null) return badFolder(res);
      if (!seatKey(b.seat)) return badSeat(res);
      if (b.nick !== undefined && b.nick !== null && typeof b.nick !== 'string') return badSeat(res);
      if (b.look !== undefined && !office.setLook(b.folder ?? '', b.seat, b.look)) return fail(res, 400, 'That look could not be kept.', 'One of its parts is not one the office knows.', 'Pick the parts again in the editor, then save.');
      if (b.nick !== undefined) office.setNickname(b.folder ?? '', b.seat, b.nick);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/done') {
      const b = await readBody(req);
      if (typeof b.id !== 'string' || !office.markDone(b.id)) return fail(res, 404, 'That thread could not be taken off the list.', 'The office has no record of it.', 'Refresh the page and try again.');
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/buy') {
      const b = await readBody(req);
      if (loading) return send(res, 409, { error: { fault: 'The shop opens once every transcript is read.', reason: `The office has read ${loading.done} of ${loading.total} so far, so the spending balance is not counted yet.`, wayOut: 'Try again in a moment.' } });
      const r = buy(office, typeof b.item === 'string' ? b.item : '');
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
      const r = notHere() || await once(url.pathname.endsWith('check') ? 'check' : 'pull', () => (url.pathname.endsWith('check') ? update.check(here) : update.pull(here)));
      return send(res, r.error ? 409 : 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/update/restart') {
      const refused = notHere() || midUpdate();
      if (refused) return send(res, 409, refused);
      update.restartAfterExit(here);
      send(res, 200, { ok: true });
      setTimeout(shutdown, 200);
      return;
    }
    // Setup › Setup: the three shortcuts (Start menu, desktop, Start with Windows), for this Windows user only.
    if (req.method === 'GET' && url.pathname === '/api/install') return send(res, 200, await install.status());
    if (req.method === 'POST' && url.pathname === '/api/install') {
      const b = await readBody(req);
      const want = {};
      for (const k of install.PLACES) if (typeof b[k] === 'boolean') want[k] = b[k];
      if (!Object.keys(want).length) return fail(res, 400, 'That change was not understood.', 'It named none of the shortcuts.', 'Refresh the page and try again.');
      const r = await install.apply(want);
      if (r.errors.length) return send(res, 409, { error: { fault: 'Not everything could be changed.', reason: `${r.errors.join('; ')}.`, wayOut: 'Try again; if it stays, run install.cmd from the office\'s folder.' }, results: r.results });
      return send(res, 200, { ok: true, results: r.results, status: await install.status() });
    }
    // About › Quit: the office stops. Start it again with Start AI Office Overview.cmd or a shortcut.
    if (req.method === 'POST' && url.pathname === '/api/quit') {
      const refused = midUpdate();
      if (refused) return send(res, 409, refused);
      send(res, 200, { ok: true });
      setTimeout(shutdown, 200);
      return;
    }
    // About › Uninstall: shortcuts away and the hooks out, then the office stops. The folder and its data stay; the
    // reply says where they are so the person can delete them.
    if (req.method === 'POST' && url.pathname === '/api/uninstall') {
      const refused = midUpdate();
      if (refused) return send(res, 409, refused);
      const r = await install.uninstall();
      if (r.errors.length) return send(res, 409, { error: { fault: 'Not everything could be removed.', reason: `${r.errors.join('; ')}.`, wayOut: 'The office is still running: try again, or double-click uninstall.cmd in its folder.' }, results: r.results });
      send(res, 200, { ok: true, results: r.results, folder: here });
      setTimeout(shutdown, 300);
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
        data = data.toString('utf8').replace('<html lang="en">', `<html lang="en" data-theme-choice="${choice}" data-theme="${SUN.resolve(choice)}">`).replace('__AI_OFFICE_KEY__', KEY);
      }
      return send(res, 200, data, TYPES[path.extname(name)] || 'application/octet-stream');
    }
    // A known address asked the wrong way: 405. An address the office does not have: 404.
    const pageFile = url.pathname === '/' || (/^\/[\w.-]+$/.test(url.pathname) && fs.existsSync(path.join(PUBLIC, url.pathname.slice(1))));
    if (ROUTES.has(url.pathname) || pageFile) return fail(res, 405, 'That cannot be done here.', 'The office does not take that kind of request at this address.', 'Use the office page.');
    return fail(res, 404, 'Nothing here.', 'That address is not part of the office.', 'Use the office page.');
  } catch (e) {
    // A request the office could not read says why; anything else is said in plain words (the details go to the
    // office's window, never a program's own error text or a folder path to the page).
    if (e?.plain) return fail(res, 400, 'That request could not be read.', e.message, 'Refresh the page and try again.');
    console.error('[request]', req.method, url.pathname, e);
    const saved = /could not be (saved|read)|was not written over/.test(String(e?.message || ''));
    return fail(res, saved ? 409 : 500, 'That could not be done.', saved ? e.message : 'The office ran into a problem with that request. Nothing else was changed.', 'Refresh the page and try again.');
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

// An office already running over this data folder (on this port or another): two would count the ledger twice.
// It must answer as this office with the key in run.json; a run file left by a hard stop is ignored.
const already = await running();
if (already) {
  console.error(`AI Office Overview is already running at http://127.0.0.1:${already.port}/ with this data folder. Open that address, or stop it first: node server.mjs --stop`);
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AI Office Overview is open: http://127.0.0.1:${PORT}/ (keep this window open while you use it)`);
  console.log(`Reading ${office.transcriptsDir}; keeping its own files in ${dataDir}.`);
  // Written to a temp file and swapped in, so a torn run file is never read. The key lets --stop ask for a Quit.
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${RUN_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify({ pid: process.pid, port: PORT, key: KEY, started: new Date().toISOString() })}\n`);
    fs.renameSync(tmp, RUN_FILE);
  } catch { /* --stop then needs the window */ }
  // Start AI Office Overview.cmd asks for the page to open: it opens at once and shows the reading as it goes.
  if (process.argv.includes('--open') && process.env.AI_OFFICE_OPEN !== '0' && win.isWindows) win.openUrl(`http://127.0.0.1:${PORT}/`);
  load();
});
// One request that goes wrong in a way nobody caught must not close the office for every other one: say it and carry on.
process.on('unhandledRejection', (e) => { console.error('[unhandled]', e); });
process.on('uncaughtException', (e) => { console.error('[uncaught]', e); });
// A clean stop (Quit, --stop, Ctrl+C, the window closing) takes the run file with it; a killed process leaves a stale
// one, which running() sees through.
process.on('exit', () => { try { if (JSON.parse(fs.readFileSync(RUN_FILE, 'utf8')).pid === process.pid) fs.unlinkSync(RUN_FILE); } catch { /* not ours, or gone */ } });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, shutdown);

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use: the office may already be open at http://127.0.0.1:${PORT}/ .`);
  else console.error(e);
  process.exit(1);
});
