// The shop: the office's rewards, priced
// for the output tokens a day of AI coding work writes. The purse is every output token written since the
// office opened, less what was spent. What is bought is kept in data/office.json, oldest first.

import fs from 'node:fs';
import path from 'node:path';

export const SHOP = [
  { id: 'coffee', name: 'Coffee round', the: 'the coffee round', price: 200_000, keeps: false, most: 0, room: 'treats' },
  { id: 'donuts', name: 'Box of donuts', the: 'the box of donuts', price: 500_000, keeps: false, most: 0, room: 'treats' },
  { id: 'sandwiches', name: 'Sandwich platter', the: 'the sandwich platter', price: 400_000, keeps: false, most: 0, room: 'treats' },
  { id: 'rocks', name: 'Pet rocks', the: 'the pet rocks', price: 200_000, keeps: true, most: 1, room: 'desks' },
  { id: 'ducks', name: 'Rubber ducks', the: 'the rubber ducks', price: 300_000, keeps: true, most: 1, room: 'desks' },
  { id: 'boardroom_key', name: 'Unlock the meeting room', the: 'the meeting room key', price: 20_000_000, keeps: true, most: 1, room: 'boardroom', unlocks: 'boardroom' },
  { id: 'lounge_key', name: 'Unlock the lounge', the: 'the lounge key', price: 10_000_000, keeps: true, most: 1, room: 'lounge', unlocks: 'lounge' },
  { id: 'table', name: 'Meeting room table', the: 'the meeting room table', price: 1_500_000, keeps: true, most: 1, room: 'boardroom' },
  { id: 'chairs', name: 'Pair of meeting room chairs', the: 'a pair of meeting room chairs', price: 500_000, keeps: true, most: 3, room: 'boardroom', needs: 'table' },
  { id: 'whiteboard', name: 'Whiteboard', the: 'the whiteboard', price: 800_000, keeps: true, most: 1, room: 'boardroom' },
  { id: 'plants', name: 'Indoor plants', the: 'the indoor plants', price: 600_000, keeps: true, most: 1, room: 'boardroom' },
  { id: 'armchair', name: 'Armchair', the: 'the armchair', price: 600_000, keeps: true, most: 1, room: 'lounge' },
  { id: 'bookcase', name: 'Bookcase', the: 'the bookcase', price: 1_000_000, keeps: true, most: 1, room: 'lounge' },
  { id: 'sofa', name: 'Sofa', the: 'the sofa', price: 1_200_000, keeps: true, most: 1, room: 'lounge' },
  { id: 'tv', name: 'TV', the: 'the TV', price: 1_500_000, keeps: true, most: 1, room: 'lounge' },
  { id: 'gym', name: 'Gym equipment', the: 'the gym equipment', price: 10_000_000, keeps: true, most: 1, room: 'lounge' },
  { id: 'arcade', name: 'Arcade machine', the: 'the arcade machine', price: 2_500_000, keeps: true, most: 1, room: 'lounge' },
  { id: 'deckchair', name: 'Deck chair and umbrella', the: 'a deck chair and umbrella', price: 1_000_000, keeps: true, most: 6, room: 'beach' },
  { id: 'volleyball', name: 'Beach volleyball set', the: 'the beach volleyball set', price: 2_000_000, keeps: true, most: 1, room: 'beach' },
];

const PLACE = { desks: 'on the desks', treats: 'the kitchen', boardroom: 'the meeting room', lounge: 'the lounge', beach: 'on the beach' };
const LOUNGE_SPOTS = { nap: 'armchair', library: 'bookcase', chat: 'sofa', tv: 'tv', treadmill: 'gym', weights: 'gym', arcade: 'arcade' };
const countOf = (bought, id) => bought.filter((b) => b.item === id).length;
const n = (x) => Number(x || 0).toLocaleString('en-GB');
/** The rooms that start locked, and the key that opens each. */
const KEYS = Object.fromEntries(SHOP.filter((i) => i.unlocks).map((i) => [i.unlocks, i]));

/**
 * Which rooms are still locked. A room opens with its key, or when anything for it was bought before the rooms had
 * locks: what was paid for stays where it is.
 */
export function locksOf(bought) {
  const open = (room) => bought.some((b) => SHOP.find((i) => i.id === b.item)?.room === room);
  return Object.fromEntries(Object.keys(KEYS).map((room) => [room, !open(room)]));
}

function fileOf(office) { return path.join(office.dataDir, 'office.json'); }

/** Purchases as kept, oldest first; unknown items dropped. */
export function boughtOf(office) {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(fileOf(office), 'utf8')); } catch (e) {
    raw = {};
    // There but unreadable: copied aside first, so the next purchase cannot wipe what was bought before.
    if (e.code !== 'ENOENT') try { fs.copyFileSync(fileOf(office), fileOf(office).replace(/\.json$/, '') + '.damaged-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'); } catch {}
  }
  const list = Array.isArray(raw.bought) ? raw.bought : [];
  return list.filter((b) => b && SHOP.some((i) => i.id === b.item)).map((b) => ({ item: b.item, price: Math.max(0, Math.round(Number(b.price) || 0)), at: String(b.at || '').slice(0, 40) }));
}

export function purseOf(earned, bought) {
  const spent = bought.reduce((a, b) => a + b.price, 0);
  const e = Math.max(0, Math.round(earned) || 0);
  return { earned: e, spent, left: Math.max(0, e - spent) };
}

/** The treats that count for "taking care of the team" (pizza is free, so it is not kept). */
const TREATS = ['coffee', 'donuts', 'sandwiches'];
/** Everything done: every room unlocked, every piece bought as many times as the office holds, and the team treated
 * to each treat at least once. */
function allDone(bought) {
  const locked = locksOf(bought);
  return Object.values(locked).every((l) => !l)
    && SHOP.filter((i) => i.keeps && !i.unlocks).every((i) => countOf(bought, i.id) >= i.most)
    && TREATS.every((id) => countOf(bought, id) > 0);
}
/** The trophy case (World's Best Boss): earned with the purchase that finished everything, and dated by it; null until
 * then. It is never sold: it comes by itself. */
export function trophyOf(bought) {
  if (!allDone(bought)) return null;
  for (let k = 1; k <= bought.length; k++) if (allDone(bought.slice(0, k))) return { at: bought[k - 1].at };
  return null;
}

export function roomsOf(bought) {
  const has = (id) => countOf(bought, id) > 0;
  const lounge = Object.entries(LOUNGE_SPOTS).filter(([, id]) => has(id)).map(([spot]) => spot);
  return {
    boardroom: { table: has('table'), chairs: Math.min(3, countOf(bought, 'chairs')) * 2, whiteboard: has('whiteboard'), plants: has('plants') },
    lounge: { armchair: has('armchair'), bookcase: has('bookcase'), sofa: has('sofa'), tv: has('tv'), gym: has('gym'), arcade: has('arcade') },
    rest: ['coffee', 'vending', 'lunch', ...lounge],
    away: lounge.length ? lounge : ['window'],
    deckchairs: Math.min(6, countOf(bought, 'deckchair')),
    volleyball: has('volleyball'),
    ducks: has('ducks'),
    rocks: has('rocks'),
    trophy: trophyOf(bought),
    locked: locksOf(bought),
  };
}

/** What the page needs: the purse, every item with how many are had, the last few purchases (newest first), and what the rooms offer. */
export function shopOf(office, earned) {
  const bought = boughtOf(office);
  const e = earned ?? office.lastEarned ?? 0;
  const locked = locksOf(bought);
  return {
    purse: purseOf(e, bought),
    recent: bought.slice(-6).reverse(),
    items: SHOP.map((i) => {
      const have = i.keeps ? countOf(bought, i.id) : 0;
      // A key bought (or a room opened by what was bought there before the locks) shows as owned.
      const owned = i.unlocks ? !locked[i.unlocks] : i.keeps && have >= i.most;
      return { ...i, have, owned, locked: !i.unlocks && !!locked[i.room], waits: !!i.needs && !countOf(bought, i.needs) };
    }),
    rooms: roomsOf(bought),
  };
}

/** Buying an item: the new shop, or why not (fault, reason, way out). */
export function buy(office, item, now = new Date()) {
  const i = SHOP.find((x) => x.id === item);
  const no = (fault, reason, wayOut) => ({ error: { fault, reason, wayOut } });
  if (!i) return no('That is not in the shop.', 'The office does not sell it.', 'Pick something from the shop.');
  const bought = boughtOf(office);
  const have = countOf(bought, i.id);
  const locked = locksOf(bought);
  if (i.unlocks && !locked[i.unlocks]) return no(`${PLACE[i.unlocks][0].toUpperCase()}${PLACE[i.unlocks].slice(1)} is unlocked already.`, 'Its key is kept for good.', 'Furnish it from the list below.');
  if (!i.unlocks && locked[i.room]) {
    const key = KEYS[i.room];
    return no(`${PLACE[i.room][0].toUpperCase()}${PLACE[i.room].slice(1)} is locked.`, `${i.name} can be bought once ${PLACE[i.room]} is unlocked.`, `Unlock ${PLACE[i.room]} first (${n(key.price)} tokens), then buy it.`);
  }
  if (i.keeps && have >= i.most) {
    if (i.id === 'chairs') return no('The meeting room has all six chairs already.', 'There is no room round the table for more.', 'Pick something else.');
    if (i.id === 'deckchair') return no(`The beach has all ${i.most} deck chairs already.`, 'There is no room on the sand for more.', 'Pick something else.');
    return no(`The office has ${i.the} already.`, `It stays in ${PLACE[i.room]}.`, 'Pick something else.');
  }
  const needs = i.needs ? SHOP.find((x) => x.id === i.needs) : null;
  if (needs && !countOf(bought, needs.id)) return no(`Buy ${needs.the} first.`, 'The chairs go round it.', `Buy ${needs.the}, then the chairs.`);
  const earned = office.snapshot().earned;
  const left = purseOf(earned, bought).left;
  if (left < i.price) return no(`Not enough tokens yet for ${i.the}.`, `It costs ${n(i.price)} and the office has ${n(left)} to spend.`, 'Every token Claude writes from now on adds to it: come back after some work.');
  bought.push({ item: i.id, price: i.price, at: now.toISOString() });
  fs.mkdirSync(office.dataDir, { recursive: true });
  const tmp = `${fileOf(office)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ bought }, null, 1));
  fs.renameSync(tmp, fileOf(office));
  return { ok: true, item: i.id, shop: shopOf(office, earned) };
}
