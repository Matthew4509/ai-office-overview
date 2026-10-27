// The office's own files: written beside the file and swapped in, so a crash never leaves half a file. On Windows an
// antivirus or indexer can hold a file for a moment (EPERM or EBUSY on the swap): the swap is tried again a few times
// before it gives up.

import fs from 'node:fs';
import path from 'node:path';

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const BUSY = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** Moves tmp over file, trying again for up to about half a second while another program holds the file. */
export function swapIn(tmp, file) {
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; } catch (e) {
      if (!BUSY.has(e.code) || i >= 5) { try { fs.unlinkSync(tmp); } catch { /* leave it */ } throw e; }
      pause(100);
    }
  }
}

/** Writes JSON to file through a temp file beside it. */
export function writeJson(file, data, indent = 1) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, indent));
  swapIn(tmp, file);
}

/** Reads a file that another program may hold for a moment: tried again a few times on EPERM or EBUSY. */
export function readText(file) {
  for (let i = 0; ; i++) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) {
      if (!BUSY.has(e.code) || i >= 5) throw e;
      pause(100);
    }
  }
}
