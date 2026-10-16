import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Office } from '../src/office.mjs';
import { shopOf, buy, SHOP, trophyOf, roomsOf } from '../src/shop.mjs';
import { tempHome, lines, ROOT } from './helpers.mjs';

const BASE = Date.parse('2026-10-12T00:00:00Z');
const at = (min) => BASE + min * 60000;
const file = (h, id) => path.join(h.transcripts, 'C--Work-projects', `${id}.jsonl`);

/** An office opened at minute 60: a thread wrote 900K before it opened and 500K after. */
function opened(h) {
  lines('t').prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\ai office overview\\a.md` }, 900_000).tool(70, 'Write', { file_path: `${ROOT}\\ai office overview\\b.md` }, 500_000).reply(71, 'Done.', 0).write(file(h, 't'));
  let now = at(60);
  const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts, now: () => now });
  office.settings.root = ROOT;
  now = at(72);
  office.scan();
  return office;
}

test('prices are TOMLIN x 20, plus pet rocks, rubber ducks, the office\'s own room keys, sandwiches, plants, arcade machine and volleyball set', () => {
  const price = Object.fromEntries(SHOP.map((i) => [i.id, i.price]));
  assert.deepEqual(price, { coffee: 200_000, donuts: 500_000, sandwiches: 400_000, rocks: 200_000, ducks: 300_000, boardroom_key: 20_000_000, lounge_key: 10_000_000, table: 1_500_000, chairs: 500_000, whiteboard: 800_000, plants: 600_000, armchair: 600_000, bookcase: 1_000_000, sofa: 1_200_000, tv: 1_500_000, gym: 10_000_000, arcade: 2_500_000, deckchair: 1_000_000, volleyball: 2_000_000 });
});

test('only tokens written after the office opened go into the purse; the rest is shown on the person', () => {
  const h = tempHome();
  try {
    const office = opened(h);
    const s = office.snapshot();
    assert.equal(s.earned, 500_000);
    const p = s.people.find((x) => x.folder === 'ai office overview');
    assert.equal(p.out, 1_400_000);
    assert.equal(p.outSince, 500_000);
    assert.equal(shopOf(office, s.earned).purse.left, 500_000);
  } finally {
    h.done();
  }
});

test('buying coffee takes 200K from the purse and is kept; too dear is refused with a reason and a way out', () => {
  const h = tempHome();
  try {
    const office = opened(h);
    const r = buy(office, 'coffee');
    assert.equal(r.ok, true);
    assert.equal(r.shop.purse.left, 300_000);
    assert.equal(shopOf(office, office.snapshot().earned).purse.spent, 200_000, 'kept on disk');
    assert.deepEqual(shopOf(office, 0).recent.map((b) => [b.item, b.price]), [['coffee', 200_000]], 'the recent purchases list, newest first');
    const no = buy(office, 'lounge_key');
    assert.match(no.error.fault, /Not enough tokens yet/);
    assert.ok(no.error.reason && no.error.wayOut);
    assert.match(buy(office, 'nothing').error.fault, /not in the shop/);
  } finally {
    h.done();
  }
});

test('the rooms follow what is bought', () => {
  const h = tempHome();
  try {
    const office = opened(h);
    // Plenty to spend: a big thread after opening (35.5M: 30M for the two keys, then 5.5M).
    lines('big', at(73)).prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}\\ai office overview\\c.md` }, 35_000_000).write(file(h, 'big'));
    office.now = () => at(75);
    office.scan();
    assert.equal(buy(office, 'boardroom_key').ok, true);
    assert.equal(buy(office, 'lounge_key').ok, true);
    assert.equal(buy(office, 'table').ok, true);
    assert.equal(buy(office, 'chairs').ok, true);
    let rooms = shopOf(office, office.snapshot().earned).rooms;
    assert.equal(rooms.boardroom.table, true);
    assert.equal(rooms.boardroom.chairs, 2);
    assert.equal(rooms.volleyball, false);
    assert.equal(buy(office, 'table').error.fault, 'The office has the meeting room table already.');
    assert.equal(buy(office, 'arcade').ok, true);
    rooms = shopOf(office, office.snapshot().earned).rooms;
    assert.equal(rooms.lounge.arcade, true);
    assert.ok(rooms.rest.includes('arcade'), 'the arcade machine is a place to rest');
    assert.match(buy(office, 'volleyball').error.fault, /Not enough tokens yet/, '1M left of 5.5M: the 2M set must wait');
  } finally {
    h.done();
  }
});

test('the meeting room and the lounge start locked: their items are refused until the key is bought', () => {
  const h = tempHome();
  try {
    const office = opened(h);
    lines('big', at(73)).prompt(0, 'go').tool(1, 'Write', { file_path: `${ROOT}/ai office overview/c.md` }, 25_000_000).write(file(h, 'big'));
    office.now = () => at(75);
    office.scan();
    let s = shopOf(office, office.snapshot().earned);
    assert.deepEqual(s.rooms.locked, { boardroom: true, lounge: true });
    assert.equal(s.items.find((i) => i.id === 'table').locked, true);
    assert.equal(s.items.find((i) => i.id === 'arcade').locked, true);
    assert.equal(s.items.find((i) => i.id === 'deckchair').locked, false, 'the beach has no lock');
    assert.equal(s.items.find((i) => i.id === 'coffee').locked, false, 'treats have no lock');
    const no = buy(office, 'table');
    assert.equal(no.error.fault, 'The meeting room is locked.');
    assert.match(no.error.wayOut, /Unlock the meeting room first \(20,000,000 tokens\)/);
    assert.equal(buy(office, 'chairs').error.fault, 'The meeting room is locked.', 'locked comes before "table first"');
    assert.equal(buy(office, 'gym').error.fault, 'The lounge is locked.');
    assert.equal(shopOf(office, 0).purse.spent, 0, 'nothing was taken for a refused item');
    // The lounge key opens the lounge only.
    assert.equal(buy(office, 'lounge_key').ok, true);
    s = shopOf(office, office.snapshot().earned);
    assert.deepEqual(s.rooms.locked, { boardroom: true, lounge: false });
    assert.equal(s.items.find((i) => i.id === 'lounge_key').owned, true);
    assert.equal(s.items.find((i) => i.id === 'arcade').locked, false);
    assert.equal(buy(office, 'arcade').ok, true);
    assert.equal(buy(office, 'lounge_key').error.fault, 'The lounge is unlocked already.');
    assert.match(buy(office, 'boardroom_key').error.fault, /Not enough tokens yet/, '25.5M - 10M - 2.5M leaves 13M of 20M');
  } finally {
    h.done();
  }
});

test('a room furnished before the locks came stays open: what was paid for stays where it is', () => {
  const h = tempHome();
  try {
    const office = opened(h);
    fs.mkdirSync(h.data, { recursive: true });
    fs.writeFileSync(path.join(h.data, 'office.json'), JSON.stringify({ bought: [{ item: 'sofa', price: 1_200_000, at: '2026-10-12T05:00:00Z' }] }));
    const s = shopOf(office, office.snapshot().earned);
    assert.deepEqual(s.rooms.locked, { boardroom: true, lounge: false });
    assert.equal(s.rooms.lounge.sofa, true);
    assert.equal(s.items.find((i) => i.id === 'lounge_key').owned, true, 'no key to buy for a room already open');
    assert.equal(buy(office, 'lounge_key').error.fault, 'The lounge is unlocked already.');
  } finally {
    h.done();
  }
});

test('the trophy case comes only once every room is unlocked, every piece bought and the team treated; dated by the last of them', () => {
  const all = [];
  let minute = 0;
  const add = (item) => all.push({ item, price: 1, at: new Date(BASE + (minute += 1) * 60000).toISOString() });
  for (const i of SHOP.filter((x) => x.keeps)) for (let n = 0; n < i.most; n++) add(i.id);
  assert.equal(trophyOf(all), null, 'everything bought, but the team not treated yet');
  add('coffee');
  add('donuts');
  assert.equal(roomsOf(all).trophy, null, 'one treat still to go');
  add('sandwiches');
  const done = all.at(-1).at;
  add('coffee');
  assert.deepEqual(trophyOf(all), { at: done }, 'dated by the purchase that finished it, not by later ones');
  assert.equal(trophyOf(all.filter((b, i) => !(b.item === 'deckchair' && i === all.findIndex((x) => x.item === 'deckchair')))), null, 'one deck chair short: no trophy');
});
