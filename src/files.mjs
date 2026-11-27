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

// A data file that is there but could not be used (damaged, or of the wrong kind) is copied aside first
// (<name>.damaged-<time>.json), so the next save cannot wipe what was in it. When even that copy cannot be made (the
// disk full, the folder read-only, the file held), the file is kept: no save writes over it, and each save tries the
// copy again first.
const kept = new Set();
const keyOf = (file) => path.resolve(file).toLowerCase();
const damagedName = (file) => `${file.replace(/\.json$/i, '')}.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

/** Copies an unusable file aside. Answers whether it is now safe to write over (copied, or not there at all). */
export function setAside(file, why = 'could not be used') {
  const aside = damagedName(file);
  try {
    fs.copyFileSync(file, aside);
    kept.delete(keyOf(file));
    console.error(`[data] ${path.basename(file)} ${why}: kept a copy as ${path.basename(aside)}.`);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') { kept.delete(keyOf(file)); return true; }
    kept.add(keyOf(file));
    return false;
  }
}

/** Whether a save must leave this file alone (it could not be read, and no safe copy of it could be made yet). */
export const isKept = (file) => kept.has(keyOf(file)) && !setAside(file);

/** A plain error for the page: what went wrong in words, never a temp file's name or a folder path. */
export function keptError(file) {
  const e = new Error(`${path.basename(file)} could not be read, and a safe copy of it could not be made, so it was not written over. Check the disk has room and nothing holds the file, then restart the office.`);
  e.code = 'EKEPT';
  return e;
}

/** Writes JSON to file through a temp file beside it. A kept file (see above) is not written over. A failure is
 * answered in plain words (with the system's code), so no temp file name or folder reaches the page. */
export function writeJson(file, data, indent = 1) {
  if (isKept(file)) throw keptError(file);
  try { writeRaw(file, data, indent); } catch (e) {
    if (e.code === 'EKEPT') throw e;
    const plain = new Error(`${path.basename(file)} in the office's data folder could not be saved (${e.code || 'an error'}). Nothing was changed: check that nothing holds the file and the disk has room, then try again.`);
    plain.code = e.code;
    throw plain;
  }
}
function writeRaw(file, data, indent) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, indent));
  swapIn(tmp, file);
}

/** Reads a file that another program may hold for a moment: tried again a few times on EPERM or EBUSY (`tries`: 1
 * reads once, for a read on every poll that must not hold the server up). A byte-order mark (Notepad) is dropped. */
export function readText(file, tries = 6) {
  for (let i = 0; ; i++) {
    try { const t = fs.readFileSync(file, 'utf8'); return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t; } catch (e) {
      if (!BUSY.has(e.code) || i >= tries - 1) throw e;
      pause(100);
    }
  }
}
