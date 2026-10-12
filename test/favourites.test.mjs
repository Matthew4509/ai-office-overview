import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Office } from '../src/office.mjs';
import { tempHome, lines, ROOT } from './helpers.mjs';

const BASE = Date.parse('2026-10-12T00:00:00Z');
const at = (min) => BASE + min * 60000;
const file = (h, id) => path.join(h.transcripts, 'C--Work-projects', `${id}.jsonl`);

function open(h, nowMin) {
  const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts, now: () => at(nowMin) });
  office.settings.root = ROOT;
  office.scan();
  return office;
}

test('a favourite person is kept by seat, so the next thread in that seat is a favourite too, and it lasts a restart', () => {
  const h = tempHome();
  try {
    lines('one').prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\garden\\a.md` }, 100).reply(2, 'Done.', 10).write(file(h, 'one'));
    let office = open(h, 3);
    let p = office.snapshot().people.find((x) => x.folder === 'garden');
    assert.equal(p.fav, false);
    office.setFavourite('garden', 1, true);
    office.save();
    // Hours later the thread has gone home, and a new one starts in the same folder: the same seat, still a favourite.
    lines('two', at(300)).prompt(0, 'go on').tool(1, 'Edit', { file_path: `${ROOT}\\garden\\a.md` }, 40).write(file(h, 'two'));
    office = open(h, 301);
    p = office.snapshot().people.find((x) => x.folder === 'garden');
    assert.equal(p.seat, 1);
    assert.equal(p.fav, true);
    assert.equal(p.favSeat, true);
    assert.equal(p.favProject, false);
    office.setFavourite('garden', 1, false);
    assert.equal(office.snapshot().people.find((x) => x.folder === 'garden').fav, false);
  } finally {
    h.done();
  }
});

test('a favourite project makes everyone in it a favourite; others are not', () => {
  const h = tempHome();
  try {
    lines('a').prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\garden\\a.md` }, 100).write(file(h, 'a'));
    lines('b').prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\garden\\b.md` }, 100).write(file(h, 'b'));
    lines('c').prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\birds\\c.md` }, 100).write(file(h, 'c'));
    const office = open(h, 2);
    office.setFavouriteProject('garden', true);
    let s = office.snapshot();
    assert.deepEqual(s.favProjects, ['garden']);
    assert.deepEqual(s.people.filter((x) => x.folder === 'garden').map((x) => [x.fav, x.favProject, x.favSeat]), [[true, true, false], [true, true, false]]);
    assert.equal(s.people.find((x) => x.folder === 'birds').fav, false);
    office.setFavouriteProject('garden', false);
    s = office.snapshot();
    assert.deepEqual(s.favProjects, []);
    assert.ok(s.people.every((x) => !x.fav));
  } finally {
    h.done();
  }
});

test('an old favourite can be hidden and shown again; starring again clears the hide', () => {
  const h = tempHome();
  try {
    lines('one').prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\garden\\a.md` }, 100).reply(2, 'Done.', 10).write(file(h, 'one'));
    const office = open(h, 300);
    office.setFavourite('garden', 1, true);
    office.setFavouriteHidden('garden', 1, true);
    let p = office.snapshot().people.find((x) => x.folder === 'garden');
    assert.equal(p.state, 'home');
    assert.deepEqual([p.fav, p.favHidden], [true, true]);
    office.setFavouriteHidden('garden', 1, false);
    assert.equal(office.snapshot().people.find((x) => x.folder === 'garden').favHidden, false);
    office.setFavouriteHidden('garden', 1, true);
    office.setFavourite('garden', 1, true);
    p = office.snapshot().people.find((x) => x.folder === 'garden');
    assert.deepEqual([p.fav, p.favHidden], [true, false]);
  } finally {
    h.done();
  }
});
