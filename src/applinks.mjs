// The open-thread button: the AI desktop app keeps a small record for each of its code threads
// (<account>/<org>/local_<id>.json in its sessions folder) naming the transcript it writes (cliSessionId). The app's
// own link for local_<id> (linkOf below) opens that thread in the app. Only the two ids are kept from each record;
// the rest of the file (prompts, settings) is never read into the office or sent anywhere.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Where the app keeps those records. On Windows the desktop app is a packaged (Store-style) app: Windows keeps its AppData
 * in a private folder (AppData\Local\Packages\<app>_<id>\LocalCache\Roaming\<app>), and only programs started from
 * inside the app see it at the usual AppData\Roaming\<app>. So both are looked in.
 */
export function appSessionsDirs() {
  if (process.env.AI_OFFICE_APP_SESSIONS) return [process.env.AI_OFFICE_APP_SESSIONS];
  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    let packaged = [];
    try { packaged = fs.readdirSync(path.join(local, 'Packages')).filter((n) => /^Claude_/i.test(n)).map((n) => path.join(local, 'Packages', n, 'LocalCache', 'Roaming', 'Claude', 'claude-code-sessions')); } catch { packaged = []; }
    return [...packaged, path.join(roaming, 'Claude', 'claude-code-sessions')];
  }
  if (process.platform === 'darwin') return [path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions')];
  return [path.join(os.homedir(), '.config', 'Claude', 'claude-code-sessions')];
}

/** The link that opens an app thread. */
export const linkOf = (sessionId) => `claude://claude.ai/epitaxy/${encodeURIComponent(sessionId)}`;

export class AppLinks {
  constructor(dirs = appSessionsDirs()) {
    this.dirs = Array.isArray(dirs) ? dirs : [dirs];
    /** file -> { mtime, cli, session } */
    this.files = new Map();
    this.byCli = new Map();
    this.readAt = 0;
  }

  /** Reads the records again when more than `everyMs` has passed (only files that changed are parsed). */
  refresh(now = Date.now(), everyMs = 30_000) {
    if (now - this.readAt < everyMs) return;
    this.readAt = now;
    const seen = new Set();
    const walk = (dir, depth) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory() && depth < 2 && !e.name.startsWith('deleted_')) walk(p, depth + 1);
        else if (e.isFile() && /^local_[\w-]+\.json$/.test(e.name)) {
          seen.add(p);
          let mtime = 0;
          try { mtime = fs.statSync(p).mtimeMs; } catch { continue; }
          const had = this.files.get(p);
          if (had && had.mtime === mtime) continue;
          try {
            const j = JSON.parse(fs.readFileSync(p, 'utf8'));
            this.files.set(p, { mtime, cli: String(j.cliSessionId || ''), session: String(j.sessionId || '') });
          } catch { /* half-written: next time */ }
        }
      }
    };
    // From inside the app both places show the same records; byCli keeps one link per transcript either way.
    for (const d of this.dirs) walk(d, 0);
    for (const p of [...this.files.keys()]) if (!seen.has(p)) this.files.delete(p);
    this.byCli = new Map([...this.files.values()].filter((r) => r.cli && r.session).map((r) => [r.cli, r.session]));
  }

  /** The open-thread link for a transcript id, or ''. */
  open(transcriptId) {
    const s = this.byCli.get(transcriptId);
    return s ? linkOf(s) : '';
  }
}
