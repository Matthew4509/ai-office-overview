// The office: TOMLIN's Staff overview office (Tomlin/public/office.js) seen from above, with AI threads for staff.
// Each project folder with someone in today is a desk (Consultants for the projects folder itself); seat 1 sits at it,
// seats 2 and on share it along an extended table. Working (editing, running, reading) is at the desk; a thread that
// stopped to ask something stands up beside the desk with a "?" over their head; a long think goes to the meeting room
// once it has a table, and whoever has finished comes to help; with nothing to do they stretch, then rest in the
// kitchen or the lounge (what is bought), and later take a deck chair on the beach (once bought). A thread gone quiet
// walks out of the front door. The shop (the tokens the AI writes) furnishes the rooms. Draws only while on screen.
'use strict';

(() => {
  const L = window.officeLook;
  const W = 1200;
  /** The building is the top 800; outside the front door, the path and the beach. */
  const H = 940;
  const COLS = 60;
  const ROWS = 40;
  const INK = '#27364e';
  const PALETTE = ['#69bfe9', '#b29be4', '#78c6a3', '#ef8a91', '#efbd72', '#74a7d0'];
  const ROOMS = [
    { name: 'Computer room', x: 20, y: 20, w: 540, h: 340, fill: '#e8eff2' },
    { name: 'Meeting room', x: 640, y: 20, w: 540, h: 340, fill: '#e9e7f1', lock: 'boardroom' },
    { name: 'Kitchen', x: 20, y: 440, w: 540, h: 340, fill: '#f3e9dc' },
    { name: 'Lounge and library', x: 640, y: 440, w: 540, h: 340, fill: '#e0ece7', lock: 'lounge' },
  ];
  /** Places round the kitchen table for a pizza. */
  const PIZZA = [[250, 588, 'south'], [295, 588, 'south'], [340, 588, 'south'], [250, 668, 'north'], [295, 668, 'north'], [340, 668, 'north'], [205, 625, 'east'], [405, 625, 'west']];
  /** How long a pizza (or the donuts) lasts on the table (seconds). */
  const PIZZA_SECONDS = 45;
  /** What can come to the kitchen table: pizza (free) and donuts (from the shop), with their words. */
  const FOOD = {
    pizza: { courier: 'Pizza delivery', called: 'Pizza delivery!', cheer: ['Pizza!', 'Yum!', 'Thanks, boss!'], going: 'Off to the kitchen: pizza!', having: 'Having pizza in the kitchen', holding: 'a slice of pizza' },
    donuts: { courier: 'Donut delivery', called: 'Donuts!', cheer: ['Donuts!', 'Sprinkles!', 'Thanks, boss!'], going: 'Off to the kitchen: donuts!', having: 'Having a donut in the kitchen', holding: 'a donut' },
    sandwiches: { courier: 'Sandwich delivery', called: 'Sandwiches!', cheer: ['Lunch!', 'Sandwiches!', 'Thanks, boss!'], going: 'Off to the kitchen: sandwiches!', having: 'Having a sandwich in the kitchen', holding: 'a sandwich' },
  };
  /** How long a delivered coffee is held (seconds). */
  const COFFEE_HELD = 120;
  /** The gym in the lounge once bought: a treadmill and a weights bench, and the spots in front of them. */
  const GYM = [{ x: 778, y: 566, w: 70, h: 36 }, { x: 872, y: 566, w: 64, h: 36 }];
  /** What is always there to walk round (the kitchen), and the pieces bought for the meeting room and lounge. */
  const FIXED = [{ x: 80, y: 475, w: 180, h: 43 }, { x: 465, y: 480, w: 60, h: 65 }, { x: 230, y: 600, w: 150, h: 45 }];
  const PIECES = { table: { x: 760, y: 145, w: 290, h: 100 }, bookcase: { x: 680, y: 475, w: 110, h: 35 }, tv: { x: 950, y: 485, w: 160, h: 50 }, sofa: { x: 920, y: 720, w: 200, h: 32 }, arcade: { x: 1118, y: 452, w: 46, h: 52 } };
  /** Round the meeting room table; a pair of chairs bought is one seat each side (0 and 3, then 1 and 4, then 2 and 5). */
  const MEETING = [[790, 110, 'south'], [890, 110, 'south'], [990, 110, 'south'], [790, 285, 'north'], [890, 285, 'north'], [990, 285, 'north']];
  /** Standing room at the table's ends, for helpers once the chairs are taken. */
  const STANDING = [[728, 170, 'east'], [728, 222, 'east'], [1082, 170, 'west'], [1082, 222, 'west']];
  /** Where staff wait while the lounge is empty. */
  const WINDOW = { id: 'window', x: 1135, y: 606, face: 'east', area: 'lounge', words: 'looking out of the lounge window' };
  /** Where resting happens, and the words for it (the lounge's only once its piece is bought: src/shop.mjs roomsOf). */
  const REST = [
    { id: 'coffee', x: 170, y: 548, face: 'north', area: 'kitchen', words: 'having a coffee' },
    { id: 'vending', x: 495, y: 572, face: 'north', area: 'kitchen', words: 'at the vending machine' },
    { id: 'lunch', x: 305, y: 668, face: 'north', area: 'kitchen', words: 'having lunch' },
    { id: 'tv', x: 1015, y: 690, face: 'north', area: 'lounge', words: 'watching TV' },
    { id: 'library', x: 735, y: 560, face: 'north', area: 'lounge', words: 'reading in the library' },
    { id: 'chat', x: 860, y: 640, face: 'west', area: 'lounge', words: 'chatting in the lounge' },
    { id: 'nap', x: 712, y: 700, face: 'north', area: 'lounge', words: 'having a nap in the armchair' },
    { id: 'treadmill', x: 813, y: 618, face: 'north', area: 'lounge', words: 'running on the treadmill', gym: true },
    { id: 'weights', x: 904, y: 618, face: 'north', area: 'lounge', words: 'lifting weights', gym: true },
    { id: 'arcade', x: 1141, y: 534, face: 'north', area: 'lounge', words: 'playing on the arcade machine' },
  ];
  const DOOR = [600, 768];
  /** Just outside the front door, on the path. */
  const STEP_OUT = [600, 805];
  /** Where someone going home walks off, along the path. */
  const GONE = [-60, 805];
  /** The deck chairs bought (each under its umbrella), right of the front door: where a break is taken. */
  const DECK = [800, 940, 1080, 870, 1010, 1150].map((x) => [x, 866]);
  /** The beach volleyball court (once the set is bought), left of the front door on the sand: two a side, either side of the net. */
  const VOLLEY = [[330, 852, 'east'], [450, 852, 'west'], [330, 884, 'east'], [450, 884, 'west']];
  const NET = { x: 390, top: 834, bottom: 898 };
  /** Beach towels: where a favourite who has gone home stays (left of the volleyball court, then either side of the path).
   * Two staggered rows, so the names of neighbours do not run into each other. */
  const TOWELS = [60, 115, 170, 225, 280, 505, 555, 655, 705, 755].map((x, i) => [x, i % 2 ? 874 : 848]);
  const TOWEL_COLOURS = ['#ef8a91', '#69bfe9', '#78c6a3', '#efbd72', '#b29be4', '#74a7d0'];
  /** The meeting room's indoor plants (once bought): one in each far corner. */
  const PLANTS = [{ x: 668, y: 50 }, { x: 1152, y: 332 }];
  /** Seconds a game of volleyball lasts before the players rest a while (then they can play again). */
  const VOLLEY_GAME = 90;
  const VOLLEY_REST = 120;
  /** Seconds with nothing to do before a break in a deck chair (after the lounge stage). */
  const BREAK_IDLE = 600;
  const outdoors = (x, y) => y > 785;
  /** Three rows of three desks: room for each name under its person. */
  const MAX_DESKS = 9;
  /** Seconds: thinking this long goes to the meeting room (the thread was already quiet 15 s to count as thinking);
   * idle this long stands up; idle this long leaves the room. */
  const THINK_AWAY = 5;
  const SIT_IDLE = 120;
  const LEAVE_IDLE = 300;
  /** Where people stand up and stretch: the free strip along the computer room's right-hand wall. */
  const STRETCH = [[522, 70], [522, 130], [522, 190], [522, 250], [522, 310]];
  const clock = () => performance.now() / 1000;
  const WALK = 95;
  /** Walking to work: quicker. */
  const HURRY = 160;

  /** Every office starts empty: what is bought comes from the server (src/shop.mjs roomsOf). */
  const EMPTY = { boardroom: { table: false, chairs: 0, whiteboard: false, plants: false }, lounge: { armchair: false, bookcase: false, sofa: false, tv: false, gym: false, arcade: false }, rest: ['coffee', 'vending', 'lunch'], away: ['window'], deckchairs: 0, volleyball: false, locked: { boardroom: true, lounge: true } };
  /** A room still locked (its key not bought yet): its door stays shut with a padlock on it. */
  const lockedRoom = (r) => !!r.lock && !!world.rooms.locked?.[r.lock];
  const world = { desks: [], deckOrder: [], people: new Map(), staff: [], time: 0, selected: null, seenAt: 0, first: true, grid: [], layout: '', pizzaUntil: 0, pizzaOn: false, food: 'pizza', rooms: EMPTY, roomsKey: '', purse: null, shop: [], recent: [], blocks: FIXED, filter: undefined };
  /** The pieces in the way now: the fixed ones and whatever is bought. */
  const blocksOf = () => [...FIXED, ...Object.entries(PIECES).filter(([k]) => (k === 'table' ? world.rooms.boardroom.table : world.rooms.lounge[k])).map(([, b]) => b), ...(world.rooms.lounge.gym ? GYM : []), ...(world.rooms.boardroom.plants ? PLANTS.map((p) => ({ x: p.x - 14, y: p.y - 14, w: 28, h: 28 })) : [])];
  const views = [];
  let background = null;
  const app = () => window.aiOffice;

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  }

  // ---- The floor: which squares can be walked on, and the way from one place to another ----

  const deskBlock = (d) => ({ x: d.x - d.w / 2 - 2, y: d.y - 20, w: d.w + 4, h: 33 });
  function walkable(x, y) {
    if (x < 30 || x > 1170 || y < 30 || y > 770) return false;
    let free = (x >= 570 && x <= 630) || (y >= 370 && y <= 430);
    ROOMS.forEach((r, i) => {
      if (x > r.x + 9 && x < r.x + r.w - 9 && y > r.y + 9 && y < r.y + r.h - 9) free = true;
      // Each room's doorway onto the corridor (shut while the room is locked).
      if (lockedRoom(r)) return;
      const dy = i < 2 ? 190 : 610;
      const edge = i % 2 === 0 ? r.x + r.w : r.x;
      if (Math.abs(x - edge) < 22 && Math.abs(y - dy) < 30) free = true;
    });
    const blocked = (r) => x >= r.x - 7 && x <= r.x + r.w + 7 && y >= r.y - 7 && y <= r.y + r.h + 7;
    return free && !world.blocks.some(blocked) && !world.desks.some((d) => blocked(deskBlock(d)));
  }
  const cellX = (i) => (i % COLS) * 20 + 10;
  const cellY = (i) => Math.floor(i / COLS) * 20 + 10;
  function regrid() {
    world.grid = Array.from({ length: COLS * ROWS }, (_, i) => walkable(cellX(i), cellY(i)));
  }
  function nearest(x, y) {
    let best = -1;
    let dist = Infinity;
    for (let i = 0; i < world.grid.length; i++) {
      if (!world.grid[i]) continue;
      const d = (cellX(i) - x) ** 2 + (cellY(i) - y) ** 2;
      if (d < dist) { dist = d; best = i; }
    }
    return best;
  }
  /** The squares from (x, y) to (gx, gy), ending on the exact spot. */
  function pathTo(x, y, gx, gy) {
    const start = nearest(x, y);
    const goal = nearest(gx, gy);
    if (start < 0 || goal < 0) return [[gx, gy]];
    const prev = new Int32Array(world.grid.length).fill(-1);
    prev[start] = start;
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      if (i === goal) break;
      for (const n of [i - 1, i + 1, i - COLS, i + COLS]) {
        if (n < 0 || n >= world.grid.length || !world.grid[n] || prev[n] !== -1 || Math.abs((n % COLS) - (i % COLS)) > 1) continue;
        if (!walkable((cellX(n) + cellX(i)) / 2, (cellY(n) + cellY(i)) / 2)) continue;
        prev[n] = i;
        queue.push(n);
      }
    }
    if (prev[goal] === -1) return [[gx, gy]];
    const out = [[gx, gy]];
    for (let i = goal; i !== start; i = prev[i]) out.push([cellX(i), cellY(i)]);
    return out.reverse();
  }

  // ---- The desks (projects) and the people (seats), from the office's list ----

  function deskAt(i) {
    return { x: 110 + (i % 3) * 160, y: 78 + Math.floor(i / 3) * 110 };
  }
  /** Where each chair is along a desk with n people at it: one desk, extended to a longer table for four. */
  const SEATS = { 1: [0], 2: [-24, 24], 3: [-32, 0, 32], 4: [-45, -15, 15, 45] };
  const seatsOf = (n) => SEATS[Math.max(1, Math.min(4, n))];
  const deskWidth = (n) => (n >= 4 ? 130 : 98);

  function placeDesks() {
    // A project keeps its desk while anyone from it is in; a new project takes the next free desk.
    const atWork = world.staff.filter((s) => s.doing !== 'towel');
    const folders = [...new Set(atWork.map((s) => s.pcId))];
    world.deckOrder = world.deckOrder.filter((f) => folders.includes(f));
    for (const f of folders) if (!world.deckOrder.includes(f)) world.deckOrder.push(f);
    const shown = world.deckOrder.slice(0, MAX_DESKS);
    world.desks = shown.map((f, i) => {
      const crew = atWork.filter((s) => s.pcId === f).sort((a, b) => a.seat - b.seat);
      const seats = seatsOf(crew.length);
      return { ...deskAt(i), key: f, name: f || 'Consultants', crew: crew.map((s) => s.id).slice(0, seats.length), seats, w: deskWidth(crew.length) };
    });
    const layout = JSON.stringify(world.desks.map((d) => [d.key, d.seats.length, d.x, d.y]));
    if (layout !== world.layout) {
      world.layout = layout;
      background = null;
      regrid();
      for (const p of world.people.values()) p.targetKey = '';
    }
  }
  const deskOf = (key) => world.desks.find((d) => d.key === key) ?? null;

  /**
   * Where someone goes for what they are doing: a spot, the way they face, and the room (for "Walking to …").
   * The desk is home: work is done sitting there; a thread that asked something stands beside it; thinking goes to the
   * meeting room once it has gone on THINK_AWAY seconds (and there is a table). With nothing to do they stay at the desk
   * SIT_IDLE seconds, then stand and stretch until LEAVE_IDLE, then go to the kitchen or the lounge.
   */
  function targetOf(p) {
    const s = p.row;
    const desk = deskOf(s.pcId);
    const now = clock();
    const idle = now - (p.idleSince ?? -Infinity);
    const longThink = s.doing === 'thinking' && now - (p.doingSince ?? now) >= THINK_AWAY;
    const table = world.rooms.boardroom.table;
    const atDesk = ['typing', 'researching'].includes(s.doing) || (s.doing === 'thinking' && (!longThink || !table)) || (s.doing === 'resting' && idle < SIT_IDLE);
    if (p.leaving) return { key: 'gone', x: GONE[0], y: GONE[1], face: 'west', area: 'gone' };
    if (s.doing === 'towel') {
      // A favourite gone home: their own towel on the sand (past ten, the row is shared a little to the side).
      const i = towelers().findIndex((x) => x.id === s.id);
      const [x, y] = TOWELS[i % TOWELS.length];
      const more = Math.floor(i / TOWELS.length);
      return { key: `towel:${i}`, x: x + more * 14, y: y - more * 6, face: 'south', area: 'towel' };
    }
    if (s.doing === 'needs' && desk) {
      // Stood up beside the desk, facing you, with a "?": seat 1 on the left end, the others on the right.
      const i = Math.max(0, desk.crew.indexOf(s.id));
      const side = i === 0 ? -1 : 1;
      return { key: `needs:${desk.key}:${i}`, x: desk.x + side * (desk.w / 2 + 17), y: desk.y + 12 + Math.max(0, i - 1) * 6, face: 'south', area: 'needs', desk };
    }
    if (table && (longThink || (s.doing === 'thinking' && !desk))) {
      // The chairs bought are sat in first; past them, they stand at the table.
      const i = boardroomThinkers().findIndex((x) => x.id === s.id);
      const seat = MEETING[seatOrder()[i]] ?? STANDING[(i - MEETING.length) % STANDING.length] ?? STANDING[0];
      return { key: `think:${i}`, x: seat[0], y: seat[1], face: seat[2], area: 'boardroom', chair: i < world.rooms.boardroom.chairs };
    }
    if ((s.doing === 'thinking' && !desk) || (s.doing === 'needs' && !desk)) {
      const [x, y] = STRETCH[p.seed % STRETCH.length];
      return { key: `stretch:${x}:${y}`, x, y, face: 'south', area: 'stretch' };
    }
    // A long think in the meeting room: whoever has finished comes to help, one to each chair left over, then standing.
    const helper = helperIndex(p);
    if (helper >= 0) {
      const order = seatOrder();
      const chairsLeft = order.slice(boardroomThinkers().length, world.rooms.boardroom.chairs);
      const seat = helper < chairsLeft.length ? MEETING[chairsLeft[helper]] : STANDING[(helper - chairsLeft.length) % STANDING.length];
      return { key: `help:${helper}`, x: seat[0], y: seat[1], face: seat[2], area: 'boardroom', helping: true, chair: helper < chairsLeft.length };
    }
    // Pizza on the kitchen table: everyone with nothing to do gathers round it (whoever works, works on).
    if (world.pizzaOn && s.doing === 'resting') {
      const i = world.staff.filter((x) => x.doing === 'resting').findIndex((x) => x.id === s.id);
      const [x, y, face] = PIZZA[i % PIZZA.length];
      return { key: `pizza:${i}`, x: x + Math.floor(i / PIZZA.length) * 12, y, face, area: 'kitchen', pizza: true };
    }
    if (desk && atDesk) {
      // Past the chairs at a full desk (a fifth thread in one folder), the last chair is shared.
      const at = desk.crew.indexOf(s.id);
      const i = at < 0 ? desk.seats.length - 1 : Math.min(at, desk.seats.length - 1);
      return { key: `seat:${desk.key}:${i}`, x: desk.x + desk.seats[i], y: desk.y + 35, face: 'north', area: 'desk', desk };
    }
    if (desk && s.doing === 'resting' && idle < LEAVE_IDLE) {
      const [x, y] = STRETCH[p.seed % STRETCH.length];
      return { key: `stretch:${x}:${y}`, x, y, face: 'south', area: 'stretch', desk };
    }
    // Beach volleyball: once the set is bought, up to four who have finished (and left the desk) play, two a side.
    const vb = volleyIndex(p);
    if (vb >= 0) {
      const [x, y, face] = VOLLEY[vb];
      return { key: `volley:${vb}`, x, y, face, area: 'volley' };
    }
    const brk = breakIndex(p);
    if (brk >= 0) {
      const [x, y] = DECK[brk];
      return { key: `break:${brk}`, x, y, face: 'south', area: 'break' };
    }
    const spots = REST.filter((r) => world.rooms.rest.includes(r.id));
    if (!p.rest || !spots.includes(p.rest) || (world.time > p.restUntil && !p.path.length)) {
      const taken = new Set([...world.people.values()].filter((o) => o !== p && o.rest).map((o) => o.rest.id));
      const free = spots.filter((r) => !taken.has(r.id) && r.id !== p.rest?.id);
      const pick = (free.length ? free : spots)[Math.floor(Math.random() * (free.length || spots.length))];
      p.rest = pick;
      p.restUntil = world.time + 25 + Math.random() * 30;
    }
    const r = p.rest;
    return { key: `rest:${r.id}`, x: r.x + ((p.seed % 5) - 2) * 10, y: r.y + ((p.seed >> 3) % 3) * 6, face: r.face, area: r.area, rest: r };
  }

  /** Favourites on a towel, in a steady order (so nobody swaps towels when someone else arrives). */
  const towelers = () => world.staff.filter((x) => x.doing === 'towel').sort((a, b) => (a.id < b.id ? -1 : 1));

  /** Who is in the meeting room thinking now; nobody without a table. */
  function thinkersNow() {
    const now = clock();
    if (!world.rooms.boardroom.table) return [];
    return world.staff.filter((x) => x.doing === 'thinking' && now - (world.people.get(x.id)?.doingSince ?? now) >= THINK_AWAY);
  }
  function boardroomThinkers() {
    const now = clock();
    if (!world.rooms.boardroom.table) return [];
    return world.staff.filter((x) => x.doing === 'thinking' && (now - (world.people.get(x.id)?.doingSince ?? now) >= THINK_AWAY || !deskOf(x.pcId)));
  }
  /** The meeting room's places in the order they are taken: the chairs bought (a pair at a time), then the rest. */
  function seatOrder() {
    const pairs = world.rooms.boardroom.chairs / 2;
    const chairs = [0, 3, 1, 4, 2, 5].filter((i) => i % 3 < pairs);
    return [...chairs, ...[0, 1, 2, 3, 4, 5].filter((i) => !chairs.includes(i))];
  }
  /** Helpers: everyone whose thread has finished (resting), while someone thinks in the meeting room; -1 for others. */
  function helperIndex(p) {
    if (!thinkersNow().length || p.leaving) return -1;
    const room = Math.max(0, world.rooms.boardroom.chairs - boardroomThinkers().length) + STANDING.length;
    const free = world.staff.filter((x) => x.doing === 'resting' && world.people.get(x.id) && !world.people.get(x.id).leaving);
    const i = free.findIndex((x) => x.id === p.id);
    return i >= 0 && i < room ? i : -1;
  }
  /** A deck chair for p (its index), or -1: resting BREAK_IDLE seconds, while chairs last. */
  function breakIndex(p) {
    if (!world.rooms.deckchairs || p.leaving) return -1;
    const now = clock();
    const free = world.staff.filter((x) => {
      const o = world.people.get(x.id);
      return o && !o.leaving && x.doing === 'resting' && now - (o.idleSince ?? -Infinity) >= BREAK_IDLE;
    });
    const i = free.findIndex((x) => x.id === p.id);
    return i >= 0 && i < Math.min(world.rooms.deckchairs, DECK.length) ? i : -1;
  }
  const breakOf = (p) => p?.target?.area === 'break';
  /** A place in the volleyball game for p (0-3), or -1: needs the set, at least two players, and a rest between games. */
  function volleyIndex(p) {
    if (!world.rooms.volleyball || p.leaving) return -1;
    const now = clock();
    const players = world.staff.filter((x) => {
      const o = world.people.get(x.id);
      return o && !o.leaving && x.doing === 'resting' && now - (o.idleSince ?? -Infinity) >= LEAVE_IDLE && !(o.volleyAfter > world.time);
    }).slice(0, VOLLEY.length);
    if (players.length < 2) return -1;
    return players.findIndex((x) => x.id === p.id);
  }
  /** Players standing at the court now (the ball is in play from two). */
  const playing = () => [...world.people.values()].filter((p) => p.target?.area === 'volley' && !p.path.length).length;

  function retarget(p, snap = false) {
    const t = targetOf(p);
    if (!t.rest) p.rest = null;
    if (t.key === p.targetKey && !snap) return;
    p.from = p.target?.area ?? '';
    p.targetKey = t.key;
    p.target = t;
    if (snap) {
      [p.x, p.y] = [t.x, t.y];
      p.path = [];
      p.face = t.face;
      p.out = t.key === 'gone';
      return;
    }
    p.path = route(p.x, p.y, t.x, t.y);
  }
  /** The way from (x, y) to (tx, ty): in and out of the building only by the front door; outside, along the path. */
  function route(x, y, tx, ty) {
    const inside = !outdoors(x, y);
    const toOutside = outdoors(tx, ty);
    if (inside && toOutside) return [...pathTo(x, y, DOOR[0], DOOR[1]), STEP_OUT, [tx, STEP_OUT[1]], [tx, ty]];
    if (!inside && !toOutside) return [[x, STEP_OUT[1]], STEP_OUT, DOOR, ...pathTo(DOOR[0], DOOR[1], tx, ty)];
    if (!inside) return [[x, STEP_OUT[1]], [tx, STEP_OUT[1]], [tx, ty]];
    return pathTo(x, y, tx, ty);
  }
  /** One step along o's path at `speed`; true when the last point is reached. */
  function move(o, dt, speed) {
    const [x, y] = o.path[0];
    const dx = x - o.x;
    const dy = y - o.y;
    const d = Math.hypot(dx, dy);
    const v = speed * dt;
    o.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
    if (d > v) {
      o.x += (dx / d) * v;
      o.y += (dy / d) * v;
      return false;
    }
    o.x = x;
    o.y = y;
    o.path.shift();
    return !o.path.length;
  }

  function say(p, text, seconds = 3) {
    p.bubble = text;
    p.bubbleUntil = world.time + seconds;
  }

  /** What a person is doing, in the office's words. */
  function doingOf(person) {
    // A favourite who has gone home: off duty on a beach towel.
    if (person.state === 'home') return 'towel';
    if (person.state === 'needs') return 'needs';
    if (person.state === 'thinking') return 'thinking';
    if (person.state === 'idle') return 'resting';
    if (/^(A helper is )?(reading|searching|researching|using the browser)/i.test(person.words || '')) return 'researching';
    return 'typing';
  }

  /** The office's list every few seconds: everyone in (not gone home), in the project picked if one is. */
  function update(data, list) {
    const now = performance.now();
    const filter = app()?.project ?? null;
    // Shown again after a long time away, or another project picked: everyone is put where they are, not walked there.
    const snap = world.first || now - world.seenAt > 4000 || filter !== world.filter;
    world.filter = filter;
    if (data.shop) officeData(data.shop);
    const nowMs = data.now || Date.now();
    world.staff = list.filter((p) => p.state !== 'home' || (p.fav && !p.favHidden)).map((p) => ({
      id: p.key,
      name: p.name,
      pcId: p.folder,
      seat: p.seat,
      look: p.look || null,
      doing: doingOf(p),
      doingText: p.words,
      idleFor: p.state === 'idle' && p.since ? Math.max(0, (nowMs - p.since) / 1000) : null,
    }));
    placeDesks();
    const ids = new Set(world.staff.map((s) => s.id));
    for (const s of world.staff) {
      let p = world.people.get(s.id);
      if (!p) {
        // A new thread: they come along the path and in through the front door.
        p = { id: s.id, x: GONE[0], y: GONE[1], face: 'east', path: [], targetKey: '', seed: hash(s.id), bubble: '', bubbleUntil: 0 };
        world.people.set(s.id, p);
        if (!world.first && !snap) say(p, 'Morning!');
      }
      if (p.row?.doing !== s.doing) {
        p.doingSince = clock();
        if (s.doing === 'needs' && p.row && !snap) say(p, 'A question for you!', 5);
        if (s.doing === 'typing' && p.row?.doing === 'needs' && !snap) say(p, 'Thanks, on it!', 3);
        if (s.doing === 'towel' && p.row && !snap) say(p, 'Off to the beach!', 4);
        if (p.row?.doing === 'towel' && s.doing !== 'towel' && !snap) say(p, 'Back to work!', 4);
      }
      p.idleSince = s.idleFor == null ? -Infinity : clock() - s.idleFor;
      p.row = s;
      p.look = L?.lookOf(s.id, s.look) ?? null;
      retarget(p, snap);
    }
    // Gone home (or not in the project picked): they walk out of the front door; picking a project just hides them.
    for (const [id, p] of world.people) {
      if (ids.has(id) || p.leaving) continue;
      if (snap) { world.people.delete(id); continue; }
      p.leaving = true;
      p.row = { ...p.row, doing: 'gone' };
      say(p, 'Night, all!');
      retarget(p);
    }
    world.first = false;
    for (const v of views) v.told = '';
    wake();
  }

  function hash(s) {
    let h = 7;
    for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  // ---- Time passing ----

  let lookedAt = 0;
  function step(dt) {
    world.time += dt;
    // Once a second, each person standing still checks whether time has moved them on.
    if (world.time - lookedAt > 1) {
      lookedAt = world.time;
      for (const p of world.people.values()) {
        if (p.path.length || p.leaving) continue;
        // A game of volleyball ends after a while: the player rests before the next one.
        if (p.target?.area === 'volley' && p.volleyUntil && world.time > p.volleyUntil) { p.volleyAfter = world.time + VOLLEY_REST; p.volleyUntil = 0; }
        retarget(p);
      }
    }
    for (const p of world.people.values()) {
      if (p.path.length) {
        if (move(p, dt, ['desk', 'boardroom', 'needs'].includes(p.target?.area) ? HURRY : WALK)) arrived(p);
        continue;
      }
      if (p.target?.rest && world.time > p.restUntil) retarget(p);
    }
    stepCourier(dt);
    for (const [id, p] of world.people) if (p.leaving && p.out) world.people.delete(id);
  }

  // ---- Pizza, donuts and coffee: a delivery comes in by the front door ----

  let courier = null;
  const deliveries = [];
  const tableBusy = () => world.pizzaOn || deliveries.some((d) => FOOD[d.kind]) || !!FOOD[courier?.job.kind];
  function orderFood(kind) {
    if (tableBusy()) return false;
    deliveries.push({ kind });
    wake();
    return true;
  }
  /** Beside the next one on a delivery's list (job.who, from job.at) who is still here, or null. */
  function nextStop(job) {
    for (; job.at < job.who.length; job.at++) {
      const p = world.people.get(job.who[job.at]);
      if (p && !p.out && !p.leaving) return [p.x + (p.x > 1100 ? -26 : 26), p.y + 4];
    }
    return null;
  }
  function dropOf(job) {
    if (FOOD[job.kind]) return [305, 668];
    if (job.kind === 'coffee') return nextStop(job);
    return null;
  }
  /** Hands the next one on the list theirs (a coffee, or a piece of the food), or walks to them; false once the list is done. */
  function handRound(k) {
    const at = nextStop(k.job);
    if (at && Math.hypot(at[0] - k.x, at[1] - k.y) > 40) {
      k.path = route(k.x, k.y, at[0], at[1]);
      return true;
    }
    const got = at ? world.people.get(k.job.who[k.job.at]) : null;
    if (got) {
      if (k.job.kind === 'coffee') {
        got.coffee = 'have';
        got.coffeeUntil = world.time + COFFEE_HELD;
        say(got, ['Thanks for the coffee!', 'Flat white, perfect!', 'Just what I needed.'][got.seed % 3], 3);
      } else {
        got.slice = k.job.kind;
        got.sliceUntil = world.time + PIZZA_SECONDS;
        say(got, FOOD[k.job.kind].cheer[got.seed % 3], 3);
      }
      k.face = got.x < k.x ? 'west' : 'east';
      say(k, 'Here you go!', 2);
      k.job.at++;
    }
    const next = nextStop(k.job);
    if (next) {
      k.path = route(k.x, k.y, next[0], next[1]);
      return true;
    }
    return false;
  }
  function startCourier() {
    while (!courier && deliveries.length) {
      const job = deliveries.shift();
      const at = dropOf(job);
      if (!at) continue;
      const food = FOOD[job.kind];
      const coffee = job.kind === 'coffee';
      const look = L ? { ...L.fromId('courier'), top: food ? 'coral' : 'mint', headwear: 'cap', glasses: 'none' } : null;
      courier = { id: 'courier', row: { name: food?.courier ?? 'Coffee delivery', doing: 'courier' }, job, x: GONE[0], y: GONE[1], face: 'east', look, seed: 5, phase: 'coming', carry: food ? job.kind : coffee ? 'coffee' : null, bubble: '', bubbleUntil: 0, path: route(GONE[0], GONE[1], at[0], at[1]) };
      say(courier, food?.called ?? 'Coffee delivery!', 3);
    }
  }
  function stepCourier(dt) {
    startCourier();
    const k = courier;
    if (k) {
      if (k.path.length && !move(k, dt, HURRY)) return;
      if (k.phase === 'coming' && FOOD[k.job.kind]) {
        // The box goes on the kitchen table: whoever has finished gathers round it. Everyone still at work (they will
        // not come to the table) is then brought a piece where they are, so nobody misses out.
        world.pizzaOn = true;
        world.food = k.job.kind;
        world.pizzaUntil = world.time + PIZZA_SECONDS;
        say(k, 'Enjoy!', 2);
        for (const p of world.people.values()) if (p.row.doing === 'resting') say(p, FOOD[world.food].cheer[p.seed % 3], 3);
        k.job.who = [...world.people.values()].filter((p) => !p.out && !p.leaving && p.row.doing !== 'resting').map((p) => p.id);
        k.job.at = 0;
        k.phase = 'round';
      }
      if (k.phase === 'coming' || k.phase === 'round') {
        // One for each on the list, wherever they are (busy or not); someone who walked off meanwhile is followed.
        if (handRound(k)) return;
        k.phase = 'leaving';
        k.carry = null;
        k.path = route(k.x, k.y, GONE[0], GONE[1]);
        return;
      }
      courier = null;
    }
    if (world.pizzaOn && world.time > world.pizzaUntil) {
      world.pizzaOn = false;
      for (const p of world.people.values()) if (p.target?.pizza) p.targetKey = '';
    }
  }

  // ---- The shop's answer: the purse, the items, and what the rooms offer ----

  function officeData(shop) {
    world.purse = shop.purse ?? null;
    world.shop = shop.items ?? [];
    world.recent = Array.isArray(shop.recent) ? shop.recent : [];
    const rooms = shop.rooms ?? world.rooms;
    const key = JSON.stringify(rooms);
    if (key !== world.roomsKey) {
      world.rooms = rooms;
      world.roomsKey = key;
      world.blocks = blocksOf();
      background = null;
      regrid();
      for (const p of world.people.values()) if (!p.leaving) p.targetKey = '';
    }
    // While the shop is open, rebuilding the tiles under the pointer loses the click: they are drawn again only when
    // what they say changes (the list arrives after the tab was opened, something was bought, or "more to go" moved).
    const left = world.purse?.left ?? 0;
    const itemsKey = JSON.stringify([world.recent[0]?.at ?? '', ...world.shop.map((i) => [i.id, i.have, i.owned, i.waits, i.locked, i.price > left ? big(i.price - left) : ''])]);
    if (shopBox && !shopBox.hidden) {
      if (itemsKey !== shopItemsKey) drawShop();
      else purseLine.textContent = purseWords();
    }
    shopItemsKey = itemsKey;
  }

  /** What someone has in their hands (press them to see it). */
  function holding(p) {
    const items = [];
    const still = !p.path.length;
    if (p.coffee === 'have' && world.time < p.coffeeUntil) items.push('a coffee (your treat)');
    if (p.slice && world.time < p.sliceUntil) items.push(`${FOOD[p.slice].holding}, brought over (your treat)`);
    else if (p.target?.pizza && still) items.push(FOOD[world.food].holding);
    else if (p.target?.rest?.id === 'weights' && still) items.push('a pair of dumbbells');
    else if (p.target?.rest?.id === 'treadmill' && still) items.push('a water bottle');
    else if (p.target?.rest?.id === 'coffee' && still) items.push('a mug of coffee');
    else if (p.target?.rest?.id === 'vending' && still) items.push('a can from the vending machine');
    else if (p.target?.rest?.id === 'library' && still) items.push('a book from the library');
    else if (p.target?.rest?.id === 'tv' && still) items.push('the TV remote');
    else if (p.target?.rest?.id === 'arcade' && still) items.push('the joystick');
    else if (p.target?.area === 'break' && still) items.push('a cold drink');
    else if (p.target?.area === 'towel' && still) items.push('a beach towel');
    else if (p.target?.area === 'stretch' && still) items.push('a dumbbell');
    return items.length ? items.join(', ') : 'nothing';
  }
  function arrived(p) {
    p.face = p.target?.face ?? 'south';
    if (p.targetKey === 'gone') p.out = true;
    if (p.target?.area === 'volley' && !p.volleyUntil) p.volleyUntil = world.time + VOLLEY_GAME + Math.random() * VOLLEY_GAME;
  }

  /** "Walking to the meeting room", or what they are doing there. */
  function wordsOf(p) {
    const s = p.row;
    const t = p.target;
    if (t?.pizza) return p.path.length ? FOOD[world.food].going : FOOD[world.food].having;
    if (t?.helping) {
      const lead = thinkersNow()[0]?.name ?? 'someone';
      return p.path.length ? `Off to the meeting room to help ${lead} think` : `Helping ${lead} think`;
    }
    const thinkHere = s.doing === 'thinking' && !world.rooms.boardroom.table;
    if (p.path.length && !p.out) {
      if (t?.area === 'gone') return 'Going home: the thread has gone quiet';
      if (t?.area === 'break') return 'Off out for a break in a deck chair';
      if (t?.area === 'towel') return 'Gone home for now: off to a beach towel (a favourite stays)';
      if (t?.area === 'volley') return 'Off to the beach for a game of volleyball';
      if (outdoors(p.x, p.y)) return ['break', 'volley', 'towel'].includes(p.from) ? 'Back in from the beach' : 'Coming in to work';
      if (t?.area === 'boardroom') return 'Walking to the meeting room to think';
      if (t?.area === 'needs') return 'Getting up: a question for you';
      if (t?.area === 'stretch') return thinkHere ? 'Thinking on their feet' : 'Getting up to stretch their legs';
      if (t?.area === 'desk') return `Walking to the ${t.desk?.name ?? ''} desk`;
      return `Walking to the ${t?.area ?? 'kitchen'}`;
    }
    if (s.doing === 'needs') return `Needs you: ${s.doingText}`;
    if (t?.area === 'break') return 'On a break: in a deck chair on the beach';
    if (t?.area === 'towel') return 'Off duty on a beach towel: a favourite, back when their next thread starts';
    if (t?.area === 'volley') return playing() >= 2 ? 'Playing beach volleyball' : 'At the volleyball net, waiting for a partner';
    if (thinkHere && t?.area === 'desk') return 'Thinking at the desk (no meeting room table yet)';
    if (s.doing === 'resting' && t?.area === 'desk') return 'Finished: at the desk, ready for your next message';
    if (s.doing === 'resting' && t?.area === 'stretch') return 'Finished: stretching their legs';
    if (s.doing === 'resting' && t?.rest) return `Finished: ${t.rest.words}`;
    return s.doingText || 'Working';
  }

  // ---- Drawing ----

  function box(c, x, y, w, h, r, fill, stroke = INK, width = 2.5) {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fillStyle = fill;
    c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function oval(c, x, y, rx, ry, fill, stroke = INK, width = 2) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function line(c, x, y, xx, yy, col = INK, width = 3) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(xx, yy);
    c.strokeStyle = col;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.stroke();
  }
  function text(c, s, x, y, size, col = INK, align = 'left') {
    c.font = `600 ${size}px Segoe UI, system-ui, sans-serif`;
    c.fillStyle = col;
    c.textAlign = align;
    c.fillText(s, x, y);
    c.textAlign = 'left';
  }
  /** Text cut to fit `max` units wide, with an ellipsis. */
  function fitText(c, s, max, size) {
    c.font = `600 ${size}px Segoe UI, system-ui, sans-serif`;
    if (c.measureText(s).width <= max) return s;
    let t = s;
    while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t}…`;
  }
  function mug(c, x, y) {
    box(c, x - 5, y - 6, 10, 13, 3, '#fff9eb', INK, 2);
    oval(c, x + 7, y, 3, 4, '#fff9eb');
  }

  /** The rooms, the furniture and the desks: drawn once (and again when the desks change), then copied each frame. */
  function drawBackground() {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#cbd6df';
    c.fillRect(0, 0, W, H);
    ROOMS.forEach((r, i) => {
      box(c, r.x, r.y, r.w, r.h, 16, r.fill);
      const xx = i % 2 === 0 ? r.x + r.w : r.x;
      const dy = i < 2 ? 190 : 610;
      c.fillStyle = r.fill;
      c.fillRect(xx - 5, dy - 25, 10, 50);
      if (lockedRoom(r)) {
        // Locked: the lights off (a dark veil over the room), the door shut in its frame, and a padlock on the corridor side.
        box(c, r.x, r.y, r.w, r.h, 16, 'rgba(22, 32, 46, 0.62)', null);
        line(c, xx, dy - 25, xx, dy + 25, '#7b6a55', 7);
        padlock(c, xx + (i % 2 === 0 ? 16 : -16), dy + 2, 1);
      } else {
        line(c, xx, dy - 25, xx + (i % 2 === 0 ? 30 : -30), dy - 45, '#7b8b9a', 3);
      }
    });
    box(c, 1172, 566, 14, 82, 3, '#cfe8f5', INK, 2);
    line(c, 1179, 570, 1179, 644, '#fff', 1.5);
    // Outside: the path past the front door, the sand, the sea, and the deck chairs bought.
    c.fillStyle = '#b9c9a4';
    c.fillRect(0, 786, W, 38);
    c.fillStyle = '#d9cfb8';
    c.fillRect(0, 797, W, 16);
    c.fillStyle = '#f2dfae';
    c.fillRect(0, 824, W, 82);
    c.fillStyle = '#7fc4e0';
    c.fillRect(0, 906, W, H - 906);
    for (let x = 20; x < W; x += 70) line(c, x, 920 + (x % 140 ? 6 : 0), x + 30, 920 + (x % 140 ? 6 : 0), '#d8f0fa', 2);
    DECK.slice(0, world.rooms.deckchairs).forEach(([x, y], i) => deckChair(c, x, y, i));
    if (world.rooms.volleyball) drawVolleyNet(c);
    // The front door.
    box(c, 574, 750, 52, 28, 4, '#a4b8c3');
    line(c, 570, 790, 570, 762, '#667e94', 4);
    line(c, 630, 790, 630, 762, '#667e94', 4);
    // Desks: the top (longer for four), a chair per person, a PC tower at the side.
    for (const d of world.desks) {
      box(c, d.x - d.w / 2, d.y - 19, d.w, 36, 8, '#e8bb80');
      box(c, d.x + d.w / 2 - 11, d.y - 16, 9, 30, 2, '#5d7084', INK, 2);
      for (const off of d.seats) box(c, d.x + off - 13, d.y + 26, 26, 21, 7, '#9eb3c8');
    }
    const br = world.rooms.boardroom;
    if (br.table) box(c, 760, 145, 290, 100, 22, '#e8bb80');
    for (const i of seatOrder().slice(0, br.chairs)) box(c, MEETING[i][0] - 19, MEETING[i][1] - 8, 38, 26, 8, '#a6aacb');
    if (br.whiteboard) {
      box(c, 1110, 105, 40, 160, 7, INK);
      box(c, 1116, 112, 28, 146, 3, '#fff7ed');
    }
    if (br.plants) for (const p of PLANTS) drawPlant(c, p.x, p.y);
    // Kitchen: counter with the coffee machine, the vending machine, the table, the sink.
    box(c, 80, 475, 180, 43, 9, '#e8bb80');
    box(c, 110, 480, 45, 33, 5, INK);
    box(c, 117, 487, 29, 12, 3, '#9ab6c7');
    mug(c, 132, 509);
    mug(c, 180, 501);
    box(c, 465, 480, 60, 65, 7, '#608cad');
    box(c, 472, 487, 45, 39, 3, '#d9eaf5');
    for (let i = 0; i < 6; i++) box(c, 480 + (i % 3) * 12, 493 + Math.floor(i / 3) * 15, 7, 11, 2, PALETTE[i], INK, 1.5);
    box(c, 230, 600, 150, 45, 15, '#e8bb80');
    box(c, 80, 690, 55, 40, 7, '#a4b8c3');
    oval(c, 106, 707, 17, 10, '#d5e3e8');
    const lo = world.rooms.lounge;
    if (lo.bookcase) {
      box(c, 680, 475, 110, 35, 5, '#b78966');
      for (let i = 0; i < 11; i++) box(c, 686 + i * 9, 480, 7, 23, 1, PALETTE[i % 6], INK, 1.5);
    }
    if (lo.armchair) box(c, 683, 641, 55, 39, 12, '#a4bac9');
    if (lo.sofa) {
      box(c, 920, 720, 200, 32, 10, '#9ab4c9');
      box(c, 925, 684, 190, 40, 12, '#b8cddd');
    }
    if (lo.tv) {
      box(c, 950, 485, 160, 50, 7, INK);
      box(c, 957, 492, 146, 36, 4, '#182638');
    }
    if (lo.gym) drawGym(c);
    if (lo.arcade) drawArcade(c);
    return cv;
  }
  /** The arcade machine in the lounge, once bought: a cabinet with a screen, two buttons and a joystick, seen from above. */
  function drawArcade(c) {
    const a = PIECES.arcade;
    box(c, a.x, a.y, a.w, a.h, 6, '#3b2f5c');
    box(c, a.x + 6, a.y + 6, a.w - 12, 22, 3, '#182638', INK, 1.5);
    for (let i = 0; i < 4; i++) box(c, a.x + 9 + i * 8, a.y + 10 + (i % 2) * 6, 5, 4, 1, PALETTE[(i + 2) % 6], null);
    box(c, a.x + 6, a.y + 32, a.w - 12, 14, 3, '#5b4b8a', INK, 1.5);
    oval(c, a.x + 14, a.y + 39, 3.5, 3.5, '#ef8a91', INK, 1);
    oval(c, a.x + 24, a.y + 39, 3.5, 3.5, '#efbd72', INK, 1);
    line(c, a.x + 35, a.y + 40, a.x + 35, a.y + 34, INK, 2);
    oval(c, a.x + 35, a.y + 33, 3, 3, '#ef8a91', INK, 1);
  }
  /** A potted plant seen from above: the pot's rim, and a rosette of leaves round a new shoot. */
  function drawPlant(c, x, y) {
    oval(c, x, y + 1, 11, 11, '#b36b4a', INK, 1.5);
    oval(c, x, y + 1, 8, 8, '#6b4a3a', null);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      c.beginPath();
      c.ellipse(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, 3.5, a, 0, Math.PI * 2);
      c.fillStyle = i % 2 ? '#5aa469' : '#7cc47f';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.2;
      c.stroke();
    }
    oval(c, x, y, 3.5, 3.5, '#a5e0ad', INK, 1.2);
  }
  /** The volleyball court on the sand: the lines, two posts and the net between them. */
  function drawVolleyNet(c) {
    c.setLineDash([6, 5]);
    box(c, 300, NET.top, 180, NET.bottom - NET.top, 4, 'rgba(255, 255, 255, 0.22)', '#c9b58a', 1.5);
    c.setLineDash([]);
    line(c, NET.x, NET.top, NET.x, NET.bottom, '#7b6a55', 5);
    c.setLineDash([3, 3]);
    line(c, NET.x, NET.top + 4, NET.x, NET.bottom - 4, '#ffffff', 1.5);
    c.setLineDash([]);
    oval(c, NET.x, NET.top, 4, 4, '#7b6a55', INK, 1.5);
    oval(c, NET.x, NET.bottom, 4, 4, '#7b6a55', INK, 1.5);
  }
  /** The ball in play: back and forth over the net, highest as it crosses, with its shadow on the sand. */
  function drawBall(c) {
    const t = world.time * 1.7;
    const bx = NET.x + 58 * Math.sin(t);
    const lift = 8 + 26 * Math.abs(Math.cos(t));
    oval(c, bx, 866 + 3, 5, 2, 'rgba(0, 0, 0, 0.15)', null);
    oval(c, bx, 866 - lift, 5, 5, '#fff6e4', INK, 1.5);
    line(c, bx - 4, 866 - lift, bx + 4, 866 - lift, '#ef8a91', 1.2);
  }

  /** The meeting room and the lounge while they are unlocked but nothing is bought for them. */
  function emptyRooms() {
    const b = world.rooms.boardroom;
    const l = world.rooms.lounge;
    return ROOMS.filter((r) => !lockedRoom(r) && ((r.name === 'Meeting room' && !b.table && !b.chairs && !b.whiteboard && !b.plants) || (r.name === 'Lounge and library' && !l.armchair && !l.bookcase && !l.sofa && !l.tv && !l.gym && !l.arcade)));
  }
  /** A padlock: the shackle (steel colour, lighter on a dark room) over a brass body with a keyhole, centred on (x, y), `s` times its door size. */
  function padlock(c, x, y, s, steel = '#56677b') {
    c.beginPath();
    c.arc(x, y - 4 * s, 6 * s, Math.PI, 0);
    c.strokeStyle = steel;
    c.lineWidth = 3 * s;
    c.stroke();
    line(c, x - 6 * s, y - 4 * s, x - 6 * s, y, steel, 3 * s);
    line(c, x + 6 * s, y - 4 * s, x + 6 * s, y, steel, 3 * s);
    box(c, x - 10 * s, y - 1 * s, 20 * s, 16 * s, 3 * s, '#e0b04f', INK, 2 * s);
    oval(c, x, y + 5 * s, 2.4 * s, 2.4 * s, INK, null);
    line(c, x, y + 6 * s, x, y + 10 * s, INK, 2 * s);
  }
  /** A deck chair seen from above (striped, its back to the path) under a beach umbrella. */
  function deckChair(c, x, y, i) {
    box(c, x - 17, y - 30, 34, 50, 6, '#c98f5a', INK, 2);
    for (let k = 0; k < 4; k++) box(c, x - 13, y - 26 + k * 11, 26, 9, 2, k % 2 ? '#fff6e4' : PALETTE[i % PALETTE.length], null);
    line(c, x + 27, y + 18, x + 27, y - 20, '#7b6a55', 3);
    c.beginPath();
    c.arc(x + 27, y - 22, 19, Math.PI, 0);
    c.closePath();
    c.fillStyle = i % 2 ? '#ef8a91' : '#efbd72';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke();
  }
  /** The coffee delivery's tray: a cup holder with takeaway cups. */
  function coffeeTray(c, p) {
    const dx = p.face === 'east' ? 22 : p.face === 'west' ? -22 : 0;
    const dy = p.face === 'north' ? -30 : 9;
    box(c, p.x + dx - 18, p.y + dy - 9, 36, 20, 4, '#c98f5a', INK, 2);
    for (let i = 0; i < 4; i++) {
      oval(c, p.x + dx - 12 + (i % 2) * 24, p.y + dy - 3 + Math.floor(i / 2) * 9, 5, 5, '#fff9eb', INK, 1.2);
      oval(c, p.x + dx - 12 + (i % 2) * 24, p.y + dy - 3 + Math.floor(i / 2) * 9, 2.5, 2.5, '#8a6a4c', null);
    }
  }
  /** The gym in the lounge, once bought: a treadmill, and a weights bench with its bar and plates. */
  function drawGym(c) {
    const [t, b] = GYM;
    box(c, t.x, t.y, t.w, t.h, 6, '#5d7084');
    box(c, t.x + 6, t.y + 8, t.w - 22, t.h - 16, 3, '#2f3d4f', INK, 1.5);
    for (let i = 0; i < 5; i++) line(c, t.x + 12 + i * 9, t.y + 10, t.x + 12 + i * 9, t.y + t.h - 10, '#56677b', 1.5);
    box(c, t.x + t.w - 14, t.y + 4, 10, t.h - 8, 3, '#9ab6c7', INK, 1.5);
    box(c, b.x + 10, b.y + 12, b.w - 20, 14, 5, '#ef8a91');
    line(c, b.x + 2, b.y + 6, b.x + b.w - 2, b.y + 6, '#56677b', 3);
    oval(c, b.x + 4, b.y + 6, 4, 8, INK, null);
    oval(c, b.x + b.w - 4, b.y + 6, 4, 8, INK, null);
    for (let i = 0; i < 3; i++) oval(c, b.x + 16 + i * 16, b.y + b.h - 2, 5, 3, '#56677b', INK, 1);
  }

  /** Each desk's screens (what the person at it is doing) and its project's name above it. */
  function drawDesks(c, full) {
    for (const d of world.desks) {
      const n = d.seats.length;
      const mw = n === 1 ? 40 : n === 2 ? 36 : 26;
      d.seats.forEach((off, i) => {
        const x = d.x + off;
        const who = world.people.get(d.crew[i]);
        const sat = who && !who.path.length && who.targetKey === `seat:${d.key}:${i}`;
        box(c, x - mw / 2, d.y - 16, mw, 19, 4, INK);
        drawScreen(c, x, d.y - 12, mw - 8, sat ? who.row.doing : 'idle');
        box(c, x - mw / 2 + 3, d.y + 7, mw - 6, 7, 2, '#fff7e9', INK, 2);
      });
      if (full) {
        const size = labelSize(c) * 0.85;
        const words = fitText(c, d.name, 150, size);
        c.font = `600 ${size}px Segoe UI, system-ui, sans-serif`;
        const w = c.measureText(words).width + size;
        box(c, d.x - w / 2, d.y - 24 - size * 1.25, w, size * 1.35, 5, '#ffffff', '#9eb3c8', 1.5);
        text(c, words, d.x, d.y - 24 - size * 0.25, size, INK, 'center');
      }
    }
  }

  function drawScreen(c, x, y, w, what) {
    const t = world.time;
    const fill = { idle: '#5d7084', researching: '#f4f6f9', needs: '#efbd72' }[what] ?? '#69bfe9';
    box(c, x - w / 2, y, w, 10, 2, fill, null);
    if (what === 'typing') {
      for (let i = 0; i < 3; i++) {
        const len = ((Math.sin(t * 3 + i * 2) + 1) / 2) * (w - 8) + 4;
        line(c, x - w / 2 + 3, y + 2 + i * 3, x - w / 2 + 3 + len, y + 2 + i * 3, '#e9f6ff', 1.2);
      }
    } else if (what === 'researching') {
      for (let i = 0; i < 3; i++) line(c, x - w / 2 + 4, y + 2.5 + i * 3, x + w / 2 - 6 - i * 3, y + 2.5 + i * 3, '#9aa7b6', 1.2);
    }
  }

  /** The little picture above someone's head that says what they do (shapes, not only colour). */
  function drawIcon(c, p) {
    const s = p.row.doing;
    if (s === 'courier' || p.target?.pizza) return;
    const x = p.x;
    const y = p.y - 50 + Math.sin(world.time * 3 + p.seed) * 1.5;
    if (p.path.length && !p.out) return;
    if (s === 'needs') {
      // A question mark in an orange disc, bobbing: they need you.
      oval(c, x, y - 2, 13, 13, '#f08c3a', INK, 2);
      text(c, '?', x, y + 5, 19, '#ffffff', 'center');
    } else if (s === 'thinking') {
      oval(c, x + 8, y + 20, 3, 3, '#fff', INK, 1.5);
      oval(c, x + 13, y + 12, 4, 4, '#fff', INK, 1.5);
      oval(c, x + 4, y - 2, 16, 12, '#fff', INK, 2);
      oval(c, x + 4, y - 4, 5, 5, `rgba(247, 205, 80, ${0.55 + 0.45 * Math.sin(world.time * 4) ** 2})`, INK, 1.5);
      box(c, x + 1.5, y + 1, 5, 3, 1, '#9aa7b6', INK, 1);
    } else if (s === 'typing') {
      box(c, x - 14, y - 8, 28, 14, 6, '#fff', INK, 2);
      for (let i = 0; i < 3; i++) oval(c, x - 7 + i * 7, y - 1 - (Math.floor(world.time * 4) % 3 === i ? 2 : 0), 2, 2, INK, null);
    } else if (s === 'researching') {
      box(c, x - 13, y - 8, 13, 15, 2, '#b29be4', INK, 1.5);
      box(c, x, y - 8, 13, 15, 2, '#b29be4', INK, 1.5);
      line(c, x - 9, y - 3, x - 3, y - 3, '#fff', 1.2);
      line(c, x + 3, y - 3, x + 9, y - 3, '#fff', 1.2);
    } else if (p.target?.area === 'towel' && !p.path.length) {
      star(c, x, y - 2, 9);
    } else if (breakOf(p)) {
      cupMark(c, x, y - 4);
    } else if (p.target?.helping) {
      oval(c, x, y - 2, 6, 6, `rgba(247, 205, 80, ${0.5 + 0.5 * Math.sin(world.time * 3 + p.seed) ** 2})`, INK, 1.5);
      box(c, x - 2.5, y + 3, 5, 3, 1, '#9aa7b6', INK, 1);
    } else if (s === 'resting' && p.target?.area === 'stretch') {
      const lift = Math.abs(Math.sin(world.time * 3)) * 4;
      line(c, x - 9, y - lift, x + 9, y - lift, INK, 2.5);
      box(c, x - 13, y - 5 - lift, 5, 10, 1.5, '#9aa7b6', INK, 1.5);
      box(c, x + 8, y - 5 - lift, 5, 10, 1.5, '#9aa7b6', INK, 1.5);
    } else if (s === 'resting') {
      if (p.target?.area === 'desk' || p.target?.area === 'volley' || ['coffee', 'vending', 'arcade'].includes(p.target?.rest?.id)) return;
      const k = (world.time + p.seed % 7) % 3;
      c.globalAlpha = 0.85;
      text(c, 'z', x + 6 + k * 3, y + 4 - k * 4, 13, '#56677b');
      c.globalAlpha = 1;
    }
  }
  /** A five-pointed star (a favourite), centred on (x, y). */
  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = '#f7cd50';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.stroke();
  }
  /** A beach towel laid across the sand behind its owner (wider than them, so it shows), striped in their colour. */
  function towel(c, x, y, seed) {
    const col = TOWEL_COLOURS[seed % TOWEL_COLOURS.length];
    box(c, x - 29, y - 34, 58, 40, 5, '#fff6e4', INK, 1.5);
    for (let k = 0; k < 5; k++) box(c, x - 25 + k * 11, y - 34, 6, 40, 0, col, null);
    box(c, x - 29, y - 34, 58, 40, 5, 'rgba(0, 0, 0, 0)', INK, 1.5);
  }
  /** On a break: a green disc with a cup. */
  function cupMark(c, x, y) {
    oval(c, x, y, 11, 11, '#4fa77a', INK, 1.5);
    box(c, x - 5, y - 4, 8, 9, 2, '#fff', null);
    c.beginPath();
    c.arc(x + 4, y, 3, -Math.PI / 2, Math.PI / 2);
    c.strokeStyle = '#fff';
    c.lineWidth = 1.6;
    c.stroke();
  }

  function bubble(c, p, size) {
    c.font = `600 ${size}px Segoe UI, system-ui, sans-serif`;
    const w = c.measureText(p.bubble).width + size * 1.4;
    const h = size * 1.9;
    const bx = Math.max(4, Math.min(W - w - 4, p.x - w / 2));
    const by = Math.max(4, p.y - 46 - h);
    box(c, bx, by, w, h, 8, '#fff', INK, 2);
    text(c, p.bubble, bx + w / 2, by + h * 0.68, size, INK, 'center');
  }
  /** A pizza box, carried in by the delivery. */
  function pizzaBox(c, p, kind = 'pizza') {
    const dx = p.face === 'east' ? 24 : p.face === 'west' ? -24 : 0;
    const dy = p.face === 'north' ? -32 : 9;
    box(c, p.x + dx - 22, p.y + dy - 10, 44, 20, 4, kind === 'donuts' ? '#ffe3ef' : kind === 'sandwiches' ? '#f6f1e6' : '#fff2d8', INK, 2);
    if (kind === 'donuts') for (let i = 0; i < 3; i++) donut(c, p.x + dx - 12 + i * 12, p.y + dy, 4.5, PALETTE[i + 1]);
    else if (kind === 'sandwiches') for (let i = 0; i < 3; i++) sandwich(c, p.x + dx - 12 + i * 12, p.y + dy, 5);
    else oval(c, p.x + dx, p.y + dy, 12, 6, '#e6a64c', null);
  }
  /** A sandwich seen from above: a triangle of bread with the filling showing along the cut. */
  function sandwich(c, x, y, r) {
    c.beginPath();
    c.moveTo(x - r, y + r * 0.8);
    c.lineTo(x + r, y + r * 0.8);
    c.lineTo(x, y - r);
    c.closePath();
    c.fillStyle = '#f3d9a4';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.stroke();
    line(c, x - r * 0.45, y + r * 0.35, x + r * 0.45, y + r * 0.35, '#7cc47f', 1.5);
  }
  function donut(c, x, y, r, icing) {
    oval(c, x, y, r, r, '#d39a5a', INK, 1.2);
    oval(c, x, y, r * 0.72, r * 0.72, icing, null);
    oval(c, x, y, r * 0.3, r * 0.3, '#fff6e4', INK, 1);
  }
  function coffeeHeld(c, p) {
    const dx = p.face === 'west' ? -15 : 15;
    box(c, p.x + dx - 4, p.y - 6, 8, 11, 2, '#fff9eb', INK, 1.5);
    box(c, p.x + dx - 5, p.y - 8, 10, 3, 1, '#8a6a4c', INK, 1);
  }
  function drinkHeld(c, p) {
    box(c, p.x + 13, p.y - 4, 8, 12, 2, '#bfe6f2', INK, 1.5);
    line(c, p.x + 18, p.y - 4, p.x + 21, p.y - 11, '#ef8a91', 1.8);
  }
  /** A piece brought to someone at work, in the other hand from a coffee: a pizza slice, or a donut. */
  function sliceHeld(c, p, kind) {
    const dx = p.face === 'west' ? 15 : -15;
    if (kind === 'donuts') { donut(c, p.x + dx, p.y - 2, 5, PALETTE[p.seed % 6]); return; }
    if (kind === 'sandwiches') { sandwich(c, p.x + dx, p.y - 2, 6); return; }
    c.beginPath();
    c.moveTo(p.x + dx - 6, p.y - 8);
    c.lineTo(p.x + dx + 6, p.y - 6);
    c.lineTo(p.x + dx - 1, p.y + 4);
    c.closePath();
    c.fillStyle = '#f2bc66';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.stroke();
    oval(c, p.x + dx - 1, p.y - 4, 1.8, 1.8, '#dc776e', null);
  }

  /** Text in the office is never under 12 px on the screen. */
  function labelSize(c) {
    const onScreen = c.getTransform().a / Math.min(2, window.devicePixelRatio || 1);
    return Math.max(13, 12.5 / (onScreen || 1));
  }

  function drawPeople(c, full) {
    const list = [...world.people.values(), ...(courier ? [courier] : [])].filter((p) => !p.out || p.path.length).sort((a, b) => a.y - b.y);
    const size = labelSize(c);
    for (const p of list) {
      const walk = p.path.length > 0;
      const y = p.y;
      if (world.selected === p.id) oval(c, p.x, p.y + 12, 22, 11, '#f8d878', null);
      const look = p.look ?? (L ? L.fromId(p.id) : null);
      if (look && !walk && (p.target?.area === 'stretch' || p.target?.area === 'volley' || p.target?.rest?.gym)) {
        // On the spot: stretching, on the gym kit, or on their toes at the volleyball net (facing the other side).
        L.sprite(c, look, p.x, y - Math.abs(Math.sin(world.time * 5 + p.seed)) * 6, p.target?.area === 'volley' ? p.face : 'south', { walk: true, time: world.time, seed: p.seed % 10 });
      } else if (look) L.sprite(c, look, p.x, y, p.face, { walk, time: world.time, seed: p.seed % 10 });
      else oval(c, p.x, y, 14, 18, PALETTE[p.seed % 6]);
      if (p.carry === 'coffee') coffeeTray(c, { ...p, y });
      else if (FOOD[p.carry]) pizzaBox(c, { ...p, y }, p.carry);
      else if (p.coffee === 'have' && world.time < p.coffeeUntil) coffeeHeld(c, { ...p, y });
      else if (breakOf(p) && !walk) drinkHeld(c, { ...p, y });
      if (p.slice && world.time < p.sliceUntil && !p.carry) sliceHeld(c, { ...p, y }, p.slice);
      if (full && p.bubbleUntil > world.time) bubble(c, { ...p, y }, size);
      else drawIcon(c, { ...p, y });
      if (world.selected === p.id) {
        const b = Math.sin(world.time * 5) * 3;
        c.beginPath();
        c.moveTo(p.x - 9, y - 74 + b);
        c.lineTo(p.x + 9, y - 74 + b);
        c.lineTo(p.x, y - 62 + b);
        c.closePath();
        c.fillStyle = '#f2b733';
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.stroke();
      }
      // Every name is shown (the nicknames are the point); at a shared desk they are cut to fit the chair.
      if (full && p.id !== 'courier') {
        const seats = p.target?.desk?.seats.length ?? 1;
        // On a towel the rows are staggered: a name is cut to its own towel's width.
        const max = p.target?.area === 'desk' || p.target?.area === 'needs' ? Math.max(48, 150 / seats) : p.target?.area === 'towel' ? 80 : 140;
        text(c, fitText(c, p.row.name, max, size * 0.85), p.x, y + 28, size * 0.85, INK, 'center');
      } else if (full && p.id === 'courier' && walk) text(c, p.row.name, p.x, y + 32, size * 0.92, '#56677b', 'center');
    }
  }

  // ---- The view ----

  function fit(view) {
    const cv = view.canvas;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    // As TOMLIN's overview window: the whole office in sight, never taller than the window, centred in its column.
    const box = cv.parentElement;
    const top = box.getBoundingClientRect().top + window.scrollY;
    // Everything under the canvas (the strip, the paddings) is measured, not guessed, so the office never pushes the
    // page past the bottom of the window: that would be a second scroll bar.
    const middle = box.closest('.middle');
    const layout = middle?.parentElement;
    const below = middle
      ? middle.getBoundingClientRect().bottom - cv.getBoundingClientRect().bottom + (layout ? parseFloat(getComputedStyle(layout).paddingBottom) || 0 : 0)
      : 90;
    const room = Math.max(260, window.innerHeight - top - Math.ceil(below) - 1);
    // The strip beside the office (a wide window) takes its own width and the gap out of the row.
    const css = getComputedStyle(box);
    const beside = css.display === 'flex' && css.flexDirection === 'row' && view.strip ? view.strip.offsetWidth + (parseFloat(css.columnGap) || 0) : 0;
    let cw = box.clientWidth - beside;
    let ch = (cw * H) / W;
    if (ch > room) {
      ch = room;
      cw = (ch * W) / H;
    }
    cw = Math.round(cw);
    ch = Math.round(ch);
    if (!cw) return false;
    const pw = Math.round(cw * ratio);
    const ph = Math.round(ch * ratio);
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw;
      cv.height = ph;
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
    }
    return true;
  }

  function draw(view) {
    if (!fit(view)) return;
    const c = view.ctx;
    const k = view.canvas.width / W;
    background ??= drawBackground();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, view.canvas.width, view.canvas.height);
    c.setTransform(k, 0, 0, k, 0, 0);
    c.drawImage(background, 0, 0);
    // Names are written only where they can be read at 12 px or more without crowding (not on a small phone).
    const full = labelSize(c) <= 24;
    if (full) for (const r of emptyRooms()) text(c, 'Empty: furnish it from Staff rewards (right panel)', r.x + r.w / 2, r.y + r.h / 2 + 30, labelSize(c) * 0.9, '#7b8794', 'center');
    // A locked room: a big padlock in the middle, and what opens it (always drawn: the padlock says it at any size).
    for (const r of ROOMS.filter(lockedRoom)) {
      padlock(c, r.x + r.w / 2, r.y + r.h / 2 - 22, 2.6, '#c9d3dc');
      const key = world.shop.find((i) => i.unlocks === r.lock);
      if (full) text(c, `Locked: click to unlock${key ? ` (${big(key.price)} tokens)` : ''}`, r.x + r.w / 2, r.y + r.h / 2 + 50, labelSize(c) * 0.9, '#e8eef4', 'center');
    }
    if (full && !world.people.size) text(c, 'Nobody in yet: start a thread in Claude and they come in.', 290, 200, labelSize(c), '#7b8794', 'center');
    drawDesks(c, full);
    for (const p of world.people.values()) if (p.target?.area === 'towel' && !p.path.length && !p.leaving) towel(c, p.target.x, p.target.y, p.seed);
    if (world.pizzaOn && world.food === 'donuts') {
      box(c, 268, 603, 70, 38, 4, '#ffe3ef', INK, 2);
      for (let i = 0; i < 6; i++) donut(c, 281 + (i % 3) * 22, 613 + Math.floor(i / 3) * 18, 7, PALETTE[i % 6]);
    } else if (world.pizzaOn && world.food === 'sandwiches') {
      box(c, 262, 603, 82, 38, 6, '#f6f1e6', INK, 2);
      for (let i = 0; i < 4; i++) sandwich(c, 277 + i * 18, 623, 8);
    } else if (world.pizzaOn) {
      box(c, 268, 603, 70, 38, 4, '#fff6e4', INK, 2);
      oval(c, 303, 622, 26, 14, '#f2bc66');
      for (let i = 0; i < 6; i++) oval(c, 285 + i * 7, 618 + (i % 2) * 7, 3, 3, '#dc776e', null);
    }
    if (world.rooms.boardroom.whiteboard && thinkersNow().length) for (let i = 0; i < 4; i++) line(c, 1122, 140 + i * 23, 1122 + 16 * ((Math.sin(world.time + i) + 1) / 2) + 2, 140 + i * 23, PALETTE[i], 4);
    if (world.rooms.lounge.arcade && [...world.people.values()].some((p) => p.target?.rest?.id === 'arcade' && !p.path.length)) {
      // Someone is playing: the screen flickers.
      const a = PIECES.arcade;
      const k = Math.floor(world.time * 5) % 4;
      box(c, a.x + 9 + k * 8, a.y + 10 + (k % 2) * 6, 5, 4, 1, '#ffffff', null);
    }
    drawPeople(c, full);
    if (world.rooms.volleyball && playing() >= 2) drawBall(c);
  }

  let running = false;
  let last = 0;
  const shown = (v) => v.canvas.isConnected && v.canvas.offsetParent !== null && !document.hidden;
  function wake() {
    if (running || !views.some(shown)) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }
  function frame(now) {
    const live = views.filter(shown);
    if (!live.length) {
      running = false;
      return;
    }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    world.seenAt = now;
    step(dt);
    for (const v of live) {
      if (now - (v.drawnAt ?? 0) < 33) continue;
      v.drawnAt = now;
      draw(v);
      if (now - (v.toldAt ?? 0) > 300) {
        v.toldAt = now;
        tell(v);
      }
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', wake);

  /** The line under the office: the person picked and what they do there, or how to pick one. */
  function tell(v) {
    const p = world.selected ? world.people.get(world.selected) : null;
    // A locked room just clicked: what it costs and the Unlock button stay under the office a while.
    if (!p && v.lockNote && clock() < v.lockNote.until) {
      if (v.told !== v.lockNote.key) {
        v.told = v.lockNote.key;
        v.strip.replaceChildren(...v.lockNote.parts);
      }
      return;
    }
    const key = p ? `${p.id}|${wordsOf(p)}|${holding(p)}|${p.row.name}` : `all|${world.people.size}`;
    if (key === v.told) return;
    v.told = key;
    if (p) {
      v.strip.replaceChildren(
        el('b', { text: p.row.name }), el('span', { class: 'note', text: ` · ${p.row.pcId || 'Consultants'}` }), el('br'),
        el('span', { text: wordsOf(p) }), el('br'),
        el('span', { class: 'note', text: `Holding: ${holding(p)}` }));
      return;
    }
    v.strip.replaceChildren(el('span', { class: 'note', text: world.people.size ? 'Click a person to see what they are doing.' : 'Nobody in the office yet.' }));
  }

  // ---- Pointer: press a person to pick them; press a desk to show only that project ----

  function at(view, e) {
    const r = view.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }
  const personAt = (x, y) => [...world.people.values()].filter((p) => !p.out).sort((a, b) => b.y - a.y).find((p) => Math.hypot(p.x - x, p.y - 10 - y) < 28);
  const deskUnder = (x, y) => world.desks.find((d) => x > d.x - d.w / 2 - 6 && x < d.x + d.w / 2 + 6 && y > d.y - 45 && y < d.y + 20);
  /** A locked room under the pointer: the room itself, or its padlocked door on the corridor side. */
  const lockedUnder = (x, y) => ROOMS.filter(lockedRoom).find((r) => x > r.x - 40 && x < r.x + r.w && y > r.y && y < r.y + r.h);

  /**
   * A locked room was clicked: say what unlocking it costs and how far the purse is from it, under the office and in
   * Staff rewards (opened, with the room's Unlock tile brought into view). The Unlock button under the office buys it.
   */
  function askUnlock(view, r) {
    const key = world.shop.find((i) => i.unlocks === r.lock);
    const room = r.lock === 'lounge' ? 'The lounge' : 'The meeting room';
    const left = world.purse?.left ?? 0;
    const words = !key ? `${room} is locked: unlock it in Staff rewards.`
      : left >= key.price ? `${room} is locked. Unlock it for ${big(key.price)} tokens: you have ${big(left)} to spend.`
        : `${room} is locked. Unlocking it costs ${big(key.price)} tokens: ${big(key.price - left)} more to go (${big(left)} to spend now).`;
    const parts = [el('b', { text: 'Locked' }), el('span', { class: 'note', text: ` · ${r.name}` }), el('br'), el('span', { text: words })];
    if (key) {
      const btn = el('button', { type: 'button', class: 'btn primary', 'aria-label': `Unlock ${room.toLowerCase()}`, onclick: (e) => buyItem(key, e.currentTarget) }, 'Unlock');
      parts.push(' ', btn);
    }
    view.lockNote = { key: `lock:${r.lock}:${words}`, until: clock() + 15, parts };
    view.told = '';
    world.selected = null;
    app()?.showTab?.('rewards');
    shopSaid.textContent = words;
    shopBox?.querySelector(`[aria-label="Unlock ${room.toLowerCase()}"]`)?.scrollIntoView({ block: 'nearest' });
    tell(view);
  }

  function hookPointer(view) {
    const cv = view.canvas;
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = at(view, e);
      cv.style.cursor = personAt(x, y) || deskUnder(x, y) || lockedUnder(x, y) ? 'pointer' : '';
    });
    cv.addEventListener('click', (e) => {
      const [x, y] = at(view, e);
      const p = personAt(x, y);
      if (p) {
        world.selected = p.id;
        view.told = '';
        app()?.pick(p.id);
        return;
      }
      const d = deskUnder(x, y);
      if (d) return app()?.pickProject?.(d.key);
      const r = lockedUnder(x, y);
      if (r) askUnlock(view, r);
    });
  }

  function addView(holder) {
    const canvas = el('canvas', { class: 'office-canvas', role: 'img', 'aria-label': 'The office: each Claude thread as a little person at their project\'s desk while it works, standing with a question mark when it needs you, in the meeting room when it thinks a long time (once it has a table), in the kitchen, the lounge or a deck chair when it has finished, and on a beach towel once a favourite has gone home. A locked room is dark: click it to unlock it. The List tab says the same in words.' });
    const strip = el('p', { class: 'office-strip', 'aria-live': 'off' });
    const view = { canvas, ctx: canvas.getContext('2d'), strip };
    holder.append(canvas, strip);
    hookPointer(view);
    views.push(view);
    new ResizeObserver(() => { view.drawnAt = 0; wake(); }).observe(holder);
    return view;
  }

  // ---- The shop: rewards paid from the tokens the AI writes (the server keeps the purse: src/shop.mjs) ----

  /** Where Staff rewards is drawn (the right panel's tab), once it has been opened. */
  let shopBox = null;
  /** What the shop list said when its cards were last drawn. */
  let shopItemsKey = '';
  const SHOP_WORDS = {
    pizza: { label: 'Pizza', title: 'A pizza comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought a slice where they are (free)' },
    coffee: { label: 'Coffee', title: 'A coffee delivery comes in by the front door and hands each of them a coffee, wherever they are, busy or not' },
    donuts: { label: 'Donuts', title: 'A box of donuts comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought one where they are' },
    sandwiches: { label: 'Sandwiches', title: 'A platter of sandwiches comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought one where they are' },
    arcade: { label: 'Arcade', title: 'An arcade machine for the lounge: staff who have finished play on it' },
    volleyball: { label: 'Volleyball', title: 'A beach volleyball net on the sand: staff who have finished play together, two a side' },
    boardroom_key: { label: 'Meeting room key' },
    lounge_key: { label: 'Lounge key' },
    table: { label: 'Table', title: 'Opens the meeting room: a long think goes to the table, and whoever has finished comes to help' },
    chairs: { label: 'Chairs', each: 'a pair', title: 'Two chairs round the meeting room table, up to six: thinkers sit first, helpers in the chairs left over (the rest stand)' },
    whiteboard: { label: 'Whiteboard', title: 'Fills with notes while someone thinks in the meeting room' },
    plants: { label: 'Plants', title: 'Indoor plants for the meeting room, one in each corner' },
    armchair: { label: 'Armchair', title: 'Staff who have finished nap in it' },
    bookcase: { label: 'Bookcase', title: 'Staff who have finished read there' },
    sofa: { label: 'Sofa', title: 'Staff who have finished chat in the lounge' },
    tv: { label: 'TV', title: 'Staff who have finished watch it from the sofa' },
    gym: { label: 'Gym', title: 'A treadmill and a weights bench for the lounge, kept for good' },
    deckchair: { label: 'Deck chair', title: 'A deck chair under an umbrella on the beach, up to six: staff who finished 10 minutes ago take a break there' },
  };
  const num = (n) => Number(n || 0).toLocaleString();
  const big = (n) => window.aiOffice?.tokens?.(n) ?? num(n);
  /** A shop item's picture, drawn with the office's own pencils into a 100 x 75 box. */
  function drawPic(c, id) {
    if (id === 'coffee') {
      box(c, 37, 24, 26, 40, 5, '#fff9eb');
      box(c, 37, 36, 26, 13, 2, '#c98f5a', INK, 2);
      box(c, 33, 16, 34, 9, 3, '#8a6a4c');
    } else if (id === 'donuts') {
      donut(c, 50, 40, 24, '#ef8a91');
      for (let i = 0; i < 6; i++) line(c, 40 + i * 4, 28 + (i % 2) * 18, 42 + i * 4, 31 + (i % 2) * 18, PALETTE[i % 6], 2);
    } else if (id === 'pizza') {
      c.beginPath();
      c.moveTo(22, 18);
      c.lineTo(80, 28);
      c.lineTo(36, 66);
      c.closePath();
      c.fillStyle = '#f2bc66';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.5;
      c.stroke();
      line(c, 24, 18, 78, 28, '#c98f5a', 6);
      for (const [x, y] of [[44, 32], [58, 36], [42, 48]]) oval(c, x, y, 5, 5, '#dc776e', null);
    } else if (id === 'plants') {
      drawPlant(c, 32, 40);
      drawPlant(c, 68, 40);
    } else if (id === 'sandwiches') {
      box(c, 10, 28, 80, 30, 8, '#f6f1e6', INK, 2);
      for (let i = 0; i < 3; i++) sandwich(c, 28 + i * 22, 44, 11);
    } else if (id === 'arcade') {
      c.save();
      c.translate(27 - PIECES.arcade.x, 12 - PIECES.arcade.y);
      drawArcade(c);
      c.restore();
    } else if (id === 'volleyball') {
      line(c, 50, 12, 50, 64, '#7b6a55', 5);
      c.setLineDash([3, 3]);
      line(c, 50, 16, 50, 60, '#ffffff', 1.5);
      c.setLineDash([]);
      oval(c, 50, 12, 4, 4, '#7b6a55', INK, 1.5);
      oval(c, 50, 64, 4, 4, '#7b6a55', INK, 1.5);
      oval(c, 24, 36, 9, 9, '#fff6e4', INK, 2);
      line(c, 17, 36, 31, 36, '#ef8a91', 2);
    } else if (id === 'table') {
      box(c, 14, 24, 72, 30, 12, '#e8bb80');
    } else if (id === 'chairs') {
      box(c, 18, 26, 28, 24, 8, '#a6aacb');
      box(c, 54, 26, 28, 24, 8, '#a6aacb');
    } else if (id === 'whiteboard') {
      box(c, 16, 12, 68, 50, 6, INK);
      box(c, 22, 18, 56, 38, 3, '#fff7ed');
      for (let i = 0; i < 3; i++) line(c, 28, 26 + i * 10, 52 + i * 8, 26 + i * 10, PALETTE[i], 3);
    } else if (id === 'armchair') {
      box(c, 26, 18, 48, 42, 12, '#a4bac9');
      box(c, 34, 30, 32, 26, 8, '#c6d6e2', INK, 1.5);
    } else if (id === 'bookcase') {
      box(c, 12, 22, 76, 32, 5, '#b78966');
      for (let i = 0; i < 8; i++) box(c, 17 + i * 8.5, 26, 7, 24, 1, PALETTE[i % 6], INK, 1.5);
    } else if (id === 'sofa') {
      box(c, 10, 36, 80, 20, 9, '#9ab4c9');
      box(c, 14, 18, 72, 24, 10, '#b8cddd');
    } else if (id === 'tv') {
      box(c, 12, 14, 76, 40, 6, INK);
      box(c, 17, 19, 66, 30, 3, '#182638');
      line(c, 50, 54, 50, 62, INK, 3);
      line(c, 38, 63, 62, 63, INK, 3);
    } else if (id === 'gym') {
      line(c, 22, 38, 78, 38, '#56677b', 4);
      box(c, 16, 24, 10, 28, 3, INK);
      box(c, 74, 24, 10, 28, 3, INK);
      box(c, 26, 28, 7, 20, 2, '#9ab6c7', INK, 1.5);
      box(c, 67, 28, 7, 20, 2, '#9ab6c7', INK, 1.5);
    } else if (id === 'deckchair') {
      c.save();
      c.translate(36, 46);
      c.scale(0.8, 0.8);
      deckChair(c, 0, 0, 0);
      c.restore();
    }
  }
  /** The shop's sections: [title, [[room heading, item ids, the room's lock (if it has one)]]]. */
  const SECTIONS = [['Treat the team', [['', ['pizza', 'coffee', 'donuts', 'sandwiches']]]], ['Improve the office', [['Meeting room', ['table', 'chairs', 'whiteboard', 'plants'], 'boardroom'], ['Lounge', ['armchair', 'bookcase', 'sofa', 'tv', 'gym', 'arcade'], 'lounge'], ['Beach', ['deckchair', 'volleyball']]]]];
  const PIZZA_ITEM = { id: 'pizza', name: 'Pizza', price: 0, room: 'treats', keeps: false, most: 0, have: 0, owned: false, waits: false };
  const shopSaid = el('p', { class: 'note', 'aria-live': 'polite' });
  const purseLine = el('span', { class: 'note' });
  const purseWords = () => {
    const p = world.purse;
    return p ? `${big(p.left)} tokens to spend · ${big(p.earned)} written since the office opened · ${big(p.spent)} spent` : '';
  };
  function tile(i) {
    const w = SHOP_WORDS[i.id] ?? { label: i.name, title: '' };
    const pic = el('canvas', { width: 100, height: 75, 'aria-hidden': 'true' });
    drawPic(pic.getContext('2d'), i.id);
    const left = world.purse?.left ?? 0;
    const count = i.most > 1 ? (i.id === 'chairs' ? `${i.have * 2} of 6` : `${i.have} of ${i.most}`) : '';
    const lines = i.owned ? [count ? `✓ All ${i.id === 'chairs' ? 6 : i.most}` : '✓ Bought']
      : [i.price ? `${big(i.price)} tokens${w.each ? ` ${w.each}` : ''}` : 'Free', count && `${count} bought`, i.waits ? 'Table first' : i.price > left ? `${big(i.price - left)} more to go` : ''].filter(Boolean);
    // A short tile: the picture, the name, the price and what is left to go. What the item does is its tooltip.
    const what = el('span', { class: 'what' }, el('b', { text: w.label }), ...lines.map((t) => el('span', { text: t })));
    if (i.owned) return el('li', { class: 'shop-item', title: w.title }, pic, what, el('span', { class: 'note', text: 'Bought' }));
    // Short of tokens or before its table: still pressable, and the shop says why (a greyed button explains nothing).
    const btn = el('button', { type: 'button', class: 'btn primary', title: w.title, 'aria-label': `${i.price ? 'Buy' : 'Order'} ${w.label}`, onclick: (e) => (i.id === 'pizza' ? buyPizza() : buyItem(i, e.currentTarget)) }, i.price ? 'Buy' : 'Order');
    return el('li', { class: 'shop-item', title: w.title }, pic, what, btn);
  }
  /** A locked room in the shop: its furniture is not offered, only one line with the key's price and an Unlock button. */
  function lockedLine(lock) {
    const key = world.shop.find((i) => i.unlocks === lock);
    if (!key) return el('p', { class: 'note', text: 'Room not available.' });
    const left = world.purse?.left ?? 0;
    const room = lock === 'lounge' ? 'the lounge' : 'the meeting room';
    const btn = el('button', { type: 'button', class: 'btn primary', 'aria-label': `Unlock ${room}`, onclick: (e) => buyItem(key, e.currentTarget) }, 'Unlock');
    return el('p', { class: 'row room-locked' }, el('span', {}, el('b', { text: 'Room not available' }), ` · ${big(key.price)} tokens to unlock${key.price > left ? ` (${big(key.price - left)} more to go)` : ''}`), btn);
  }
  function drawShop() {
    const item = (id) => (id === 'pizza' ? PIZZA_ITEM : world.shop.find((i) => i.id === id));
    purseLine.textContent = purseWords();
    const head = el('p', { class: 'row' }, purseLine);
    // The last few things bought (the office keeps the record), newest first.
    const when = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const recent = world.recent.length ? el('p', { class: 'note recent' }, 'Recent purchases: ',
      world.recent.map((b, i) => `${i ? ' · ' : ''}${SHOP_WORDS[b.item]?.label ?? b.item} ${big(b.price)} (${when(b.at)})`).join('')) : null;
    const sections = SECTIONS.map(([title, groups]) => el('section', {}, el('h3', { text: title }),
      ...groups.flatMap(([room, ids, lock]) => {
        const heading = room ? el('p', { class: 'note', text: room }) : null;
        if (lock && world.rooms.locked?.[lock]) return [heading, lockedLine(lock)];
        const items = ids.map(item).filter(Boolean);
        return items.length ? [heading, el('ul', { class: 'shop-list' }, ...items.map(tile))] : [];
      })));
    shopBox?.replaceChildren(...[head, recent, shopSaid, ...sections].filter(Boolean));
  }
  const present = () => [...world.people.values()].filter((p) => !p.out && !p.leaving);
  function buyPizza() {
    if (!present().length) return (shopSaid.textContent = 'Nobody is in the office to buy for: start a thread in Claude first.');
    if (!orderFood('pizza')) return (shopSaid.textContent = 'Food is on the table, or on its way: order again once it is eaten.');
    shopSaid.textContent = 'Pizza ordered (free).';
  }
  async function buyItem(item, button) {
    if (item.room === 'treats' && !present().length) return (shopSaid.textContent = 'Nobody is in the office to buy for: start a thread in Claude first.');
    if (FOOD[item.id] && tableBusy()) return (shopSaid.textContent = 'Food is on the table, or on its way: buy more once it is eaten.');
    if (item.id === 'coffee' && (courier?.job.kind === 'coffee' || deliveries.some((d) => d.kind === 'coffee'))) return (shopSaid.textContent = 'A coffee delivery is on its way already: buy another once it has been round.');
    button.disabled = true;
    try {
      const d = await window.aiOffice.api('/api/buy', { item: item.id });
      officeData(d.shop);
      drawShop();
      // One short line: the purse line above says what is left, and Recent purchases keeps the record.
      if (item.id === 'coffee') {
        deliveries.push({ kind: 'coffee', who: present().map((p) => p.id), at: 0 });
        shopSaid.textContent = `Coffee ordered (${big(item.price)} tokens).`;
      } else if (FOOD[item.id]) {
        orderFood(item.id);
        shopSaid.textContent = `${SHOP_WORDS[item.id]?.label ?? item.name} ordered (${big(item.price)} tokens).`;
      } else if (item.unlocks) {
        for (const v of views) {
          v.lockNote = null;
          v.told = '';
          tell(v);
        }
        for (const p of present()) say(p, ['It\'s open!', 'A new room!', 'Thanks, boss!'][p.seed % 3], 4);
        shopSaid.textContent = `${item.unlocks === 'lounge' ? 'The lounge' : 'The meeting room'} is unlocked (${big(item.price)} tokens): furnish it from the list below.`;
      } else {
        for (const p of present()) {
          say(p, ['New furniture!', 'Nice!', 'Very smart!'][p.seed % 3], 4);
          if (p.target?.rest) p.restUntil = 0;
        }
        shopSaid.textContent = `${item.name} bought (${big(item.price)} tokens).`;
      }
      wake();
    } catch (e) {
      const f = e.error || {};
      shopSaid.textContent = f.fault ? `${f.fault} ${f.reason || ''} ${f.wayOut || ''}` : 'The office did not answer. Check that AI Office Overview is still running.';
    } finally {
      button.disabled = false;
    }
  }
  /** Staff rewards (the right panel's tab): drawn into `box` when the tab is opened. */
  function rewards(box) {
    shopBox = box;
    shopSaid.textContent = '';
    drawShop();
  }

  const holder = document.getElementById('office');
  if (holder) addView(holder);
  // The office fits the window's height: a taller or shorter window redraws it.
  window.addEventListener('resize', () => { for (const v of views) v.drawnAt = 0; wake(); });

  window.officeView = {
    update,
    select: (id) => {
      world.selected = id;
      for (const v of views) v.told = '';
      wake();
    },
    /** Moves the office on by `seconds` without waiting for frames (for checks while the page is hidden). */
    advance: (seconds) => {
      world.seenAt = performance.now();
      for (let t = 0; t < seconds; t += 0.05) step(0.05);
      for (const v of views) {
        draw(v);
        tell(v);
      }
    },
    where: (id) => {
      const p = world.people.get(id);
      return p ? { x: p.x, y: p.y, walking: p.path.length > 0, area: p.target?.area, words: wordsOf(p) } : null;
    },
    rewards,
  };
})();
