// Reads one AI app transcript (a .jsonl file, one event per line) into a small summary, a few lines at a time:
// what the thread is called, when it started and last did something, which files it wrote, which commands it ran, what
// it is doing now, whether its last reply asked something, and how many tokens the AI wrote for it.
// Nothing here writes to the transcript or anywhere near the AI app's folders.

import fs from 'node:fs';

/** Tools that change files. */
const WRITERS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
/** Tools that run commands. */
const SHELLS = new Set(['Bash', 'PowerShell']);
/** First words of a command that only looks (a command made only of these is reading, not work). */
const LOOKERS = new Set(['cd', 'ls', 'dir', 'cat', 'type', 'head', 'tail', 'grep', 'rg', 'egrep', 'find', 'wc', 'echo',
  'pwd', 'sort', 'uniq', 'cut', 'tr', 'which', 'where', 'du', 'df', 'stat', 'file', 'less', 'more', 'true',
  'get-content', 'get-childitem', 'select-string', 'test-path', 'get-item', 'measure-object', 'select-object',
  'where-object', 'format-table', 'write-output', 'get-location', 'gc', 'gci', 'sls']);
const GIT_LOOKS = new Set(['status', 'log', 'diff', 'show', 'branch', 'ls-files', 'rev-parse', 'remote', 'blame', 'describe']);

/** A fresh summary for a transcript file. */
export function emptyThread(id, since = '') {
  return {
    id,
    /** Tokens written at or after this time (the day the office opened) also count in outSince. */
    since,
    outSince: 0,
    title: '',
    firstPrompt: '',
    startedAt: '',
    lastAt: '',
    cwd: '',
    /** The folder the thread started in. */
    startCwd: '',
    /** Files written or edited (full paths, as the tool got them). */
    wrote: [],
    /** Commands that did more than look: { cmd, cwd }. */
    ran: [],
    /** The last thing that happened, for "what are they doing": see lastOf. */
    last: null,
    /** The question in the last reply, if it asked one (first 200 characters of the line with it). */
    asked: '',
    /** Output tokens the AI wrote, all and by day (YYYY-MM-DD, by the reply's own time). */
    out: 0,
    outByDay: {},
    /** The reply being counted (one reply is written over several lines that share its id). */
    msg: null,
    /** The last few steps, newest last: { at, words }. */
    steps: [],
    /** The last few messages, newest last: { at, who: 'you' | 'ai', text } (each cut to 600 characters). */
    msgs: [],
    /** Did this thread do real work (a write, or a command that did more than look)? Used for helpers. */
    worked: false,
    /** The last snag, for the staff's quips: { at, kind: 'failed' (a command or step that ended in an error) | 'bug'
     * (the AI's own words say it found a bug) }, or null. */
    snag: null,
    /** When the last few snags happened (newest last), to count a run of them: see snagAt. */
    snagTimes: [],
    /** The last thing worth a word in the office chat, measured from the thread: { at, kind, file?, n? } (see eventAt).
     * Kinds: tests-passed, tests-failed, commit, push, again (the same file edited a 3rd, 6th or 10th time), stopped. */
    event: null,
    /** Steps waiting for their result, by tool id: 'test', 'commit' or 'push'. */
    pending: {},
    /** How many times each file was edited (by full path). */
    edits: {},
  };
}

/** The AI saying it found a bug or its cause ("Found the bug", "the root cause is"). Plain words only, so a quip
 * follows a real find, not every mention of the word. */
const BUG_FOUND = /\b(found (the|a|another) (bug|problem|cause)|the bug (is|was)|that'?s the bug|root cause|the cause (is|was)|caught (a|the) bug|a bug in)\b/i;
/** A big bug: this many snags within SNAG_WINDOW. */
export const BIG_BUG = 3;
const SNAG_WINDOW = 15 * 60e3;
/** A snag at `at`: kept with `run`, how many snags the thread has hit within the last 15 minutes (this one too). */
function snagAt(t, at, kind) {
  t.snagTimes = [...(t.snagTimes || []), at].slice(-10);
  const ms = Date.parse(at);
  const run = t.snagTimes.filter((x) => ms - Date.parse(x) <= SNAG_WINDOW && Date.parse(x) <= ms).length;
  t.snag = { at, kind, run };
}
/** A shell step the chat may react to once its result is in: a test run, a commit, a push (from its words only). */
function watchedStep(input) {
  const cmd = String(input?.command || '');
  const words = `${input?.description || ''} ${cmd}`;
  if (/\bgit\b[^\n|;&]*\bcommit\b/.test(cmd)) return 'commit';
  if (/\bgit\b[^\n|;&]*\bpush\b/.test(cmd)) return 'push';
  if (/\b(tests?|test-all|spec|pytest|jest|vitest|mocha|phpunit)\b/i.test(words)) return 'test';
  return null;
}
/** A measured event for the chat: only its kind, a file's short name and a count are kept, never text from the thread. */
function eventAt(t, at, kind, more = {}) {
  t.event = { at, kind, ...more };
}
/** A tool result that is an error, but not one the person chose (a step they declined or stopped). */
function failedResult(c) {
  return c.some((x) => x && x.type === 'tool_result' && x.is_error && !/doesn't want to proceed|was rejected|interrupted by user|user declined/i.test(textOf(x.content)));
}

/** True when every part of a shell command only looks (ls, cat, grep, git status, ...). */
export function onlyLooks(cmd) {
  // Quoted text (a grep pattern with | in it, a file name) is not a command: blank it before splitting.
  const plain = String(cmd || '').replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
  const parts = plain.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return true;
  // Writing into a file (> or >>), other than throwing output away, is work whatever the command.
  if (/(^|[^0-9&>])>>?\s*(?!\/dev\/null|\$null|nul\b|&)/i.test(plain.replace(/2>&1|\d?>\s*\/dev\/null/g, ''))) return false;
  return parts.every((p) => {
    // Setting a shell variable (f=$(find ...)) changes nothing by itself.
    if (/^(export\s+)?[A-Za-z_]\w*=/.test(p)) return true;
    const words = p.replace(/^\(+/, '').split(/\s+/);
    const first = (words[0] || '').toLowerCase().replace(/^["']|["']$/g, '');
    if (first === '[' || first === 'test') return true;
    if (first === 'git') return GIT_LOOKS.has((words[1] || '').toLowerCase());
    if (first === 'sed') return words.includes('-n') && !words.some((w) => w.startsWith('-i'));
    return LOOKERS.has(first);
  });
}

/**
 * The folder a command works in: its first `cd "<path>"` (also after `D="<path>";`, with $D or ${D} filled in), else
 * the folder the thread was in. A cd to something that cannot be worked out counts as the thread's folder.
 */
export function commandFolder(cmd, cwd) {
  const text = String(cmd || '');
  const vars = {};
  const setRe = /(?:^|[;&|\n]\s*)(?:export\s+|\$)?([A-Za-z_]\w*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s;&|]+))/g;
  for (let m; (m = setRe.exec(text));) vars[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  const cd = /(?:^|[;&|\n(]\s*)(?:cd|Set-Location)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|)]+))/i.exec(text);
  if (!cd) return cwd || '';
  const target = (cd[1] || cd[2] || cd[3]).replace(/\$\{?([A-Za-z_]\w*)\}?/g, (all, name) => (name in vars ? vars[name] : all));
  // A cd somewhere that cannot be worked out ($APPDATA, ~) went elsewhere: not the folder the shell was left in.
  return /\$|%|~/.test(target) ? '' : target;
}

/** Plain words for a step. */
export function wordsFor(name, input) {
  const base = (p) => String(p || '').split(/[\\/]/).pop();
  if (WRITERS.has(name)) return `Editing ${base(input?.file_path || input?.notebook_path)}`;
  if (SHELLS.has(name)) return input?.description ? `Running: ${input.description}` : 'Running a command';
  if (name === 'Read') return `Reading ${base(input?.file_path)}`;
  if (name === 'Grep' || name === 'Glob') return 'Searching the files';
  if (name === 'WebFetch' || name === 'WebSearch') return 'Researching on the web';
  if (name === 'Agent' || name === 'Task') return input?.description ? `Briefing a helper: ${input.description}` : 'Briefing a helper';
  if (name === 'AskUserQuestion') return 'Asking you a question';
  if (name === 'Skill') return 'Opening a skill';
  if (/^mcp__.*(Browser|chrome)/i.test(name)) return 'Using the browser';
  if (name === 'TodoWrite') return 'Updating the to-do list';
  return 'Working';
}

/**
 * The question a reply ends on, or ''. A reply asks when one of its last lines ends with a question mark; the first
 * such line is given (a numbered list of questions reads from its top). Words like "let me know" are not enough.
 */
export function questionIn(text) {
  const lines = String(text || '').split('\n').map((s) => s.replace(/[*_`#>]/g, '').trim()).filter(Boolean);
  const tail = lines.slice(-12);
  const asks = tail.filter((l) => /\?["')\]]?$/.test(l) && !/^https?:/.test(l));
  return asks.length ? asks[0].slice(0, 200) : '';
}

/** The day (YYYY-MM-DD) of a time, on this PC's clock. */
export function localDay(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((c) => c && c.type === 'text').map((c) => c.text || '').join('\n');
}

/** Keeps the last 8 messages (a reply written over several lines with the same text is kept once). */
function pushMsg(t, at, who, text) {
  const clean = String(text || '').trim();
  if (!clean) return;
  const cut = clean.length > 600 ? `${clean.slice(0, 600)}…` : clean;
  const prev = t.msgs[t.msgs.length - 1];
  if (prev && prev.who === who && prev.text === cut) return;
  t.msgs.push({ at, who, text: cut });
  if (t.msgs.length > 8) t.msgs.shift();
}

function pushStep(t, at, words) {
  const prev = t.steps[t.steps.length - 1];
  if (prev && prev.words === words) { prev.at = at; return; }
  t.steps.push({ at, words });
  if (t.steps.length > 8) t.steps.shift();
}

/** Adds one parsed line to a summary. */
export function addLine(t, l) {
  if (!l || typeof l !== 'object') return;
  if (l.type === 'custom-title' && l.customTitle) { t.title = String(l.customTitle); return; }
  if (l.type !== 'user' && l.type !== 'assistant') return;
  const at = l.timestamp || '';
  if (at) {
    if (!t.startedAt) t.startedAt = at;
    if (at > t.lastAt) t.lastAt = at;
  }
  if (l.cwd) { t.cwd = l.cwd; if (!t.startCwd) t.startCwd = l.cwd; }
  const m = l.message || {};
  if (l.type === 'user') {
    const c = m.content;
    const isResult = Array.isArray(c) && c.some((x) => x && x.type === 'tool_result');
    if (isResult) {
      t.last = { kind: 'result', at };
      t.asked = '';
      if (failedResult(c)) snagAt(t, at, 'failed');
      for (const x of c) {
        const what = x && x.type === 'tool_result' && t.pending?.[x.tool_use_id];
        if (!what) continue;
        delete t.pending[x.tool_use_id];
        if (what === 'test') eventAt(t, at, x.is_error ? 'tests-failed' : 'tests-passed');
        else if (!x.is_error) eventAt(t, at, what);
      }
      return;
    }
    if (l.isMeta) return;
    const words = textOf(c).trim();
    if (!words) return;
    if (/^\[Request interrupted/i.test(words)) { t.last = { kind: 'stopped', at }; eventAt(t, at, 'stopped'); return; }
    if (/^<(command-|local-command|system-reminder)/.test(words)) return;
    if (!t.firstPrompt) t.firstPrompt = words.slice(0, 2000);
    t.last = { kind: 'prompt', at };
    t.asked = '';
    pushStep(t, at, 'Got a new message');
    pushMsg(t, at, 'you', words);
    return;
  }
  // An assistant line: one block of a reply (thinking, text or a tool call). Lines of one reply share message.id.
  const id = m.id || l.uuid;
  const out = Number(m.usage?.output_tokens) || 0;
  const day = localDay(at);
  if (t.msg && t.msg.id === id) {
    // The same reply again: its usage is the reply's running total, so swap the old count for the new one.
    if (out !== t.msg.out) {
      t.out += out - t.msg.out;
      if (t.msg.counts) t.outSince += out - t.msg.out;
      t.outByDay[t.msg.day] = (t.outByDay[t.msg.day] || 0) + out - t.msg.out;
      t.msg.out = out;
    }
  } else {
    const counts = !!t.since && at >= t.since;
    t.msg = { id, out, day, counts };
    t.out += out;
    if (counts) t.outSince += out;
    if (day) t.outByDay[day] = (t.outByDay[day] || 0) + out;
  }
  const blocks = Array.isArray(m.content) ? m.content : [];
  // A reply is over at end_turn (or, rarely, at a stop sequence): what it ends on says whether it asked something.
  const ended = m.stop_reason === 'end_turn' || m.stop_reason === 'stop_sequence';
  for (const b of blocks) {
    if (!b) continue;
    if (b.type === 'tool_use') {
      const input = b.input || {};
      const words = wordsFor(b.name, input);
      t.last = { kind: 'tool', at, tool: b.name, words };
      pushStep(t, at, words);
      const watch = SHELLS.has(b.name) && b.id ? watchedStep(input) : null;
      if (watch) {
        t.pending = { ...(t.pending || {}), [b.id]: watch };
        const ids = Object.keys(t.pending);
        if (ids.length > 20) delete t.pending[ids[0]];
      }
      if (WRITERS.has(b.name)) {
        const p = input.file_path || input.notebook_path;
        if (p) {
          t.edits = t.edits || {};
          const n = (t.edits[p] = (t.edits[p] || 0) + 1);
          if ([3, 6, 10].includes(n)) eventAt(t, at, 'again', { file: String(p).split(/[\\/]/).pop().slice(0, 60), n });
        }
        if (p && !t.wrote.includes(p)) t.wrote.push(p);
        t.worked = true;
      } else if (SHELLS.has(b.name) && input.command && !onlyLooks(input.command)) {
        t.ran.push({ cmd: String(input.command).slice(0, 300), cwd: commandFolder(input.command, l.cwd) });
        if (t.ran.length > 200) t.ran.shift();
        t.worked = true;
      }
      if (b.name === 'AskUserQuestion') {
        const q = input.questions?.[0]?.question;
        t.asked = String(q || 'Asked you a question').slice(0, 200);
      }
    } else if (b.type === 'text' && b.text) {
      pushMsg(t, at, 'ai', b.text);
      if (BUG_FOUND.test(b.text)) snagAt(t, at, 'bug');
      if (ended) {
        t.last = { kind: 'done', at };
        t.asked = questionIn(b.text);
        pushStep(t, at, t.asked ? 'Asked you something' : 'Finished a reply');
      } else {
        t.last = { kind: 'writing', at };
      }
    } else if (b.type === 'thinking') {
      t.last = { kind: 'thought', at };
    }
  }
  if (ended && !blocks.some((b) => b && b.type === 'text')) {
    t.last = { kind: 'done', at };
  }
}

/**
 * Reads what has been added to a file since `offset` and feeds whole lines to the summary.
 * `also` ({ from, fn }): a second reader of the same lines (the token counts), fed every line from its own `from`
 * on, so a file is read and each line parsed once for both. Answers the new offset (a half-written last line is left
 * for next time).
 */
export function readFrom(file, t, offset = 0, also = null) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch { return offset; }
  try {
    const size = fs.fstatSync(fd).size;
    if (size < offset) offset = 0; // the file was replaced: read it again from the start
    const alsoFrom = also ? Math.min(also.from, size) : Infinity;
    const CHUNK = 4 * 1024 * 1024;
    let pos = Math.min(offset, alsoFrom);
    let carry = Buffer.alloc(0);
    while (pos < size) {
      const buf = Buffer.alloc(Math.min(CHUNK, size - pos));
      const n = fs.readSync(fd, buf, 0, buf.length, pos);
      if (n <= 0) break;
      const base = pos - carry.length; // where `data` starts in the file
      pos += n;
      let data = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : buf.subarray(0, n);
      let start = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== 10) continue;
        const at = base + start;
        const line = data.toString('utf8', start, i).trim();
        start = i + 1;
        if (!line) continue;
        const mine = at >= offset, theirs = at >= alsoFrom;
        if (!mine && !theirs) continue;
        try {
          const o = JSON.parse(line);
          if (mine) addLine(t, o);
          if (theirs) also.fn(o);
        } catch { /* a damaged line is skipped */ }
      }
      carry = Buffer.from(data.subarray(start));
    }
    return pos - carry.length;
  } finally {
    fs.closeSync(fd);
  }
}
