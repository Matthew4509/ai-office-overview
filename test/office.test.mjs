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
