import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOf, startHereProject, folderOf, stateOf, assignSeats, defaultName } from '../src/people.mjs';
import { emptyThread } from '../src/transcript.mjs';

const ROOT = 'C:\\Work\\projects';
const NAMES = ['ai office overview', 'Tomlin', 'garden planner B'];

test('a path belongs to the first folder under the projects folder, spelt as on disk', () => {
  assert.equal(projectOf('C:\\Work\\projects\\tomlin\\src\\a.ts', ROOT, NAMES), 'Tomlin');
  assert.equal(projectOf('/c/Work/projects/ai office overview/PLAN.md', ROOT, NAMES), 'ai office overview');
  assert.equal(projectOf('C:\\Work\\projects\\usage.json', ROOT, NAMES), null);
  assert.equal(projectOf('C:\\Users\\me\\.claude\\memory\\x.md', ROOT, NAMES), null);
});

test('START HERE points at a project, with or without the full path', () => {
  assert.equal(startHereProject('Phase 2 — START HERE garden planner B/HANDOFF.md', ROOT, NAMES), 'garden planner B');
  assert.equal(startHereProject('START HERE C:\\Work\\projects\\Tomlin\\docs\\H.md', ROOT, NAMES), 'Tomlin');
  assert.equal(startHereProject('hello', ROOT, NAMES), null);
});

function thread(o) { return Object.assign(emptyThread('t'), { cwd: ROOT, startCwd: ROOT }, o); }

test('the folder: files written decide; two projects = the projects folder; else START HERE, else where it is', () => {
  assert.equal(folderOf(thread({ wrote: ['C:\\Work\\projects\\Tomlin\\a.ts'] }), ROOT, NAMES), 'Tomlin');
  assert.equal(folderOf(thread({ wrote: ['C:\\Work\\projects\\Tomlin\\a.ts', 'C:\\Work\\projects\\ai office overview\\b.md'] }), ROOT, NAMES), '');
  assert.equal(folderOf(thread({ firstPrompt: 'START HERE ai office overview/H.md' }), ROOT, NAMES), 'ai office overview');
  assert.equal(folderOf(thread({ startCwd: 'C:\\Work\\projects\\Tomlin', cwd: 'C:\\Work\\projects\\Tomlin' }), ROOT, NAMES), 'Tomlin');
  assert.equal(folderOf(thread({}), ROOT, NAMES), '');
});

test('with no work yet, the folder is where the thread started, however its shell moves after', () => {
  const t = thread({ startCwd: 'C:\\Work\\projects\\Tomlin' });
  for (const cwd of ['C:\\Work\\projects', 'C:\\Work\\projects\\garden planner B', 'C:\\Work\\projects\\Tomlin']) {
    assert.equal(folderOf({ ...t, cwd }, ROOT, NAMES), 'Tomlin');
  }
  // Started in the projects folder: a Consultant until it works somewhere, wherever it looks around.
  assert.equal(folderOf(thread({ cwd: 'C:\\Work\\projects\\garden planner B' }), ROOT, NAMES), '');
  // An old summary with no start folder still uses the folder it is in.
  assert.equal(folderOf(thread({ startCwd: '', cwd: 'C:\\Work\\projects\\Tomlin' }), ROOT, NAMES), 'Tomlin');
  assert.equal(folderOf(thread({ ran: [{ cmd: 'npm test', cwd: '/c/Work/projects/Tomlin' }] }), ROOT, NAMES), 'Tomlin');
});

test('a helper counts toward the folder only if it did real work', () => {
  const t = thread({ wrote: ['C:\\Work\\projects\\Tomlin\\a.ts'] });
  const reader = thread({ wrote: [], cwd: 'C:\\Work\\projects\\ai office overview', worked: false });
  const writer = thread({ wrote: ['C:\\Work\\projects\\ai office overview\\x.md'], worked: true });
  assert.equal(folderOf(t, ROOT, NAMES, [reader]), 'Tomlin');
  assert.equal(folderOf(t, ROOT, NAMES, [writer]), '');
});

test('states: working, thinking, needs you, idle, gone home', () => {
  const at = '2026-10-12T01:00:00.000Z';
  const ms = Date.parse(at);
  const H = 3600000;
  const t = (last, asked = '') => thread({ lastAt: at, last: { ...last, at }, asked });
  assert.equal(stateOf(t({ kind: 'tool', tool: 'Edit', words: 'Editing a.ts' }), ms + 5000, H).words, 'Editing a.ts');
  assert.equal(stateOf(t({ kind: 'result' }), ms + 5000, H).state, 'working');
  assert.equal(stateOf(t({ kind: 'result' }), ms + 60000, H).state, 'thinking');
  assert.equal(stateOf(t({ kind: 'result' }), ms + 20 * 60000, H).state, 'idle');
  assert.equal(stateOf(t({ kind: 'done' }, 'Prices?'), ms + 60000, H).state, 'needs');
  assert.equal(stateOf(t({ kind: 'done' }), ms + 60000, H).state, 'idle');
  assert.equal(stateOf(t({ kind: 'tool', tool: 'AskUserQuestion' }), ms + 60000, H).state, 'needs');
  assert.equal(stateOf(t({ kind: 'done' }, 'Prices?'), ms + 2 * H, H).state, 'home');
});

test('a hook event newer than the transcript wins', () => {
  const at = '2026-10-12T01:00:00.000Z';
  const ms = Date.parse(at);
  const t = thread({ lastAt: at, last: { kind: 'tool', tool: 'Bash', words: 'Running a command', at } });
  assert.equal(stateOf(t, ms + 60000, 3600000, [], { kind: 'needs', words: 'Waiting for your permission', at: ms + 30000 }).state, 'needs');
  assert.equal(stateOf(t, ms + 60000, 3600000, [], { kind: 'needs', at: ms - 1000 }).state, 'working');
});

test('seats: a second thread at the same time takes seat 2; the next handover gets seat 1 back', () => {
  const H = 3600000;
  const t = (id, start, end, folder = 'ai office overview') => ({ id, folder, startedAt: start, lastAt: end, active: false });
  const threads = [
    t('a', '2026-10-12T01:00:00Z', '2026-10-12T02:00:00Z'),
    t('b', '2026-10-12T01:30:00Z', '2026-10-12T01:40:00Z'),
    t('c', '2026-10-12T05:00:00Z', '2026-10-12T06:00:00Z'),
    t('d', '2026-10-12T01:10:00Z', '2026-10-12T01:20:00Z', ''),
  ];
  const s = assignSeats(threads, {}, H, Date.parse('2026-10-12T07:00:00Z'));
  assert.deepEqual([s.a.seat, s.b.seat, s.c.seat, s.d.seat], [1, 2, 1, 1]);
  assert.equal(s.d.folder, '');
});

test('a seat once given stays; an active thread that moved folder takes a seat in the new one', () => {
  const kept = { a: { folder: 'Tomlin', seat: 3 } };
  const now = Date.parse('2026-10-12T02:00:00Z');
  const one = [{ id: 'a', folder: 'Tomlin', startedAt: '2026-10-12T01:00:00Z', lastAt: '2026-10-12T01:59:00Z', active: true }];
  assert.deepEqual(assignSeats(one, kept, 3600000, now).a, { folder: 'Tomlin', seat: 3 });
  const moved = [{ ...one[0], folder: '' }];
  assert.deepEqual(assignSeats(moved, kept, 3600000, now).a, { folder: '', seat: 1 });
  const ended = [{ ...one[0], folder: '', active: false }];
  assert.deepEqual(assignSeats(ended, kept, 3600000, now).a, { folder: 'Tomlin', seat: 3 });
});

test('an old thread that comes back to find its seat taken moves to the next one; the thread at work keeps it', () => {
  const H = 3600000;
  const now = Date.parse('2026-10-12T13:00:00Z');
  // a sat in seat 1 and went home at 10:30; b took seat 1 at noon and is still at work; a is resumed at 13:00.
  const kept = { a: { folder: 'ai office overview', seat: 1, lastAt: '2026-10-12T10:30:00Z' }, b: { folder: 'ai office overview', seat: 1, lastAt: '2026-10-12T12:59:50Z' } };
  const a = { id: 'a', folder: 'ai office overview', startedAt: '2026-10-12T10:00:00Z', lastAt: '2026-10-12T13:00:00Z', active: true };
  const b = { id: 'b', folder: 'ai office overview', startedAt: '2026-10-12T12:00:00Z', lastAt: '2026-10-12T12:59:55Z', active: true };
  const s = assignSeats([a, b], kept, H, now);
  assert.deepEqual([s.a.seat, s.b.seat], [2, 1]);
  // Whichever started first: the one that came back is the one that moves.
  const s2 = assignSeats([{ ...a, startedAt: '2026-10-12T12:30:00Z' }, { ...b, startedAt: '2026-10-12T09:00:00Z' }], kept, H, now);
  assert.deepEqual([s2.a.seat, s2.b.seat], [2, 1]);
  // Once apart they stay apart, and a thread that went home keeps its seat on record.
  const later = { a: { ...s.a, lastAt: a.lastAt }, b: { ...s.b, lastAt: b.lastAt } };
  const s3 = assignSeats([a, b], later, H, now + 3000);
  assert.deepEqual([s3.a.seat, s3.b.seat], [2, 1]);
  const s4 = assignSeats([{ ...a, active: false }, b], later, H, now + 2 * H);
  assert.deepEqual([s4.a.seat, s4.b.seat], [2, 1]);
  // The office was closed while both came and went (neither record is fresh): the older thread is the one that moves.
  const stale = { a: { folder: 'ai office overview', seat: 1, lastAt: '2026-10-12T08:00:00Z' }, b: { folder: 'ai office overview', seat: 1, lastAt: '2026-10-12T08:30:00Z' } };
  const s5 = assignSeats([a, b], stale, H, now);
  assert.deepEqual([s5.a.seat, s5.b.seat], [2, 1]);
});

test('default names: folder, then folder 2; the projects folder is Consultant', () => {
  assert.equal(defaultName('ai office overview', 1), 'ai office overview');
  assert.equal(defaultName('ai office overview', 2), 'ai office overview 2');
  assert.equal(defaultName('', 1), 'Consultant');
  assert.equal(defaultName('', 3), 'Consultant 3');
});

test('a helper that finishes after the thread asked you something does not hide the question', () => {
  const H = 3600000;
  const asked = '2026-10-12T01:00:00.000Z';
  const later = '2026-10-12T01:00:30.000Z';
  const ms = Date.parse(later) + 5000;
  const finished = thread({ lastAt: later, last: { kind: 'done', at: later } });
  const boss = thread({ lastAt: asked, last: { kind: 'done', at: asked }, asked: 'Which one?' });
  assert.deepEqual(stateOf(boss, ms, H, [finished]), { state: 'needs', words: 'Asked you something', since: Date.parse(asked) });
  const asking = thread({ lastAt: asked, last: { kind: 'tool', tool: 'AskUserQuestion', at: asked } });
  assert.equal(stateOf(asking, ms, H, [finished]).state, 'needs');
  const plain = thread({ lastAt: asked, last: { kind: 'done', at: asked } });
  assert.equal(stateOf(plain, ms, H, [finished]).words, 'Finished');
  // Still waiting for its helper (the thread's own last step is the helper's job): the helper is finishing up.
  const waiting = thread({ lastAt: asked, last: { kind: 'tool', tool: 'Agent', words: 'Handing a job to a helper', at: asked } });
  assert.equal(stateOf(waiting, ms, H, [finished]).words, 'A helper is finishing up');
});
