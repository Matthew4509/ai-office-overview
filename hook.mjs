// Advanced setup's hook: the AI app runs this on a new message, when it waits for you, and when it finishes a reply.
// It passes the event to AI Office Overview on this PC (127.0.0.1 only) and prints nothing, so the AI app is never changed by it.
// It gives up after under a second and always ends cleanly: if the office is closed, the AI app carries on as normal.
// Usage (written into the AI app's settings by Setup): node "<this file>" <port>

import http from 'node:http';

const port = Number(process.argv[2]) || 8860;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { if (input.length < 200_000) input += c; });
process.stdin.on('end', () => {
  let e = {};
  try { e = JSON.parse(input || '{}'); } catch { process.exit(0); }
  const body = JSON.stringify({
    event: String(e.hook_event_name || ''),
    session: String(e.session_id || ''),
    message: String(e.message || '').slice(0, 300),
  });
  const req = http.request({ host: '127.0.0.1', port, path: '/api/hook', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: 800 }, (res) => {
    res.resume();
    res.on('end', () => process.exit(0));
  });
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.on('error', () => process.exit(0));
  req.end(body);
});
setTimeout(() => process.exit(0), 1500).unref();
