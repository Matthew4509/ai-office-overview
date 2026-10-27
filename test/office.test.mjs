import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Office } from '../src/office.mjs';
import { onHook } from '../src/setup.mjs';
import { tempHome, lines, ROOT } from './helpers.mjs';

const BASE = Date.parse('2026-10-12T00:00:00Z');
const at = (min) => BASE + min * 60000;

function setup(h, nowMin) {
  let now = at(nowMin);
  const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts, now: () => now });
  office.settings.root = ROOT;
  return { office, setNow: (m) => { now = at(m); } };
}

const file = (h, id) => path.join(h.transcripts, 'C--Work-projects', `${id}.jsonl`);
const OFFICE_FILE = `${ROOT}\\ai office overview\\PLAN.md`;

test('a nickname is kept by seat and the next thread in that folder inherits it, even after the first is deleted', () => {
  const h = tempHome();
  try {
    lines('one').title('Plan the office').prompt(0, 'start').tool(1, 'Write', { file_path: OFFICE_FILE }, 100).reply(2, 'Done.', 50).write(file(h, 'one'));
    let { office } = setup(h, 3);
    office.scan();
    let s = office.snapshot();
    const p = s.people.find((x) => x.folder === 'ai office overview');
    assert.equal(p.name, 'ai office overview');
    assert.equal(p.state, 'idle');
    assert.equal(p.thread.title, 'Plan the office');
    office.setNickname('ai office overview', 1, 'Wren');
    office.save();
    // The first thread is deleted in the app; a new handover thread starts in the same folder hours later.
    fs.rmSync(file(h, 'one'));
    lines('two', at(300)).prompt(0, 'START HERE ai office overview/HANDOFF.md').tool(1, 'Edit', { file_path: OFFICE_FILE }, 40).write(file(h, 'two'));
    ({ office } = setup(h, 301));
    office.scan();
    s = office.snapshot();
    const wren = s.people.find((x) => x.folder === 'ai office overview' && x.seat === 1);
    assert.equal(wren.name, 'Wren');
    assert.equal(wren.state, 'working');
    assert.equal(wren.threads, 2, 'the deleted thread is still on their record');
    assert.equal(wren.out, 190, 'and so are its tokens');
  } finally {
    h.done();
  }
});

test('two threads at once in one folder: the second is "<folder> 2", with its own nickname', () => {
  const h = tempHome();
  try {
    lines('a').prompt(0, 'x').tool(1, 'Write', { file_path: OFFICE_FILE }).write(file(h, 'a'));
    lines('b', at(5)).prompt(0, 'y').tool(1, 'Write', { file_path: OFFICE_FILE }).write(file(h, 'b'));
    const { office } = setup(h, 7);
    office.setNickname('ai office overview', 2, 'Otto');
    office.scan();
    const s = office.snapshot();
    const names = s.people.filter((x) => x.folder === 'ai office overview').map((x) => `${x.seat}:${x.name}`).sort();
    assert.deepEqual(names, ['1:ai office overview', '2:Otto']);
    const pr = s.projects.find((x) => x.folder === 'ai office overview');
    assert.equal(pr.people.length, 2);
  } finally {
    h.done();
  }
});

test('a thread that works in two projects is a Consultant', () => {
  const h = tempHome();
  try {
    lines('audit').prompt(0, 'audit everything').tool(1, 'Edit', { file_path: OFFICE_FILE }).tool(2, 'Edit', { file_path: `${ROOT}\\Tomlin\\a.md` }).reply(3, 'Done.').write(file(h, 'audit'));
    const { office } = setup(h, 4);
    office.scan();
    const p = office.snapshot().people[0];
    assert.equal(p.folder, '');
    assert.equal(p.name, 'Consultant');
  } finally {
    h.done();
  }
});

test('helpers earn for their thread only when they did real work', () => {
  const h = tempHome();
  try {
    lines('main').prompt(0, 'go').tool(1, 'Write', { file_path: OFFICE_FILE }, 100).reply(2, 'Done.', 0).write(file(h, 'main'));
    const sub = path.join(h.transcripts, 'C--Work-projects', 'main', 'subagents');
    lines('agent-reader').prompt(1, 'look').tool(1.5, 'Grep', { pattern: 'x' }, 1000).write(path.join(sub, 'agent-reader.jsonl'));
    lines('agent-writer').prompt(1, 'fix').tool(1.5, 'Edit', { file_path: OFFICE_FILE }, 500).write(path.join(sub, 'agent-writer.jsonl'));
    const { office } = setup(h, 3);
    office.scan();
    const p = office.snapshot().people.find((x) => x.folder === 'ai office overview');
    assert.equal(p.out, 600);
  } finally {
    h.done();
  }
});

test('Needs revisiting lists who asked, longest waiting first; Done takes one off until it asks again', () => {
  const h = tempHome();
  try {
    lines('q1').prompt(0, 'a').tool(1, 'Write', { file_path: OFFICE_FILE }).reply(2, 'Built.\n\n1. Prices x 20?').write(file(h, 'q1'));
    lines('q2', at(10)).prompt(0, 'b').tool(1, 'Write', { file_path: `${ROOT}\\Tomlin\\x.md` }).reply(2, 'Which name?').write(file(h, 'q2'));
    lines('q3', at(10)).prompt(0, 'c').reply(2, 'All done.').write(file(h, 'q3'));
    const { office, setNow } = setup(h, 15);
    office.scan();
    let s = office.snapshot();
    assert.deepEqual(s.waiting.map((w) => w.id), ['q1', 'q2']);
    assert.equal(s.waiting[0].asked, '1. Prices x 20?');
    assert.equal(s.people.find((x) => x.folder === 'ai office overview').state, 'needs');
    office.markDone('q1');
    s = office.snapshot();
    assert.deepEqual(s.waiting.map((w) => w.id), ['q2']);
    // Hours later the thread has gone home but is still waiting: it stays on the list, marked gone home.
    setNow(200);
    s = office.snapshot();
    assert.equal(s.waiting[0].gone, true);
  } finally {
    h.done();
  }
});

test('the office remembers where it read to: a restart reads only what is new', () => {
  const h = tempHome();
  try {
    const l = lines('r').prompt(0, 'a').tool(1, 'Write', { file_path: OFFICE_FILE }, 10);
    l.write(file(h, 'r'));
    let { office } = setup(h, 2);
    assert.equal(office.scan(), 1);
    office.snapshot();
    office.save();
    ({ office } = setup(h, 2));
    assert.equal(office.scan(), 0);
    l.reply(3, 'Done.', 5).write(file(h, 'r'));
    assert.equal(office.scan(), 1);
    assert.equal(office.snapshot().people[0].out, 15);
  } finally {
    h.done();
  }
});

test('Open in Claude: a thread the desktop app has a record of gets its link; the rest of the record is not kept', () => {
  const h = tempHome();
  try {
    lines('t9').prompt(0, 'go').tool(1, 'Write', { file_path: OFFICE_FILE }).reply(2, 'Done.').write(file(h, 't9'));
    const rec = path.join(process.env.AI_OFFICE_APP_SESSIONS, 'acct', 'org', 'local_abc-123.json');
    fs.mkdirSync(path.dirname(rec), { recursive: true });
    fs.writeFileSync(rec, JSON.stringify({ sessionId: 'local_abc-123', cliSessionId: 't9', title: 'secret title', postTurnSummary: 'private words' }));
    const { office } = setup(h, 3);
    office.scan();
    const p = office.snapshot().people.find((x) => x.folder === 'ai office overview');
    assert.equal(p.thread.open, 'claude://claude.ai/epitaxy/local_abc-123');
    assert.ok(!JSON.stringify(office.snapshot()).includes('private words'));
  } finally {
    h.done();
  }
});

test('an old thread resumed while another has its seat is a second person at the desk, not hidden behind the first', () => {
  const h = tempHome();
  try {
    const one = lines('one').prompt(0, 'a').tool(1, 'Write', { file_path: OFFICE_FILE }).reply(2, 'Done.');
    one.write(file(h, 'one'));
    lines('two', at(300)).prompt(0, 'b').tool(1, 'Write', { file_path: OFFICE_FILE }).write(file(h, 'two'));
    const { office, setNow } = setup(h, 302);
    office.scan();
    let s = office.snapshot();
    assert.deepEqual(s.people.filter((p) => p.state !== 'home').map((p) => `${p.seat}:${p.thread.id}`), ['1:two'], 'one went home hours ago; two has seat 1');
    // The first thread is resumed while the second is still at work.
    one.prompt(305, 'more').tool(306, 'Edit', { file_path: OFFICE_FILE }).write(file(h, 'one'));
    setNow(307);
    office.scan();
    s = office.snapshot();
    assert.deepEqual(s.people.filter((p) => p.state !== 'home').map((p) => `${p.seat}:${p.thread.id}`).sort(), ['1:two', '2:one']);
    assert.equal(s.projects.find((x) => x.folder === 'ai office overview').people.length, 2);
    // And it stays that way.
    setNow(308);
    assert.deepEqual(office.snapshot().people.filter((p) => p.state !== 'home').map((p) => `${p.seat}:${p.thread.id}`).sort(), ['1:two', '2:one']);
  } finally {
    h.done();
  }
});

test('Answered covers the need it was pressed for: a permission prompt that comes later (a hook, no new line) shows again', () => {
  const h = tempHome();
  try {
    lines('t1').prompt(0, 'go').tool(1, 'Write', { file_path: OFFICE_FILE }).reply(2, 'Which one?').write(file(h, 't1'));
    const { office, setNow } = setup(h, 3);
    office.scan();
    assert.deepEqual(office.snapshot().waiting.map((w) => w.id), ['t1']);
    office.markDone('t1');
    assert.deepEqual(office.snapshot().waiting, []);
    setNow(4);
    onHook(office, { event: 'Notification', session: 't1', message: 'Claude needs your permission to use Bash' });
    const s = office.snapshot();
    assert.equal(s.people[0].state, 'needs');
    assert.deepEqual(s.waiting.map((w) => w.id), ['t1'], 'a new need: back on the list');
    assert.equal(s.waiting[0].since, at(4), 'waiting since the prompt, not since the old reply');
    office.markDone('t1');
    assert.deepEqual(office.snapshot().waiting, []);
    setNow(5);
    onHook(office, { event: 'Notification', session: 't1', message: 'Claude needs your permission to use Edit' });
    assert.deepEqual(office.snapshot().waiting.map((w) => w.id), ['t1'], 'and again for the next one');
  } finally {
    h.done();
  }
});

test('a permission prompt from a hook is still waiting after the office restarts', () => {
  const h = tempHome();
  try {
    lines('t1').prompt(0, 'go').tool(1, 'Write', { file_path: OFFICE_FILE }).write(file(h, 't1'));
    const first = setup(h, 2);
    first.office.scan();
    onHook(first.office, { event: 'Notification', session: 't1', message: 'Claude needs your permission to use Bash' });
    first.office.save();
    const again = setup(h, 3);
    again.office.scan();
    const s = again.office.snapshot();
    const me = s.people.find((p) => p.folder === 'ai office overview');
    assert.equal(me.state, 'needs');
    assert.equal(me.words, 'Waiting for your permission');
    assert.deepEqual(s.waiting.map((w) => w.id), ['t1']);
  } finally {
    h.done();
  }
});

test('a damaged ledger, seats or settings file is copied aside before anything is written over it', () => {
  const h = tempHome();
  try {
    fs.mkdirSync(h.data, { recursive: true });
    const bad = { 'ledger.json': '{"threads": {"t1": ', 'seats.json': '{"ai office overview": {"1": {"nick": "Ma', 'settings.json': '{"openedAt": "2026-10-1' };
    for (const [n, text] of Object.entries(bad)) fs.writeFileSync(path.join(h.data, n), text);
    lines('t1').prompt(0, 'go').tool(1, 'Write', { file_path: OFFICE_FILE }).reply(2, 'Done.').write(file(h, 't1'));
    const { office } = setup(h, 3);
    office.scan();
    office.snapshot();
    office.save();
    office.setNickname('ai office overview', 1, 'Pat');
    const files = fs.readdirSync(h.data);
    for (const [n, text] of Object.entries(bad)) {
      const copies = files.filter((f) => f.startsWith(`${n.replace(/\.json$/, '')}.damaged-`));
      assert.equal(copies.length, 1, `one copy of the damaged ${n}`);
      assert.equal(fs.readFileSync(path.join(h.data, copies[0]), 'utf8'), text, `${n} kept exactly as it was`);
    }
  } finally {
    h.done();
  }
});

/** An office with no projects folder set: it has to guess one from where the threads started. */
function guessing(h, nowMin) {
  const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts, now: () => at(nowMin) });
  office.scan();
  return office;
}

test('threads started in four sibling project folders: the guess is their parent, and each is its own project', () => {
  const h = tempHome();
  try {
    const names = ['harbour', 'garden', 'ledger', 'atlas'];
    names.forEach((n, i) => {
      for (const k of [1, 2]) {
        const cwd = `${ROOT}\\${n}`;
        lines(`${n}${k}`).prompt(i, 'go', cwd).tool(i + 1, 'Write', { file_path: `${cwd}\\src\\a${k}.js` }, 10, cwd).write(file(h, `${n}${k}`));
      }
    });
    const office = guessing(h, 10);
    assert.equal(office.root(), ROOT);
    assert.deepEqual(office.snapshot().projects.map((p) => p.folder).sort(), [...names].sort());
  } finally {
    h.done();
  }
});

test('threads started in the projects folder itself keep it as the guess, even with one thread in a sibling folder', () => {
  const h = tempHome();
  try {
    for (const k of [1, 2, 3]) lines(`r${k}`).prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\p${k}\\a.md` }).write(file(h, `r${k}`));
    lines('notes').prompt(0, 'go', 'C:\\Work\\notes').tool(1, 'Write', { file_path: 'C:\\Work\\notes\\a.md' }, 10, 'C:\\Work\\notes').write(file(h, 'notes'));
    assert.equal(guessing(h, 5).root(), ROOT);
  } finally {
    h.done();
  }
});

test('one project folder alone stays the guess (the page then asks for the projects folder); a set folder always wins', () => {
  const h = tempHome();
  try {
    const cwd = `${ROOT}\\garden`;
    lines('g1').prompt(0, 'go', cwd).tool(1, 'Write', { file_path: `${cwd}\\a.md` }, 10, cwd).write(file(h, 'g1'));
    const office = guessing(h, 5);
    assert.equal(office.root(), cwd);
    office.settings.root = 'C:\\Elsewhere';
    assert.equal(office.root(), 'C:\\Elsewhere');
  } finally {
    h.done();
  }
});

test('project folders named constructor or toString are just names: the snapshot works and lists them', () => {
  const h = tempHome();
  try {
    for (const [id, name] of [['c1', 'constructor'], ['c2', 'toString'], ['c3', 'hasOwnProperty']]) {
      const cwd = `${ROOT}\\${name}`;
      lines(id).prompt(0, 'go', cwd).tool(1, 'Write', { file_path: `${cwd}\\a.md` }, 10, cwd).reply(2, 'Done.', 10, cwd).write(file(h, id));
    }
    const { office } = setup(h, 3);
    office.scan();
    const s = office.snapshot();
    // (Folders that are not on disk are named in lower case, as always.)
    assert.deepEqual(s.projects.map((p) => p.folder).sort(), ['constructor', 'hasownproperty', 'tostring']);
    assert.equal(s.people.length, 3);
    // A name or star on one is refused (it would reach every object), and nothing else breaks.
    assert.equal(office.setNickname('toString', 1, 'Pat'), false);
    assert.equal(office.setNickname('tostring', 1, 'Pat'), true, 'the lower-case name is not one of Object\'s');
    assert.equal(({}).toString, Object.prototype.toString);
  } finally {
    h.done();
  }
});

test('a data file another program holds at start is not taken as damaged: the office refuses to start and changes nothing', () => {
  const h = tempHome();
  const real = fs.readFileSync;
  try {
    fs.mkdirSync(h.data, { recursive: true });
    const ledger = path.join(h.data, 'ledger.json');
    fs.writeFileSync(ledger, '{"threads":{"t1":{"folder":"x","seat":1}}}');
    fs.writeFileSync(path.join(h.data, 'settings.json'), '{"openedAt":"2026-10-01T00:00:00.000Z","root":"C:\\\\Work"}');
    fs.readFileSync = function held(f, ...rest) {
      if (String(f) === ledger) { const e = new Error('EBUSY: resource busy or locked'); e.code = 'EBUSY'; throw e; }
      return real.call(this, f, ...rest);
    };
    assert.throws(() => setup(h, 3), /ledger\.json .*could not be read \(EBUSY\)/);
    fs.readFileSync = real;
    assert.equal(fs.readFileSync(ledger, 'utf8'), '{"threads":{"t1":{"folder":"x","seat":1}}}', 'the ledger is as it was');
    assert.ok(!fs.readdirSync(h.data).some((n) => n.includes('.damaged-')), 'nothing was set aside as damaged');
    assert.match(fs.readFileSync(path.join(h.data, 'settings.json'), 'utf8'), /"root"/, 'settings kept');
  } finally {
    fs.readFileSync = real;
    h.done();
  }
});

test('hook events: a burst of made-up ids keeps at most 2000, the newest', () => {
  const h = tempHome();
  try {
    const { office, setNow } = setup(h, 0);
    for (let i = 0; i < 2100; i++) { setNow(i / 1000); office.hook(`id-${i}`, 'working', 'Reading your message'); }
    const kept = JSON.parse(fs.readFileSync(path.join(h.data, 'hooks.json'), 'utf8'));
    assert.equal(Object.keys(kept).length, 2000);
    assert.ok(kept['id-2099'] && !kept['id-0'], 'the oldest went first');
  } finally {
    h.done();
  }
});

test('a token count from a damaged line can be neither negative nor endless', () => {
  const h = tempHome();
  try {
    const raw = (n, out) => ({ type: 'assistant', timestamp: new Date(at(n)).toISOString(), cwd: ROOT, sessionId: 'z1', message: { id: `m${n}`, stop_reason: 'end_turn', usage: { output_tokens: out }, content: [{ type: 'text', text: 'ok' }] } });
    lines('z1').prompt(0, 'go').raw(raw(1, -5000)).raw(raw(2, 1e300)).raw(raw(3, 'lots')).write(file(h, 'z1'));
    const { office } = setup(h, 4);
    office.scan();
    const s = office.snapshot();
    assert.ok(Number.isFinite(s.earned) && s.earned >= 0 && s.earned <= 1e8, `earned ${s.earned}`);
  } finally {
    h.done();
  }
});

test('Answered takes a person off Needs attention and out of "Needs you" until they ask again', () => {
  const h = tempHome();
  try {
    lines('q1').prompt(0, 'go').tool(1, 'Write', { file_path: OFFICE_FILE }).reply(2, 'Shall I push it now?').write(file(h, 'q1'));
    const { office } = setup(h, 3);
    office.scan();
    let me = office.snapshot().people.find((p) => p.folder === 'ai office overview');
    assert.equal(me.state, 'needs');
    assert.equal(office.markDone('q1'), true);
    const s = office.snapshot();
    me = s.people.find((p) => p.folder === 'ai office overview');
    assert.equal(me.state, 'idle');
    assert.equal(me.words, 'Answered');
    assert.deepEqual(s.waiting, []);
    assert.equal(s.projects[0].needs, 0);
    // Asking again brings it all back.
    lines('q1').prompt(0, 'go').tool(1, 'Write', { file_path: OFFICE_FILE }).reply(2, 'Shall I push it now?').prompt(4, 'not yet').reply(5, 'Shall I push it tomorrow?').write(file(h, 'q1'));
    office.scan();
    me = office.snapshot().people.find((p) => p.folder === 'ai office overview');
    assert.equal(me.state, 'needs');
  } finally {
    h.done();
  }
});
