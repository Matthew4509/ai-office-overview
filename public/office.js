// The office seen from above, with AI threads for staff.
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
  /** The office by night (the dark theme): floors, walls, the outside and the furniture in evening light. People, screens,
   * signs, food and the beach things keep their own colours, so they stand out as they do by day. A colour not listed
   * here is the same by day and by night. */
  // One family by night, matched to the page's own dark cards (slate blue-grey): every room floor at the same darkness
  // with only a hint of its day colour, the hallway a step lighter (with lamplight, see lamps), wood and sand muted
  // rather than bright, and outlines near-black so furniture keeps its edges on a dark floor.
  const NIGHT = {
    '#27364e': '#0b0f15', // outlines (INK)
    '#cbd6df': '#2b3440', // the hallway: a step lighter than the rooms, like a lit corridor
    '#e8eff2': '#232b36', // computer room
    '#e9e7f1': '#262735', // meeting room (a hint of violet)
    '#f3e9dc': '#2b2926', // kitchen (a hint of warmth)
    '#e0ece7': '#222d2c', // lounge and library (a hint of green)
    '#b9c9a4': '#25302a', // the verge
    '#d9cfb8': '#3a3d44', // the path
    '#f2dfae': '#4a4434', // the sand
    '#7fc4e0': '#15344a', // the sea
    '#d8f0fa': '#36627f', // waves
    '#cfe8f5': '#4f6f8a', // the lounge window (moonlight)
    '#a4b8c3': '#46525f', // the front door, the sink
    '#d5e3e8': '#6d7d89', // the sink's basin
    '#e8bb80': '#7e6650', // desks, tables, the counter: muted wood
    '#9eb3c8': '#45546a', // desk chairs
    '#a6aacb': '#4f5170', // meeting room chairs
    '#fff7e9': '#a8b0bc', // keyboards
    '#b78966': '#6c5644', // the bookcase
    '#a4bac9': '#4a5c6c', // the armchair
    '#9ab4c9': '#46596c', // the sofa's seat
    '#b8cddd': '#55697d', // the sofa's back
  };
  /** True while the page is dark (Settings › Office › Theme, or Windows when it follows Windows): see readTheme. */
  let night = false;
  const tone = (col) => (night && NIGHT[col]) || col;
  /** Words written straight on the floor: dark by day, light by night. */
  const floorInk = () => (night ? '#e8ecf2' : INK);
  const floorSoft = () => (night ? '#a5afbe' : '#7b8794');
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
  /** What can come to the kitchen table: pizza (free), and donuts, sandwiches, ice creams and cake (from the shop), with their words. */
  const FOOD = {
    pizza: { courier: 'Pizza delivery', called: 'Pizza delivery!', cheer: ['Pizza!', 'Yum!', 'Thanks, boss!'], going: 'Off to the kitchen: pizza!', having: 'Having pizza in the kitchen', holding: 'a slice of pizza' },
    donuts: { courier: 'Donut delivery', called: 'Donuts!', cheer: ['Donuts!', 'Sprinkles!', 'Thanks, boss!'], going: 'Off to the kitchen: donuts!', having: 'Having a donut in the kitchen', holding: 'a donut' },
    sandwiches: { courier: 'Sandwich delivery', called: 'Sandwiches!', cheer: ['Lunch!', 'Sandwiches!', 'Thanks, boss!'], going: 'Off to the kitchen: sandwiches!', having: 'Having a sandwich in the kitchen', holding: 'a sandwich' },
    icecream: { courier: 'Ice cream delivery', called: 'Ice creams!', cheer: ['Ice cream!', 'Brain freeze!', 'Thanks, boss!'], going: 'Off to the kitchen: ice cream!', having: 'Having an ice cream in the kitchen', holding: 'an ice cream cone' },
    cake: { courier: 'Cake delivery', called: 'Cake!', cheer: ['Cake!', 'Is it someone\'s birthday?', 'Thanks, boss!'], going: 'Off to the kitchen: cake!', having: 'Having cake in the kitchen', holding: 'a slice of cake' },
  };
  /** How long a delivered coffee is held (seconds). */
  const COFFEE_HELD = 120;
  /** The gym in the lounge once bought: a treadmill and a weights bench, and the spots in front of them. */
  const GYM = [{ x: 778, y: 566, w: 70, h: 36 }, { x: 872, y: 566, w: 64, h: 36 }];
  /** The trophy case (World's Best Boss), once earned: at the far end of the corridor between the computer room and the kitchen. */
  const TROPHY = { x: 24, y: 366, w: 48, h: 68 };
  /** What is always there to walk round (the kitchen), and the pieces bought for the meeting room and lounge. */
  const FIXED = [{ x: 80, y: 475, w: 180, h: 43 }, { x: 465, y: 480, w: 60, h: 65 }, { x: 230, y: 600, w: 150, h: 45 }];
  /** The kitchen's vending machine (click it: energy drinks for everyone in, a 1M-token coin). */
  const VENDING = FIXED[1];
  /** An energy drink lasts this long (seconds), and they walk this many times as fast meanwhile. */
  const ENERGY_SECONDS = 60;
  const ENERGY_PACE = 3;
  const PIECES = { table: { x: 760, y: 145, w: 290, h: 100 }, bookcase: { x: 680, y: 475, w: 110, h: 35 }, tv: { x: 950, y: 450, w: 160, h: 50 }, sofa: { x: 920, y: 720, w: 200, h: 32 }, arcade: { x: 1118, y: 452, w: 46, h: 52 } };
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
  /** The meeting room's water cooler (once bought), in the corner by the door, and its wall clock over the table. */
  const COOLER = { x: 652, y: 300, w: 30, h: 42 };
  const CLOCK = { x: 905, y: 42, r: 15 };
  /** The inflatable flamingo (once bought): where it floats on the sea, drifting a little either side. */
  const FLAMINGO = { x: 560, y: 924 };
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
  const EMPTY = { boardroom: { table: false, chairs: 0, whiteboard: false, plants: false, clock: false, cooler: false }, lounge: { armchair: false, bookcase: false, sofa: false, tv: false, gym: false, arcade: false }, rest: ['coffee', 'vending', 'lunch'], away: ['window'], deckchairs: 0, volleyball: false, locked: { boardroom: true, lounge: true } };
  /** A room still locked (its key not bought yet): its door stays shut with a padlock on it. */
  // A room just bought stays shut (world.unlocking: the rooms bought, in turn) until the IT tech has walked over and
  // unlocked it. Two bought together: the tech opens one, then walks on to the other.
  const lockedRoom = (r) => !!r.lock && (!!world.rooms.locked?.[r.lock] || world.unlocking.includes(r.lock));
  const world = { desks: [], deckOrder: [], people: new Map(), staff: [], time: 0, selected: null, seenAt: 0, first: true, grid: [], layout: '', table: [], tableAt: 0, thoughts: [], fitting: [], serverRooms: null, rooms: EMPTY, roomsKey: '', purse: null, shop: [], recent: [], blocks: FIXED, filter: undefined, unlocking: [], party: null };
  /** The pieces in the way now: the fixed ones and whatever is bought. */
  const blocksOf = () => [...FIXED, ...Object.entries(PIECES).filter(([k]) => (k === 'table' ? world.rooms.boardroom.table : world.rooms.lounge[k])).map(([, b]) => b), ...(world.rooms.lounge.gym ? GYM : []), ...(world.rooms.boardroom.plants ? PLANTS.map((p) => ({ x: p.x - 14, y: p.y - 14, w: 28, h: 28 })) : []), ...(world.rooms.boardroom.cooler ? [COOLER] : []), ...(world.rooms.trophy ? [TROPHY] : [])];
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
    // On an energy drink nobody with nothing to do stays put, not even off the beach towels: they dash about.
    if (buzzing(p) && ['resting', 'towel', 'needs'].includes(s.doing)) return energyRun(p);
    if (s.doing === 'towel') {
      // A favourite gone home: their own towel on the sand (past ten, the row is shared a little to the side).
      const i = towelers().findIndex((x) => x.id === s.id);
      const [x, y] = TOWELS[i % TOWELS.length];
      const more = Math.floor(i / TOWELS.length);
      return { key: `towel:${i}`, x: x + more * 14, y: y - more * 6, face: 'south', area: 'towel' };
    }
    // The council of ducks sits first: a big bug outranks everything else in the office.
    const council = councilSeat(p);
    if (council) return council;
    // A room just opened, or a piece just set up with a place for them: those waiting for you go and look too.
    const freeNow = world.staff.filter((x) => x.doing === 'resting' || x.doing === 'needs');
    const partyOn = (!!world.party && world.time < world.party.until)
      || (!!world.tryOut && world.time < world.tryOut.until && freeNow.findIndex((x) => x.id === s.id) < tryOutSpots(world.tryOut.piece).length);
    if (s.doing === 'needs' && desk && !partyOn) {
      // Waiting a while for your reply: off to try a room or a deck chair, then back (the "?" goes with them).
      const visit = waitingVisit(p);
      if (visit) return visit;
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
    if ((s.doing === 'thinking' && !desk) || (s.doing === 'needs' && !desk && !partyOn)) {
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
    // A room just opened: everyone with nothing to do runs in to see it, and jumps and spins there a while.
    if (world.party && world.time < world.party.until && (s.doing === 'resting' || s.doing === 'needs')) {
      // Those waiting for your reply come too (the "?" goes with them).
      const r = ROOMS.find((x) => x.lock === world.party.lock);
      const i = world.staff.filter((x) => x.doing === 'resting' || x.doing === 'needs').findIndex((x) => x.id === s.id);
      return { key: `party:${i}`, x: r.x + 90 + (i % 5) * 90, y: r.y + 110 + (Math.floor(i / 5) % 3) * 70, face: 'south', area: 'party' };
    }
    // Something just set up: the free (and those waiting for you) go and try it a while, as many as it has places.
    if (world.tryOut && world.time < world.tryOut.until && (s.doing === 'resting' || s.doing === 'needs')) {
      const spots = tryOutSpots(world.tryOut.piece);
      const i = world.staff.filter((x) => x.doing === 'resting' || x.doing === 'needs').findIndex((x) => x.id === s.id);
      if (i >= 0 && i < spots.length) return { ...spots[i], key: `try:${world.tryOut.piece}:${i}`, trying: world.tryOut.piece };
    }
    // Food on the kitchen table: everyone with nothing to do gathers round it (whoever works, works on).
    if (world.table.length && s.doing === 'resting') {
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
      // Spots in use: others resting there, and anyone trying one out while they wait for a reply.
      const taken = new Set([...world.people.values()].filter((o) => o !== p && (o.rest || o.visit?.target.rest)).map((o) => (o.rest || o.visit.target.rest).id));
      const free = spots.filter((r) => !taken.has(r.id) && r.id !== p.rest?.id);
      const pick = (free.length ? free : spots)[Math.floor(Math.random() * (free.length || spots.length))];
      p.rest = pick;
      p.restUntil = world.time + 180 + Math.random() * 180; // 3-6 minutes in one spot, enjoying it
    }
    const r = p.rest;
    return { key: `rest:${r.id}`, x: r.x + ((p.seed % 5) - 2) * 10, y: r.y + ((p.seed >> 3) % 3) * 6, face: r.face, area: r.area, rest: r };
  }

  /** Dashing about on an energy drink: a spot somewhere in the office or on the beach, and as soon as they get there,
   * the next one (never the same twice running). Rooms still locked are left out. */
  function energyRun(p) {
    const spots = [...PIZZA, ...STRETCH, ...DECK, ...VOLLEY, ...TOWELS, ...REST.filter((r) => world.rooms.rest.includes(r.id)).map((r) => [r.x, r.y]),
      ...(lockedRoom(ROOMS[1]) ? [] : STANDING)];
    const there = p.run && p.targetKey === p.run.key && !p.path.length;
    if (!p.run || there) {
      let i = Math.floor(Math.random() * spots.length);
      if (i === p.run?.i) i = (i + 1 + Math.floor(Math.random() * (spots.length - 1))) % spots.length;
      const n = (p.run?.n ?? 0) + 1;
      p.run = { n, i, key: `run:${n}`, x: spots[i][0], y: spots[i][1] };
      if (there && Math.random() < 0.3) say(p, DASH_LINES[Math.floor(Math.random() * DASH_LINES.length)], 1.5);
    }
    return { key: p.run.key, x: p.run.x, y: p.run.y, face: 'south', area: 'run' };
  }
  const DASH_LINES = ['Lap two!', 'Beach! Now kitchen!', 'Can\'t stop, won\'t stop!', 'Beep beep, coming through!', 'Last one there is a bug!', 'Sprint!'];

  /** Waiting for a reply: after VISIT_AFTER seconds they go and try something bought (a lounge spot, a free deck chair)
   * and stay there, enjoying it, until the reply comes (a reply ends the visit and they hurry back to the desk), rather
   * than popping back and forth. The "?" stays up all the while. null = at the desk. */
  const VISIT_AFTER = 40;
  function waitingVisit(p) {
    const t = world.time;
    if (p.visit) return p.visit.target;
    if (t - (p.needsSince ?? t) < VISIT_AFTER) return null;
    // What there is to try: the lounge's bought spots (not a free one) and the deck chairs nobody is in.
    const busy = new Set([...world.people.values()].filter((o) => o !== p).map((o) => o.targetKey));
    const options = REST.filter((r) => r.area === 'lounge' && r.id !== 'window' && world.rooms.rest.includes(r.id) && !busy.has(`rest:${r.id}`) && !busy.has(`visit:${r.id}`))
      .map((r) => ({ key: `visit:${r.id}`, x: r.x, y: r.y, face: r.face, area: r.area, rest: r, visit: VISIT_WORDS[r.id] || 'the lounge' }));
    DECK.slice(0, Math.min(world.rooms.deckchairs, DECK.length)).forEach(([x, y], i) => {
      if (!busy.has(`break:${i}`)) options.push({ key: `break:${i}`, x, y, face: 'south', area: 'break', visit: 'the deck chairs' });
    });
    if (!options.length) return null;
    const pick = options[(p.seed + Math.floor(t / 60)) % options.length];
    p.visit = { target: { ...pick, waiting: true } };
    // The first to go says what they are trying; someone going the same way soon after answers them instead.
    const last = world.lastVisit;
    const follows = last && last.id !== p.id && last.what === pick.visit && t - last.at < 90;
    const line = follows ? GOING_TOO[(p.seed + (world.visits || 0)) % GOING_TOO.length].replace('{who}', last.who)
      : GOING[(p.seed + (world.visits || 0)) % GOING.length].replace('{what}', pick.visit);
    world.visits = (world.visits || 0) + 1;
    world.lastVisit = { id: p.id, who: p.row.name, what: pick.visit, at: t };
    say(p, line, 3);
    return p.visit.target;
  }
  /** Going to try something while waiting for a reply: the first one, then someone joining them. */
  const GOING = [
    'Trying out {what} while I wait for you!',
    'While I wait: time to test {what}.',
    'Waiting on you, so I\'m off to {what}. Shout when you\'re back!',
    'Quick look at {what} while the boss reads my question.',
    'I\'ll be at {what}. The "?" is still up!',
    'Someone has to try {what}. Might as well be me.',
  ];
  const GOING_TOO = [
    'Great idea, {who}! I\'ll do the same while I wait.',
    'Room for one more, {who}?',
    'Wait for me, {who}!',
    'If {who} is going, I\'m going.',
    'Same here, {who}. Still waiting for a reply.',
  ];
  const VISIT_WORDS = { tv: 'the TV', nap: 'the armchair', library: 'the bookcase', chat: 'the sofa', treadmill: 'the treadmill', weights: 'the weights', arcade: 'the arcade machine' };

  /** Where a piece just set up is tried out: the volleyball court (four places), the newest deck chair, a lounge
   * piece's own spot, or round the meeting room table. */
  function tryOutSpots(piece) {
    if (['ducks', 'rocks', 'cactus', 'clock', 'flamingo'].includes(piece)) return [];
    // Everyone comes to admire the trophy case.
    if (piece === 'trophy') return [[100, 378, 'west'], [100, 422, 'west'], [128, 386, 'west'], [128, 414, 'west'], [156, 400, 'west']].map(([x, y, face]) => ({ x, y, face, area: 'corridor' }));
    if (piece === 'volleyball') return VOLLEY.map(([x, y, face]) => ({ x, y, face, area: 'volley' }));
    if (piece === 'deckchair') {
      const i = Math.max(0, Math.min(world.rooms.deckchairs, DECK.length) - 1);
      return [{ x: DECK[i][0], y: DECK[i][1], face: 'south', area: 'break' }];
    }
    const lounge = REST.filter((r) => SPOT_PIECE[r.id] === piece).map((r) => ({ x: r.x, y: r.y, face: r.face, area: r.area, rest: r }));
    if (lounge.length) return lounge;
    return STANDING.map(([x, y, face]) => ({ x, y, face, area: 'boardroom' }));
  }
  /** Seconds the free staff spend trying out a piece just set up. */
  const TRY_SECONDS = 25;

  /** Favourites on a towel, in a steady order (so nobody swaps towels when someone else arrives). */
  const towelers = () => world.staff.filter((x) => x.doing === 'towel').sort((a, b) => (a.id < b.id ? -1 : 1));

  /** The council of ducks: a big bug (BIG_BUG snags in a quarter of an hour, measured from the thread) calls the one
   * with it and everyone free (and anyone thinking in the meeting room) round the table for COUNCIL_SECONDS, their ducks
   * in a ring on it. Needs the ducks and the table; at most one every COUNCIL_GAP seconds. */
  const BIG_BUG = 3;
  const COUNCIL_SECONDS = 90;
  const COUNCIL_GAP = 300;
  const COUNCIL_CALL = ['This bug is too big for one duck. Assemble the council!', 'Three snags in a row? Summon the council of ducks!', 'I need more ducks. Council, to the meeting room!'];
  const COUNCIL_JOIN = ['The council of ducks is in session.', 'Bringing my duck!', 'Quack. I mean: coming.', 'The ducks will hear this.'];
  const COUNCIL_DONE = ['The council has spoken. Back to it!', 'The ducks have listened. I know what to try.', 'Thank you, council. Meeting closed.'];
  const councilOn = () => !!world.council && world.time < world.council.until && world.rooms.boardroom.table && world.rooms.ducks;
  /** Round the table, in order: the one with the bug, those thinking there, then the free. */
  function councilList() {
    if (!councilOn()) return [];
    const here = (x) => { const o = world.people.get(x.id); return o && !o.leaving && x.doing !== 'towel'; };
    const thinkers = new Set(boardroomThinkers().map((x) => x.id));
    const lead = world.staff.filter((x) => x.id === world.council.id && here(x));
    const rest = world.staff.filter((x) => x.id !== world.council.id && here(x) && (x.doing === 'resting' || thinkers.has(x.id)));
    return [...lead, ...rest].slice(0, MEETING.length + STANDING.length);
  }
  function councilSeat(p) {
    const i = councilList().findIndex((x) => x.id === p.id);
    if (i < 0) return null;
    const seat = i < MEETING.length ? MEETING[seatOrder()[i]] : STANDING[(i - MEETING.length) % STANDING.length];
    return { key: `council:${i}`, x: seat[0], y: seat[1], face: seat[2], area: 'boardroom', council: true, chair: i < world.rooms.boardroom.chairs };
  }
  function callCouncil(p) {
    if (!world.rooms.ducks || councilOn() || clock() - (world.councilAt ?? -Infinity) < COUNCIL_GAP) return;
    world.councilAt = clock();
    if (!world.rooms.boardroom.table) { say(p, 'This one needs the council of ducks… if only the meeting room had a table.', 4); return; }
    world.council = { id: p.id, until: world.time + COUNCIL_SECONDS };
    say(p, COUNCIL_CALL[(p.seed + (world.councils = (world.councils || 0) + 1)) % COUNCIL_CALL.length], 4);
    present().filter((o) => o !== p && o.row?.doing === 'resting').slice(0, 2).forEach((o, i) => say(o, COUNCIL_JOIN[(o.seed + i + world.councils) % COUNCIL_JOIN.length], 3));
    for (const o of world.people.values()) o.targetKey = '';
    wake();
  }
  function endCouncil() {
    const lead = world.people.get(world.council.id);
    if (lead && !lead.leaving) say(lead, COUNCIL_DONE[(lead.seed + (world.councils || 0)) % COUNCIL_DONE.length], 4);
    world.council = null;
    for (const o of world.people.values()) if (o.target?.council) o.targetKey = '';
  }

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
    // A chair someone waiting for a reply is trying out is theirs until they go back: never two on one chair.
    const visiting = new Set([...world.people.values()].filter((o) => o.visit && String(o.visit.target.key).startsWith('break:')).map((o) => Number(o.visit.target.key.slice(6))));
    const chairs = [...Array(Math.min(world.rooms.deckchairs, DECK.length)).keys()].filter((c) => !visiting.has(c));
    const i = free.findIndex((x) => x.id === p.id);
    return i >= 0 && i < chairs.length ? chairs[i] : -1;
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
  /** Less motion (Windows' "Show animations" off, or the browser's reduced-motion setting): people and helpers go
   * straight to their place instead of walking, and nobody jumps, spins or bobs. */
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const calm = () => !!reduceMotion?.matches;
  function move(o, dt, speed) {
    if (calm()) speed = 1e6;
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
    think(p, text);
  }
  // ---- Thoughts: a chat beside the office, like a team chat: what the staff say and think, a message at a time ----

  /** How many messages are kept, how many the chat shows, and how many may wait to be posted. */
  const THOUGHTS_KEPT = 30;
  const THOUGHTS_SHOWN = 8;
  const THOUGHTS_WAITING = 20;
  /** Messages waiting to be posted: they go into the chat one at a time, 1 to 2 seconds apart, as if typed. */
  const chatQueue = [];
  let chatNextAt = 0;
  /** The chat setting (Settings › Office): 'all', 'work' (work lines and plain facts only) or 'off'. */
  const chatMode = () => app()?.chatMode?.() ?? 'all';
  /** Something a person said or thought, queued for the chat. Their same words again within 10 minutes are left out.
   * kind 'work': a line about their work (kept in Work only); anything else is the office chat. */
  function think(p, text, kind = 'chat') {
    if (!text || !p?.row || world.people.get(p.id) !== p || p.leaving) return;
    const mode = chatMode();
    if (mode === 'off' || (mode === 'work' && kind !== 'work')) return;
    const now = Date.now();
    const said = (t) => t.id === p.id && t.text === text;
    if (chatQueue.some(said) || world.thoughts.some((t) => said(t) && now - t.at < 600000)) return;
    chatQueue.push({ id: p.id, who: p.row.name, look: p.row.look ?? null, folder: p.row.pcId ?? '', text });
    if (chatQueue.length > THOUGHTS_WAITING) chatQueue.shift();
  }
  /** Posts the next waiting message when its turn comes (newest at the bottom of the chat). */
  function postThought() {
    const now = Date.now();
    if (!chatQueue.length || now < chatNextAt) return;
    world.thoughts.push({ ...chatQueue.shift(), at: now });
    if (world.thoughts.length > THOUGHTS_KEPT) world.thoughts.shift();
    // On energy drinks the chat runs as fast as they talk.
    chatNextAt = now + ([...world.people.values()].some(buzzing) ? 250 + Math.random() * 250 : 1000 + Math.random() * 1000);
    for (const v of views) tell(v);
  }
  setInterval(postThought, 250);
  /** What they think on settling somewhere with nothing to do (only now and then, so the list is not all the same). */
  const AT_EASE = {
    corridor: ['Look at that trophy. Best boss in the business.', 'World\'s Best Boss. It says so right there.', 'I\'m going to polish that glass later.'],
    pizza: ['This pizza is wonderful.', 'Best slice all week.', 'Who ordered the pineapple?'],
    donuts: ['These donuts are dangerous.', 'Sprinkles make everything better.', 'Just the one. Maybe two.'],
    sandwiches: ['A proper lunch, at last.', 'Cheese and pickle, my favourite.', 'Crusts on, like a grown-up.'],
    icecream: ['Mint choc chip, obviously.', 'Eat it before it melts.', 'Ice cream at work. Living the dream.'],
    cake: ['Whose birthday is it? Doesn\'t matter.', 'The middle slice is mine.', 'Cake makes any bug smaller.'],
    coffee: ['Coffee first, then code.', 'This machine makes a decent flat white.'],
    vending: ['Crisps or chocolate? Both.', 'It ate my coin again.'],
    lunch: ['Lunch away from the desk, for once.', 'Leftovers again.'],
    tv: ['Just one more episode.', 'Who has the remote?'],
    nap: ['Five minutes… just five.', 'Resting my eyes.'],
    library: ['Reading up on something new.', 'This book has better examples than the docs.'],
    chat: ['Anyone else on a roll today?', 'Did you see that bug? Gone now.'],
    treadmill: ['Running off that pizza.', 'Ten more minutes.'],
    weights: ['Leg day.', 'Lifting the mood.'],
    arcade: ['New high score incoming!', 'One more go.'],
    window: ['Nice view today.', 'Is that rain coming?'],
    break: ['These deck chairs are nice.', 'Sun, sea and no bugs.', 'I could get used to this.'],
    towel: ['Off duty. Bliss.', 'Wake me when it is tomorrow.'],
    volley: ['Serve it up!', 'Mine! …not mine.'],
    stretch: ['A good stretch helps the thinking.', 'Back straight, shoulders down.'],
  };
  /** What the others say when someone is the first out on the deck chairs. */
  const FIRST_OUT_REPLY = ['I\'m jealous, {who}!', 'I\'ll check it out soon.', 'Save me a chair, {who}!', 'Enjoy it, {who}. Some of us are working!', 'Is the water warm?'];
  function atEase(p) {
    const t = p.target;
    if (!t || (p.seed + Math.floor(world.time / 7)) % 3) return;
    const pick = (list) => list?.[(p.seed + Math.floor(world.time)) % list.length];
    if (t.area === 'break') {
      const others = [...world.people.values()].some((o) => o !== p && o.target?.area === 'break' && !o.path.length);
      if (others) return think(p, pick(AT_EASE.break));
      think(p, 'I\'m the first one out here!');
      // Two of the others answer from where they are.
      [...world.people.values()].filter((o) => o !== p && !o.leaving && !o.out && o.row).slice(0, 2)
        .forEach((o, i) => think(o, FIRST_OUT_REPLY[(o.seed + i) % FIRST_OUT_REPLY.length].replace('{who}', p.row.name)));
      return;
    }
    think(p, pick(t.pizza ? AT_EASE[foodOf(p)] : AT_EASE[t.rest?.id] ?? AT_EASE[t.area]));
  }
  /** What they are thinking at work, from what their thread is doing ("Editing app.php", "Running: Run the tests"). */
  const AT_WORK = {
    php: 'PHP in progress… thinking about loops?', js: 'Untangling some JavaScript in {f}.', mjs: 'Untangling some JavaScript in {f}.',
    ts: 'Types, types, types: {f}.', css: 'Getting the colours just right in {f}.', html: 'Laying out {f}.', md: 'Writing it all down in {f}.',
    json: 'Sorting out the settings in {f}.', py: 'A bit of Python in {f}.', sql: 'Talking to the database.', cs: 'C# in {f}: braces everywhere.',
    cmd: 'A little batch file magic.', ps1: 'PowerShell, my old friend.',
  };
  /** A command being run (a test, a build): ten ways to say it, so the chat is not all the same. */
  const RUNNING = [
    '{what}… fingers crossed.',
    'Testing the project: {low}.',
    'Running a test. Come on, green!',
    '{what}. Please pass, please pass.',
    'Kicking off: {low}.',
    'Let\'s see what breaks: {low}.',
    'Tests running. Nobody touch anything!',
    '{what}: here goes nothing.',
    'Waiting on the test runner…',
    'Running {low}. Kettle on while it goes.',
  ];
  /** A word with the pet rock, for someone alone at their desk. */
  const ROCK_LINES = ['Just me and {rock}. Best team in the office.', 'You get me, {rock}.', '{rock} says the code looks fine. {rock} is a rock.', 'Never alone with {rock} here.', 'Morning, {rock}. Ready to ship?'];
  /** Office chat for something that happened to p (window.officeBanter has the characters and lines). Most moments get
   * one line out loud, some a reply or two from those nearby (their own desk first), some nothing; the same kind from the
   * same person waits KIND_GAP seconds, and the office as a whole BANTER_GAP. Work only: the plain fact instead. */
  const BANTER_GAP = 25;
  const KIND_GAP = 180;
  function banter(p, e) {
    const B = window.officeBanter;
    if (!B || !p?.row || p.leaving) return;
    if (chatMode() === 'work') { const f = B.fact(e); if (f) think(p, f, 'work'); return; }
    if (chatMode() === 'off') return;
    p.banterAt = p.banterAt || {};
    if (clock() - (p.banterAt[e.kind] ?? -Infinity) < KIND_GAP || clock() - (world.banterAt ?? -Infinity) < BANTER_GAP) return;
    const near = present().filter((o) => o !== p && o.row).sort((a, b) => (b.row.pcId === p.row.pcId) - (a.row.pcId === p.row.pcId)).slice(0, 3);
    const lines = B.plan(e, B.characterOf(p.seed), near.map((o) => ({ character: B.characterOf(o.seed), name: o.row.name })), p.row.name);
    if (!lines.length) return;
    p.banterAt[e.kind] = world.banterAt = clock();
    lines.forEach((l, i) => {
      const who = l.by < 0 ? p : near[l.by];
      if (who) (i === 0 ? say(who, l.text, 4) : think(who, l.text));
    });
  }
  /** Payday: on a Thursday (this PC's clock), once, when two or more are in with different earnings today, they compare
   * pay in the chat (officeBanter.payday). Not straight away: a small chance on each refresh, so it lands during the day. */
  function paydayChat() {
    const B = window.officeBanter;
    const now = new Date();
    if (!B?.payday || chatMode() !== 'all' || now.getDay() !== 4 || world.paydayOn === now.toDateString()) return;
    if (clock() - (world.banterAt ?? -Infinity) < BANTER_GAP || Math.random() > 0.05) return;
    const crew = present().filter((p) => p.row);
    const lines = B.payday(crew.map((p) => ({ name: p.row.name, today: p.row.today })));
    if (!lines.length) return;
    world.paydayOn = now.toDateString();
    world.banterAt = clock();
    lines.forEach((l, i) => (i === 0 ? say(crew[l.by], l.text, 4) : think(crew[l.by], l.text)));
  }
  function atWork(words, doing) {
    if (doing === 'thinking') return 'Thinking it through…';
    const w = String(words || '').trim();
    const file = /^(?:Editing|Writing|Creating) (.+)$/.exec(w);
    if (file) {
      const f = file[1].split(/[\\/]/).pop();
      return (AT_WORK[f.split('.').pop().toLowerCase()] ?? 'Working on {f}.').replace('{f}', f);
    }
    const run = /^Running: (.+)$/.exec(w);
    if (run) {
      const what = run[1].replace(/\.$/, '');
      return RUNNING[Math.floor(Math.random() * RUNNING.length)].replace('{what}', what).replace('{low}', what.charAt(0).toLowerCase() + what.slice(1));
    }
    if (doing === 'researching') return 'Looking something up.';
    return null;
  }

  /** Seconds a thank-you wave lasts. */
  const WAVE_SECONDS = 3;
  /** A thank-you: they turn to face you and wave (once they stand still, if they are walking). */
  function thank(p, seconds = WAVE_SECONDS) {
    p.waveUntil = world.time + seconds;
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
    const filter = app()?.filterKey?.() ?? app()?.project ?? null;
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
      snag: p.state !== 'home' ? p.snag || null : null,
      event: p.state !== 'home' ? p.event || null : null,
      today: p.today || 0,
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
        // Waiting starts now (for the visit while waiting); a reply ends any visit under way.
        p.needsSince = world.time;
        p.visit = null;
        if (s.doing === 'needs' && p.row && !snap) say(p, 'A question for you!', 5);
        if (s.doing === 'typing' && p.row?.doing === 'needs' && !snap) say(p, 'Thanks, on it!', 3);
        if (s.doing === 'towel' && p.row && !snap) say(p, 'Off to the beach!', 4);
        if (p.row?.doing === 'towel' && s.doing !== 'towel' && !snap) say(p, 'Back to work!', 4);
      }
      p.idleSince = s.idleFor == null ? -Infinity : clock() - s.idleFor;
      const wasWords = p.row?.doingText;
      // A real snag in their thread (a step that ended in an error, or the AI saying it found a bug): a quip, out loud
      // and in the chat, at most one every 3 minutes each, and only for a snag of the last 2 minutes.
      const snagAt = s.snag?.at || '';
      const freshSnag = p.row && !snap && snagAt && snagAt !== p.row.snag?.at && nowMs - Date.parse(snagAt) < 120000;
      if (freshSnag) banter(p, { kind: s.snag.kind === 'bug' ? 'bug' : 'failed' });
      if (freshSnag && s.snag.run >= BIG_BUG) callCouncil(p);
      // Something measured in their thread: tests passed or failed, a commit or a push (a Friday or weekend push, and
      // failed tests on a Monday, have their own lines: officeBanter.dayKind), the same file edited again, a reply you stopped.
      const eventAt = s.event?.at || '';
      if (p.row && !snap && eventAt && eventAt !== p.row.event?.at && nowMs - Date.parse(eventAt) < 120000) {
        banter(p, window.officeBanter?.dayKind?.(s.event, eventAt) ?? s.event);
      }
      // Working late (11 pm to 5 am on this PC's clock): once a night each.
      const night = new Date(Date.now() - 5 * 3600e3).toDateString();
      const hour = new Date().getHours();
      if (p.row && !snap && s.doing === 'typing' && (hour >= 23 || hour < 5) && p.lateNight !== night) {
        p.lateNight = night;
        banter(p, { kind: 'late' });
      }
      p.row = s;
      // A new step in their work: a thought about it (at most one a minute each, so the list is not all work).
      if (s.doingText !== wasWords && clock() - (p.workThoughtAt ?? -Infinity) > 60) {
        const line = atWork(s.doingText, s.doing);
        if (line) { think(p, line, 'work'); p.workThoughtAt = clock(); }
      }
      p.look = L?.lookOf(s.id, s.look) ?? null;
      retarget(p, snap);
    }
    world.pairAt = world.pairAt || {};
    for (const d of world.desks) {
      const busy = d.crew.map((id) => world.people.get(id)).filter((o) => o?.row?.doing === 'typing' && !o.leaving);
      if (busy.length < 2) continue;
      if (snap) { world.pairAt[d.key] ??= clock(); continue; }
      if (clock() - (world.pairAt[d.key] ?? -Infinity) > 1800) { world.pairAt[d.key] = clock(); banter(busy[0], { kind: 'pair' }); }
    }
    if (!snap) paydayChat();
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
    if (!calm()) stepDvd(dt);
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
        if (move(p, dt, (['desk', 'boardroom', 'needs', 'party', 'run'].includes(p.target?.area) ? HURRY : WALK) * (buzzing(p) ? ENERGY_PACE : 1))) arrived(p);
        continue;
      }
      if (p.target?.rest && world.time > p.restUntil) retarget(p);
    }
    stepEnergy();
    if (world.council && world.time > world.council.until) endCouncil();
    stepCourier(dt);
    stepTech(dt);
    stepFitter(dt);
    if (world.party && world.time > world.party.until) {
      world.party = null;
      for (const p of world.people.values()) if (p.target?.area === 'party') p.targetKey = '';
    }
    for (const [id, p] of world.people) if (p.leaving && p.out) world.people.delete(id);
  }

  // ---- Pizza, donuts, sandwiches, ice creams, cake and coffee: each order comes in by the front door with its own courier ----

  /** The couriers in the office now, each with their own order (several can be on the way at once). */
  const couriers = [];
  /** Orders waiting at the door: the next courier comes in a moment after the last, so they file in one by one. */
  const deliveries = [];
  /** Seconds between two couriers coming in at the door. */
  const COURIER_GAP = 2.5;
  let courierAt = -Infinity;
  let courierN = 0;
  /** An order of this kind is waiting at the door or being carried in (it is not on the table yet). */
  const onTheWay = (kind) => deliveries.some((d) => d.kind === kind) || couriers.some((k) => k.job.kind === kind && k.phase === 'coming');
  function orderFood(kind) {
    if (onTheWay(kind)) return false;
    deliveries.push({ kind });
    wake();
    return true;
  }
  /** Which of the foods on the table someone is having (each keeps to one while it is there). */
  function foodOf(p) {
    const t = world.table;
    return t.length ? t[(p.seed ?? 0) % t.length].kind : 'pizza';
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
  /** What someone says with a coffee and a bite in hand at the same time: a joke per food. */
  const COMBOS = {
    donuts: ['Dunking donuts! In it goes.', 'Coffee AND a donut? Time to dunk.', 'Dunk, sip, repeat.'],
    pizza: ['Pizza and coffee: breakfast of coders.', 'Espresso with extra cheese.', 'A slice and a sip. Living the dream.'],
    sandwiches: ['Lunch and a brew. Perfect.', 'Sandwich in one hand, coffee in the other. Who is typing?', 'Coffee to wash down the crusts.'],
    icecream: ['Hot coffee, cold ice cream. Balance.', 'An affogato, the office way.', 'Coffee and a cone. Why not.'],
    cake: ['Cake and coffee: a proper break.', 'A slice and a sip.', 'Coffee and cake. Nobody look at me.'],
  };
  const combo = (food, p) => (COMBOS[food] || COMBOS.pizza)[p.seed % 3];
  /** Hands the next one on the list theirs (a coffee, or a piece of the food), or walks to them; false once the list is done. */
  function handRound(k) {
    const at = nextStop(k.job);
    if (at && Math.hypot(at[0] - k.x, at[1] - k.y) > 40) {
      k.path = route(k.x, k.y, at[0], at[1]);
      return true;
    }
    const got = at ? world.people.get(k.job.who[k.job.at]) : null;
    if (got) {
      // A coffee and something to eat at once makes a joke of it (a donut gets dunked), instead of a plain thanks.
      const hasCoffee = got.coffee === 'have' && world.time < got.coffeeUntil;
      const hasFood = got.slice && world.time < got.sliceUntil ? got.slice : null;
      if (k.job.kind === 'coffee') {
        got.coffee = 'have';
        got.coffeeUntil = world.time + COFFEE_HELD;
        say(got, hasFood ? combo(hasFood, got) : ['Thanks for the coffee!', 'Flat white, perfect!', 'Just what I needed.'][got.seed % 3], 3);
      } else {
        got.slice = k.job.kind;
        got.sliceUntil = world.time + PIZZA_SECONDS;
        say(got, hasCoffee ? combo(k.job.kind, got) : FOOD[k.job.kind].cheer[got.seed % 3], 3);
      }
      thank(got);
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
    while (deliveries.length && world.time - courierAt >= COURIER_GAP) {
      const job = deliveries.shift();
      const at = dropOf(job);
      if (!at) continue;
      const food = FOOD[job.kind];
      const coffee = job.kind === 'coffee';
      const id = `courier:${++courierN}`;
      const look = L ? { ...L.fromId(id), top: food ? 'coral' : 'mint', headwear: 'cap', glasses: 'none' } : null;
      const k = { id, delivery: true, row: { name: food?.courier ?? 'Coffee delivery', doing: 'courier' }, job, x: GONE[0], y: GONE[1], face: 'east', look, seed: 5 + courierN, phase: 'coming', carry: food ? job.kind : coffee ? 'coffee' : null, bubble: '', bubbleUntil: 0, path: route(GONE[0], GONE[1], at[0], at[1]) };
      say(k, food?.called ?? 'Coffee delivery!', 3);
      couriers.push(k);
      courierAt = world.time;
    }
  }
  /** One courier's step; false once they have gone out of the door. */
  function stepOne(k, dt) {
    if (k.path.length && !move(k, dt, HURRY)) return true;
    if (k.phase === 'coming' && FOOD[k.job.kind]) {
      // The box goes on the kitchen table, beside any food already there: whoever has finished gathers round it and
      // waves a thank-you. Everyone still at work (they will not come to the table) is then brought a piece where
      // they are, so nobody misses out.
      const kind = k.job.kind;
      const on = world.table.find((f) => f.kind === kind);
      if (on) on.until = world.time + PIZZA_SECONDS;
      else world.table.push({ kind, until: world.time + PIZZA_SECONDS });
      world.tableAt = world.time;
      say(k, 'Enjoy!', 2);
      for (const p of world.people.values()) {
        if (p.row.doing !== 'resting' || p.out || p.leaving) continue;
        say(p, FOOD[kind].cheer[p.seed % 3], 3);
        // Already standing at the table: the wave comes now (the others wave when they get there).
        if (p.target?.pizza && !p.path.length) {
          p.thankedAt = world.tableAt;
          thank(p);
        }
      }
      k.job.who = [...world.people.values()].filter((p) => !p.out && !p.leaving && p.row.doing !== 'resting').map((p) => p.id);
      k.job.at = 0;
      k.phase = 'round';
    }
    if (k.phase === 'coming' || k.phase === 'round') {
      // One for each on the list, wherever they are (busy or not); someone who walked off meanwhile is followed.
      if (handRound(k)) return true;
      k.phase = 'leaving';
      k.carry = null;
      k.path = route(k.x, k.y, GONE[0], GONE[1]);
      return true;
    }
    return false;
  }
  function stepCourier(dt) {
    startCourier();
    for (let i = couriers.length - 1; i >= 0; i--) if (!stepOne(couriers[i], dt)) couriers.splice(i, 1);
    // Each food is cleared from the table when it is eaten; once the table is bare the gatherers go back.
    const had = world.table.length;
    world.table = world.table.filter((f) => world.time <= f.until);
    if (had && !world.table.length) for (const p of world.people.values()) if (p.target?.pizza) p.targetKey = '';
  }

  // ---- A room bought: the IT tech comes in to unlock it, then everyone free runs in to see it ----

  let tech = null;
  /** Seconds the staff stay to look round a room just opened. */
  const PARTY_SECONDS = 12;
  /** The corridor side of a room's door, where the tech stands to unlock it, and the way they face. */
  function doorOf(lock) {
    const i = ROOMS.findIndex((r) => r.lock === lock);
    const r = ROOMS[i];
    const edge = i % 2 === 0 ? r.x + r.w : r.x;
    return { x: edge + (i % 2 === 0 ? 26 : -26), y: i < 2 ? 190 : 610, face: i % 2 === 0 ? 'west' : 'east' };
  }
  function callTech(lock) {
    if (!world.unlocking.includes(lock)) world.unlocking.push(lock);
    // Already here for another room: this one is next (on the way out, the tech turns back for it).
    if (tech) {
      if (tech.phase === 'leaving') nextRoom(tech);
      return;
    }
    const d = doorOf(lock);
    const look = L ? { ...L.fromId('it-tech'), top: 'sky', headwear: 'none', glasses: 'none' } : null;
    tech = { id: 'tech', row: { name: 'IT tech', doing: 'courier' }, lock, x: GONE[0], y: GONE[1], face: 'east', look, seed: 7, phase: 'coming', bubble: '', bubbleUntil: 0, path: route(GONE[0], GONE[1], d.x, d.y) };
    say(tech, 'On my way to unlock it!', 3);
    wake();
  }
  function stepTech(dt) {
    const k = tech;
    if (!k) return;
    // Seen coming as the tech comes in by the front door (every room is indoors), or at the room's door at the latest.
    if (k.phase === 'coming' && nearDoor(k)) notice(k, roomSeen(k.lock));
    if (k.path.length && !move(k, dt, HURRY)) return;
    if (k.phase === 'coming') {
      notice(k, roomSeen(k.lock));
      k.phase = 'working';
      k.face = doorOf(k.lock).face;
      k.doneAt = world.time + 3;
      say(k, 'Unlocking…', 3);
      return;
    }
    if (k.phase === 'working') {
      if (world.time < k.doneAt) return;
      openRoom(k.lock);
      say(k, 'All yours!', 3);
      if (world.unlocking.length) nextRoom(k);
      else {
        k.phase = 'leaving';
        k.path = route(k.x, k.y, GONE[0], GONE[1]);
      }
      return;
    }
    tech = null;
  }
  /** The tech walks on to the next room bought, from wherever they are. */
  function nextRoom(k) {
    const d = doorOf(world.unlocking[0]);
    Object.assign(k, { lock: world.unlocking[0], phase: 'coming', noticed: false, path: route(k.x, k.y, d.x, d.y) });
    say(k, 'And the next one!', 3);
    wake();
  }
  /** The door opens: the lights come on, the way in is walkable, and everyone free runs in (the busy ones cheer). */
  function openRoom(lock) {
    world.unlocking = world.unlocking.filter((l) => l !== lock);
    background = null;
    regrid();
    world.party = { lock, until: world.time + PARTY_SECONDS };
    for (const v of views) { v.lockNote = null; v.told = ''; }
    for (const p of world.people.values()) {
      if (p.leaving || p.out) continue;
      p.targetKey = '';
      const free = p.row.doing === 'resting' || p.row.doing === 'needs';
      say(p, free ? ['Thanks, boss! A new room!', 'Wow, look at this!', 'Let\'s go see!'][p.seed % 3] : ['Ooh, a new room! Thanks, boss!', 'Nice! Save me a spot!', 'I\'ll look when I\'m done.'][p.seed % 3], 3);
      thank(p);
    }
  }

  // ---- Furniture bought: a fitter carries it in and sets it up; until then it is not in the room ----

  let fitter = null;
  /** The lounge's resting spots and the piece each needs (as src/shop.mjs roomsOf). */
  const SPOT_PIECE = { nap: 'armchair', library: 'bookcase', chat: 'sofa', tv: 'tv', treadmill: 'gym', weights: 'gym', arcade: 'arcade' };
  /** The rooms as the server has them, less the pieces still waiting for the fitter. */
  function lessFitting(rooms) {
    if (!world.fitting.length) return rooms;
    const r = structuredClone(rooms);
    for (const id of world.fitting) {
      if (id === 'chairs') r.boardroom.chairs = Math.max(0, r.boardroom.chairs - 2);
      else if (id in r.boardroom) r.boardroom[id] = false;
      else if (id in r.lounge) r.lounge[id] = false;
      else if (id === 'deckchair') r.deckchairs = Math.max(0, r.deckchairs - 1);
      else if (id === 'volleyball') r.volleyball = false;
      else if (id === 'flamingo') r.flamingo = false;
      else if (id === 'cactus') r.cactus = false;
      else if (id === 'ducks') r.ducks = false;
      else if (id === 'rocks') r.rocks = false;
      else if (id === 'trophy') r.trophy = null;
    }
    const has = (spot) => !SPOT_PIECE[spot] || r.lounge[SPOT_PIECE[spot]];
    r.rest = r.rest.filter(has);
    r.away = r.away.filter(has);
    if (!r.away.length) r.away = ['window'];
    return r;
  }
  /** Where the fitter stands to set a piece up (beside where it goes). */
  function fitSpot(id) {
    const spots = {
      table: [905, 300], chairs: [905, 300], whiteboard: [1090, 185], plants: [705, 85],
      armchair: [765, 660], bookcase: [735, 545], sofa: [1020, 645], tv: [1030, 575], gym: [860, 625], arcade: [1095, 540],
      ducks: [270, 140],
      rocks: [270, 140],
      cactus: [270, 140],
      clock: [905, 80],
      cooler: [705, 322],
      flamingo: [FLAMINGO.x - 40, 892],
      trophy: [TROPHY.x + TROPHY.w + 22, TROPHY.y + TROPHY.h / 2],
      deckchair: [(DECK[Math.min(world.rooms.deckchairs, DECK.length - 1)] ?? DECK[0])[0], 826], volleyball: [NET.x - 25, 866],
    };
    return spots[id] ?? [905, 610];
  }
  /** Beach gear: carried along the path outside to the sand, past the front door but never in by it. */
  const BEACH = new Set(['deckchair', 'volleyball', 'flamingo']);
  const nearDoor = (k) => Math.hypot(k.x - DOOR[0], k.y - DOOR[1]) < 60;
  /** The staff notice a worker once the worker is there to be seen, never at the moment of buying: a couple of them
   * (the same few each time) say a line each. Once per trip (`k.noticed`). */
  function notice(k, lines) {
    if (k.noticed) return;
    k.noticed = true;
    // The line turns with each worker seen, so two deliveries in a row are not met with the same words (the chat leaves
    // out the same words from the same person for a while).
    world.noticed = (world.noticed || 0) + 1;
    present().filter((p) => p.seed % 3 === 0).slice(0, 2).forEach((p, i) => say(p, lines[(p.seed + i + world.noticed) % lines.length], 3));
  }
  const BOX_SEEN = ['A delivery! What\'s in the box?', 'Is that for us?', 'Ooh, a box!'];
  const BOX_AGAIN = ['Another box!', 'There\'s more?'];
  const BEACH_SEEN = ['Something\'s going up on the beach!', 'What\'s that on the sand?', 'Beach delivery!'];
  const roomSeen = (lock) => [`A new ${lock === 'lounge' ? 'lounge' : 'meeting room'}? Can't wait to see it!`, 'Did the boss just buy a room?', 'Someone\'s unlocking a door!'];
  /** A piece of furniture bought: held out of the room until the fitter has set it up. */
  function callFitter(id) {
    world.fitting.push(id);
    // On the way out after the last piece: the fitter turns back for this one (else it would wait for ever).
    if (fitter?.phase === 'leaving') {
      const [x, y] = fitSpot(world.fitting[0]);
      Object.assign(fitter, { phase: 'coming', carry: 'parcel', noticed: false, trips: 0, path: route(fitter.x, fitter.y, x, y) });
      say(fitter, 'One more for you!', 3);
      wake();
    }
    if (fitter) return;
    const look = L ? { ...L.fromId('fitter'), top: 'mustard', headwear: 'cap', glasses: 'none' } : null;
    const [x, y] = fitSpot(id);
    fitter = { id: 'fitter', row: { name: 'Fitter', doing: 'courier' }, x: GONE[0], y: GONE[1], face: 'east', look, seed: 9, phase: 'coming', carry: 'parcel', bubble: '', bubbleUntil: 0, path: route(GONE[0], GONE[1], x, y) };
    say(fitter, 'Delivery for the office!', 3);
    wake();
  }
  function stepFitter(dt) {
    const k = fitter;
    if (!k) return;
    // Seen coming: indoors, as the fitter comes in by the front door; beach gear (or a second piece, carried from
    // inside), once the fitter is at the spot.
    const piece = world.fitting[0];
    const seen = BEACH.has(piece) ? BEACH_SEEN : k.trips ? BOX_AGAIN : BOX_SEEN;
    if (k.phase === 'coming' && !BEACH.has(piece) && !k.trips && nearDoor(k)) notice(k, seen);
    if (k.path.length && !move(k, dt, HURRY)) return;
    if (k.phase === 'coming') {
      notice(k, seen);
      k.phase = 'working';
      k.carry = null;
      k.doneAt = world.time + 3;
      say(k, 'Setting it up…', 3);
      return;
    }
    if (k.phase === 'working') {
      if (world.time < k.doneAt) return;
      // In place: the piece shows, and everyone cheers and waves a thank-you (whoever was resting tries it out).
      const piece = world.fitting.shift();
      applyRooms(lessFitting(world.serverRooms ?? world.rooms));
      // The free (and those waiting for you) go and try it out a while.
      world.tryOut = { piece, until: world.time + TRY_SECONDS };
      say(k, 'All set!', 2);
      // The first to see it names it ("Hey, we got new deck chairs!"); the rest thank you, each in their own words.
      const what = PIECE_WORDS[piece] || 'new furniture';
      // Each one in turn takes the next line, from a different starting line each time, so neighbours never repeat.
      const start = Math.floor(Math.random() * INSTALLED.length);
      [...world.people.values()].filter((p) => !p.leaving && !p.out).forEach((p, i) => {
        say(p, piece === 'trophy' ? TROPHY_CHEER[(start + i) % TROPHY_CHEER.length] : i === 0 ? `Hey, we got ${what}!` : INSTALLED[(start + i) % INSTALLED.length], 4);
        thank(p);
        if (p.target?.rest) p.restUntil = 0;
      });
      if (world.fitting.length) {
        const [x, y] = fitSpot(world.fitting[0]);
        k.phase = 'coming';
        k.noticed = false;
        k.trips = (k.trips || 0) + 1;
        k.carry = 'parcel';
        k.path = route(k.x, k.y, x, y);
      } else {
        k.phase = 'leaving';
        k.path = route(k.x, k.y, GONE[0], GONE[1]);
      }
      return;
    }
    fitter = null;
  }
  /** A piece of furniture in words, for the first cheer when it is set up. */
  const PIECE_WORDS = { table: 'a meeting room table', chairs: 'new chairs', whiteboard: 'a whiteboard', plants: 'plants', armchair: 'an armchair', bookcase: 'a bookcase',
    sofa: 'a sofa', tv: 'a TV', gym: 'a gym', arcade: 'an arcade machine', deckchair: 'new deck chairs', volleyball: 'a volleyball net', ducks: 'rubber ducks', rocks: 'pet rocks', cactus: 'desk cacti', clock: 'a wall clock', cooler: 'a water cooler', flamingo: 'an inflatable flamingo', trophy: 'a trophy case' };
  /** A piece's short name ("Trying the new deck chair"). */
  const PIECE_NAME = { table: 'table', chairs: 'chairs', whiteboard: 'whiteboard', plants: 'plants', armchair: 'armchair', bookcase: 'bookcase', sofa: 'sofa', tv: 'TV', gym: 'gym', arcade: 'arcade machine', deckchair: 'deck chair', volleyball: 'volleyball net', ducks: 'rubber ducks', rocks: 'pet rocks', cactus: 'desk cacti', clock: 'wall clock', cooler: 'water cooler', flamingo: 'flamingo', trophy: 'trophy case' };
  /** Everyone else, when a piece is set up. */
  /** Everyone, when the trophy case goes in. */
  const TROPHY_CHEER = ['World\'s best boss!', 'Speech! Speech!', 'You earned it, boss.', 'Best office ever.', 'Three cheers for the boss!'];
  const INSTALLED = ['Thanks, boss!', 'Nice!', 'Very smart!', 'I\'ll try it out soon.', 'Ooh, fancy.', 'Best boss ever.'];
  /** A cardboard box, carried in by the fitter. */
  function parcel(c, p) {
    const dx = p.face === 'west' ? -14 : p.face === 'east' ? 14 : 0;
    box(c, p.x + dx - 12, p.y - 6, 24, 18, 2, '#c99a62', INK, 1.5);
    line(c, p.x + dx - 12, p.y + 1, p.x + dx + 12, p.y + 1, '#a87a46', 2);
  }

  // ---- The shop's answer: the purse, the items, and what the rooms offer ----

  /** What the rooms have changed: the walls and furniture are drawn again, and everyone picks where to go afresh. */
  function applyRooms(rooms) {
    const key = JSON.stringify(rooms);
    if (key === world.roomsKey) return;
    world.rooms = rooms;
    world.roomsKey = key;
    world.blocks = blocksOf();
    background = null;
    regrid();
    for (const p of world.people.values()) if (!p.leaving) p.targetKey = '';
  }
  function officeData(shop) {
    world.purse = shop.purse ?? null;
    world.shop = shop.items ?? [];
    world.recent = Array.isArray(shop.recent) ? shop.recent : [];
    if (shop.rooms) {
      // The trophy case just earned (not on first load): the fitter carries it in like any piece.
      if (world.serverRooms && !world.serverRooms.trophy && shop.rooms.trophy) callFitter('trophy');
      world.serverRooms = shop.rooms;
    }
    applyRooms(world.serverRooms ? lessFitting(world.serverRooms) : world.rooms);
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
  /** Their rubber duck goes with them to a meeting (at the council it sits on the table). */
  const carriesDuck = (p) => world.rooms.ducks && p.target?.area === 'boardroom' && !p.carry && (!p.target.council || p.path.length > 0);
  function holding(p) {
    const items = [];
    const still = !p.path.length;
    if (carriesDuck(p)) items.push('their rubber duck');
    if (p.coffee === 'have' && world.time < p.coffeeUntil) items.push('a coffee (your treat)');
    if (buzzing(p)) items.push('an energy drink (your treat)');
    if (p.slice && world.time < p.sliceUntil) items.push(`${FOOD[p.slice].holding}, brought over (your treat)`);
    else if (p.target?.pizza && still) items.push(FOOD[foodOf(p)].holding);
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
    else if (p.target?.area === 'boardroom' && still && world.rooms.boardroom.cooler) items.push('a cup of water from the cooler');
    return items.length ? items.join(', ') : 'nothing';
  }
  function arrived(p) {
    p.face = p.target?.face ?? 'south';
    // At the kitchen table for food that came since they last said thanks: a wave to you first.
    if (!p.leaving && p.row?.doing !== 'typing') atEase(p);
    if (p.target?.pizza && p.thankedAt !== world.tableAt) {
      p.thankedAt = world.tableAt;
      thank(p);
    }
    if (p.targetKey === 'gone') p.out = true;
    if (world.rooms.rocks && p.target?.area === 'desk' && !p.leaving && (p.target.desk?.crew.length ?? 1) <= 1 && clock() - (p.rockAt ?? -Infinity) > 600) {
      p.rockAt = clock();
      const rock = friendName('rock', p.target.desk?.key ?? '', Number(String(p.targetKey).split(':').pop()) || 0);
      think(p, ROCK_LINES[(p.seed + (world.rockLines = (world.rockLines || 0) + 1)) % ROCK_LINES.length].replaceAll('{rock}', rock));
    }
    if (p.target?.area === 'volley' && !p.volleyUntil) p.volleyUntil = world.time + VOLLEY_GAME + Math.random() * VOLLEY_GAME;
  }

  /** "Walking to the meeting room", or what they are doing there. */
  function wordsOf(p) {
    const s = p.row;
    const t = p.target;
    if (t?.pizza) return p.path.length ? FOOD[foodOf(p)].going : FOOD[foodOf(p)].having;
    if (t?.council) return p.path.length ? 'Off to the council of ducks, duck in hand' : p.id === world.council?.id ? 'Explaining the bug to the council of ducks' : 'Sitting on the council of ducks';
    if (t?.helping) {
      const lead = thinkersNow()[0]?.name ?? 'someone';
      return p.path.length ? `Off to the meeting room to help ${lead} think` : `Helping ${lead} think`;
    }
    if (t?.area === 'run') return s.doing === 'needs' ? `Needs you: ${s.doingText} (dashing about on an energy drink)` : 'On an energy drink: dashing about the office';
    const thinkHere = s.doing === 'thinking' && !world.rooms.boardroom.table;
    if (p.path.length && !p.out) {
      if (t?.waiting) return `Off to try ${t.visit} while waiting for you`;
      if (t?.trying) return t.trying === 'trophy' ? 'Off to admire the trophy case' : `Off to try the new ${PIECE_NAME[t.trying] || 'furniture'}`;
      if (t?.area === 'needs' && p.from && p.from !== 'needs' && p.from !== 'desk') return 'Back to the desk: still waiting for you';
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
    if (s.doing === 'needs') return `Needs you: ${s.doingText}${t?.waiting ? ` (trying ${t.visit} while waiting)` : t?.trying ? ` (trying the new ${PIECE_NAME[t.trying] || 'furniture'} while waiting)` : ''}`;
    if (t?.trying && t.area !== 'volley') return `Trying the new ${PIECE_NAME[t.trying] || 'furniture'}`;
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
    c.fillStyle = tone(fill);
    c.fill();
    if (stroke) { c.strokeStyle = tone(stroke); c.lineWidth = width; c.stroke(); }
  }
  function oval(c, x, y, rx, ry, fill, stroke = INK, width = 2) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { c.fillStyle = tone(fill); c.fill(); }
    if (stroke) { c.strokeStyle = tone(stroke); c.lineWidth = width; c.stroke(); }
  }
  function line(c, x, y, xx, yy, col = INK, width = 3) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(xx, yy);
    c.strokeStyle = tone(col);
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

  /** By night, soft pools of light down the hallways from ceiling lamps: an office keeps some lights on, not many. */
  function lamps(c) {
    const spots = [[600, 70], [600, 230], [600, 400], [600, 570], [600, 730], [130, 400], [330, 400], [870, 400], [1070, 400]];
    for (const [x, y] of spots) {
      const g = c.createRadialGradient(x, y, 4, x, y, 95);
      g.addColorStop(0, 'rgba(255, 228, 176, 0.20)');
      g.addColorStop(1, 'rgba(255, 228, 176, 0)');
      c.fillStyle = g;
      c.fillRect(x - 95, y - 95, 190, 190);
      oval(c, x, y, 3, 3, 'rgba(255, 236, 200, 0.85)', null);
    }
  }

  /** The rooms, the furniture and the desks: drawn once (and again when the desks change), then copied each frame. */
  function drawBackground() {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = tone('#cbd6df');
    c.fillRect(0, 0, W, H);
    if (night) lamps(c);
    ROOMS.forEach((r, i) => {
      box(c, r.x, r.y, r.w, r.h, 16, r.fill);
      const xx = i % 2 === 0 ? r.x + r.w : r.x;
      const dy = i < 2 ? 190 : 610;
      c.fillStyle = tone(r.fill);
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
    c.fillStyle = tone('#b9c9a4');
    c.fillRect(0, 786, W, 38);
    c.fillStyle = tone('#d9cfb8');
    c.fillRect(0, 797, W, 16);
    c.fillStyle = tone('#f2dfae');
    c.fillRect(0, 824, W, 82);
    c.fillStyle = tone('#7fc4e0');
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
    if (br.cooler) waterCooler(c, COOLER.x, COOLER.y);
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
      const t = PIECES.tv;
      box(c, t.x, t.y, t.w, t.h, 7, INK);
      box(c, t.x + 7, t.y + 7, t.w - 14, t.h - 14, 4, '#182638');
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
  /** A water cooler seen from above at (x, y) (its top-left corner): the stand, the big blue bottle, the two taps. */
  function waterCooler(c, x, y) {
    const { w, h } = COOLER;
    box(c, x, y, w, h, 5, '#e3e9ee');
    oval(c, x + w / 2, y + 16, 11, 11, '#9fd3ef', INK, 1.5);
    oval(c, x + w / 2, y + 16, 5, 5, '#d4eefa', null);
    box(c, x + 6, y + h - 10, 7, 6, 2, '#69bfe9', INK, 1);
    box(c, x + w - 13, y + h - 10, 7, 6, 2, '#ef8a91', INK, 1);
  }
  /** A clock face at (x, y), `r` across from the middle, its hands at the time given. */
  function wallClock(c, x, y, r, when) {
    oval(c, x, y, r, r, '#fffaf0', INK, Math.max(2, r / 7));
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      line(c, x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72, x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, INK, i % 3 ? r / 15 : r / 8);
    }
    const m = when.getMinutes() + when.getSeconds() / 60;
    const hour = (when.getHours() % 12) + m / 60;
    const hand = (turn, len, wide) => {
      const a = turn * Math.PI * 2 - Math.PI / 2;
      line(c, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, INK, wide);
    };
    hand(hour / 12, r * 0.48, r / 6);
    hand(m / 60, r * 0.7, r / 9);
    oval(c, x, y, r / 9, r / 9, '#ef8a91', null);
  }
  /** An inflatable flamingo floating at (x, y), seen from above: a pink ring with its neck and head. `s` times its sea size. */
  function flamingo(c, x, y, s = 1) {
    oval(c, x, y + 3 * s, 18 * s, 5 * s, 'rgba(255, 255, 255, 0.35)', null);
    oval(c, x, y, 14 * s, 9 * s, '#f59ab8', INK, 1.5 * s);
    oval(c, x, y, 6 * s, 3.5 * s, '#7fc4e0', INK, 1 * s);
    c.beginPath();
    c.moveTo(x + 9 * s, y - 4 * s);
    c.quadraticCurveTo(x + 20 * s, y - 12 * s, x + 13 * s, y - 20 * s);
    c.strokeStyle = tone(INK);
    c.lineWidth = 6.5 * s;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = '#f59ab8';
    c.lineWidth = 4 * s;
    c.stroke();
    oval(c, x + 13 * s, y - 21 * s, 4.5 * s, 3.8 * s, '#f59ab8', INK, 1.2 * s);
    line(c, x + 16 * s, y - 21 * s, x + 21 * s, y - 19 * s, INK, 2.2 * s);
    oval(c, x + 12.5 * s, y - 22.5 * s, 0.9 * s, 0.9 * s, INK, null);
  }
  /** A cactus in its pot, seen from above: the pot's rim, the ribbed cactus, a pink flower. `s` times its desk size. */
  function cactus(c, x, y, s = 1) {
    oval(c, x, y + 0.6 * s, 4.6 * s, 4.6 * s, '#c9774f', INK, Math.min(2, 1.1 * s));
    oval(c, x, y, 3.3 * s, 3.3 * s, '#5aa469', INK, Math.min(1.6, 0.9 * s));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      line(c, x, y, x + Math.cos(a) * 2.6 * s, y + Math.sin(a) * 2.6 * s, '#8fd294', 0.45 * s);
    }
    oval(c, x + 0.9 * s, y - 1.2 * s, 1.1 * s, 1.1 * s, '#ef8a91', null);
  }
  /** The TV's screen saver: a DVD logo bouncing round the screen, changing colour at each wall. It comes within a
   * whisker of a corner now and then, but never quite hits one: a bounce that would land in a corner is nudged aside. */
  const dvd = { x: 20, y: 6, vx: 13.1, vy: 7.3, col: 0 };
  const DVD_W = 26;
  const DVD_H = 12;
  function stepDvd(dt) {
    const t = PIECES.tv;
    const maxX = t.w - 14 - DVD_W;
    const maxY = t.h - 14 - DVD_H;
    dvd.x += dvd.vx * dt;
    dvd.y += dvd.vy * dt;
    const hitX = dvd.x <= 0 || dvd.x >= maxX;
    const hitY = dvd.y <= 0 || dvd.y >= maxY;
    if (hitX) {
      dvd.x = Math.max(0, Math.min(maxX, dvd.x));
      dvd.vx = -dvd.vx;
    }
    if (hitY) {
      dvd.y = Math.max(0, Math.min(maxY, dvd.y));
      dvd.vy = -dvd.vy;
    }
    if (hitX || hitY) {
      dvd.col = (dvd.col + 1) % PALETTE.length;
      // So close, yet never: a wall reached with the other wall under 1.5 away would be the corner, so it turns early.
      if (hitX && !hitY && Math.min(dvd.y, maxY - dvd.y) < 1.5) dvd.y = dvd.y < maxY / 2 ? 1.5 : maxY - 1.5;
      if (hitY && !hitX && Math.min(dvd.x, maxX - dvd.x) < 1.5) dvd.x = dvd.x < maxX / 2 ? 1.5 : maxX - 1.5;
      if (hitX && hitY) dvd.x = dvd.x < maxX / 2 ? 1.5 : maxX - 1.5;
    }
  }
  function drawDvd(c) {
    const t = PIECES.tv;
    const x = t.x + 7 + dvd.x;
    const y = t.y + 7 + dvd.y;
    const col = PALETTE[dvd.col];
    oval(c, x + DVD_W / 2, y + DVD_H - 2.2, DVD_W / 2 - 1, 2, col, null);
    c.font = 'italic 900 9px Segoe UI, system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillStyle = col;
    c.fillText('DVD', x + DVD_W / 2, y + 7.5);
    c.textAlign = 'left';
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
    return ROOMS.filter((r) => !lockedRoom(r) && ((r.name === 'Meeting room' && !b.table && !b.chairs && !b.whiteboard && !b.plants && !b.clock && !b.cooler) || (r.name === 'Lounge and library' && !l.armchair && !l.bookcase && !l.sofa && !l.tv && !l.gym && !l.arcade)));
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
  /** A desk's rubber ducks and pet rocks: one of each per seat (once bought), on top of its computer, the rock on the
   * left and the duck on the right; the duck is away while its owner is in a meeting. Each has a name of its own, kept
   * by the desk and seat, shown when the pointer is on it. */
  const DUCK_NAMES = ['Sir Quacks-a-lot', 'Quackers', 'Duckworth', 'Captain Quack', 'Puddles', 'Professor Paddles', 'Waddles', 'Bill'];
  const ROCK_NAMES = ['Rocky', 'Pebbles', 'Dwayne', 'Sandy', 'Boulder', 'Rockefeller', 'Stoney', 'Flint'];
  const CACTUS_NAMES = ['Spike', 'Prickles', 'Needles', 'Sir Pokes-a-lot', 'Thorny', 'Spud', 'Pointy Pete', 'Captain Ouch'];
  const friendName = (kind, deskKey, i) => ({ duck: DUCK_NAMES, rock: ROCK_NAMES, cactus: CACTUS_NAMES })[kind][hash(`${kind}:${deskKey}:${i}`) % 8];
  const FRIEND_WORDS = { duck: 'Rubber duck', rock: 'Pet rock', cactus: 'Desk cactus' };
  const FRIEND_SIZE = 1;
  /** The cactus sits by itself on the computer tower, a little bigger so it reads as a plant. */
  const CACTUS_SIZE = 1.45;
  function friendsOf(d) {
    const n = d.seats.length;
    const mw = n === 1 ? 40 : n === 2 ? 36 : 26;
    const out = [];
    d.seats.forEach((off, i) => {
      const x = d.x + off;
      const who = world.people.get(d.crew[i]);
      if (world.rooms.rocks) out.push({ kind: 'rock', x: x - mw / 2 + 5, y: d.y - 19, i, who, name: friendName('rock', d.key, i) });
      if (world.rooms.ducks && who?.target?.area !== 'boardroom') out.push({ kind: 'duck', x: x + mw / 2 - 5, y: d.y - 20, i, who, name: friendName('duck', d.key, i) });
    });
    // The desk's cactus: one per desk, on top of its computer tower.
    if (world.rooms.cactus) out.push({ kind: 'cactus', x: d.x + d.w / 2 - 6.5, y: d.y + 8, i: 0, who: null, desk: d.name, name: friendName('cactus', d.key, 0) });
    return out;
  }
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
      for (const fr of friendsOf(d)) (fr.kind === 'duck' ? duck(c, fr.x, fr.y, FRIEND_SIZE, 'west') : fr.kind === 'cactus' ? cactus(c, fr.x, fr.y, CACTUS_SIZE) : petRock(c, fr.x, fr.y, FRIEND_SIZE));
      // The project's name above its computer, unless Project on screens is unticked (to see the staff better).
      if (full && app()?.showPcName !== false) {
        const size = labelSize(c) * 0.85;
        const words = fitText(c, d.name, 150, size);
        c.font = `600 ${size}px Segoe UI, system-ui, sans-serif`;
        const w = c.measureText(words).width + size;
        box(c, d.x - w / 2, d.y - 24 - size * 1.25, w, size * 1.35, 5, night ? '#2b3646' : '#ffffff', '#9eb3c8', 1.5);
        text(c, words, d.x, d.y - 24 - size * 0.25, size, floorInk(), 'center');
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
    box(c, p.x + dx - 22, p.y + dy - 10, 44, 20, 4, { donuts: '#ffe3ef', sandwiches: '#f6f1e6', icecream: '#bfe6f2', cake: '#fff2f6' }[kind] ?? '#fff2d8', INK, 2);
    if (kind === 'donuts') for (let i = 0; i < 3; i++) donut(c, p.x + dx - 12 + i * 12, p.y + dy, 4.5, PALETTE[i + 1]);
    else if (kind === 'sandwiches') for (let i = 0; i < 3; i++) sandwich(c, p.x + dx - 12 + i * 12, p.y + dy, 5);
    else if (kind === 'icecream') for (let i = 0; i < 3; i++) oval(c, p.x + dx - 12 + i * 12, p.y + dy, 4.5, 4.5, SCOOPS[i], INK, 1);
    else if (kind === 'cake') oval(c, p.x + dx, p.y + dy, 12, 7, '#f7d6e0', INK, 1.2);
    else oval(c, p.x + dx, p.y + dy, 12, 6, '#e6a64c', null);
  }
  /** Ice cream flavours: vanilla, strawberry, chocolate, mint. */
  const SCOOPS = ['#fff1d6', '#ef8a91', '#8a5a3c', '#a5e0ad'];
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
  /** The trophy case: wood, glass, a gold cup and a plaque. */
  function trophyCase(c) {
    const { x, y, w, h } = TROPHY;
    box(c, x, y, w, h, 4, '#9a6a3c', INK, 2);
    box(c, x + 5, y + 5, w - 10, h - 22, 3, '#dfeef5', INK, 1.2);
    oval(c, x + w / 2, y + 22, 9, 8, '#f2c230', INK, 1.4);
    box(c, x + w / 2 - 2, y + 29, 4, 8, 1, '#e0ad1c', INK, 1);
    box(c, x + w / 2 - 8, y + 37, 16, 4, 1, '#e0ad1c', INK, 1);
    oval(c, x + w / 2 - 10, y + 20, 3, 5, null, '#e0ad1c', 1.6);
    oval(c, x + w / 2 + 10, y + 20, 3, 5, null, '#e0ad1c', 1.6);
    box(c, x + 8, y + h - 14, w - 16, 8, 2, '#f2c230', INK, 1);
  }
  /** A pet rock at (x, y): a grey pebble with two googly eyes. `s` times the size of one on a desk. */
  function petRock(c, x, y, s = 1) {
    oval(c, x, y, 5.5 * s, 3.8 * s, '#9aa1a8', INK, 1.2);
    for (const dx of [-1.8, 1.8]) {
      oval(c, x + dx * s, y - 1 * s, 1.5 * s, 1.5 * s, '#ffffff', INK, 0.8);
      oval(c, x + dx * s + 0.4 * s, y - 0.8 * s, 0.6 * s, 0.6 * s, INK, null);
    }
  }
  /** A rubber duck at (x, y), `s` times the size of one on a desk, looking east or west. */
  function duck(c, x, y, s = 1, face = 'east') {
    const d = face === 'west' ? -1 : 1;
    oval(c, x, y, 6 * s, 4.2 * s, '#ffd23f', INK, 1.2);
    oval(c, x + d * 3.6 * s, y - 4.4 * s, 3.2 * s, 3 * s, '#ffd23f', INK, 1.2);
    c.beginPath();
    c.moveTo(x + d * 6.4 * s, y - 5 * s);
    c.lineTo(x + d * 9.4 * s, y - 4 * s);
    c.lineTo(x + d * 6.4 * s, y - 3 * s);
    c.closePath();
    c.fillStyle = tone('#f08a24');
    c.fill();
    oval(c, x + d * 4.4 * s, y - 5.2 * s, 0.7 * s, 0.7 * s, INK, null);
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
  /** An energy drink can: black, with a green band and a lightning flash. */
  function energyHeld(c, p) {
    const dx = p.face === 'west' ? -15 : 15;
    box(c, p.x + dx - 4, p.y - 7, 8, 13, 2, '#1d2330', INK, 1.4);
    box(c, p.x + dx - 4, p.y - 3, 8, 4, 0, '#7be36b', null);
    line(c, p.x + dx + 1, p.y - 6, p.x + dx - 1, p.y - 1, '#f7cd50', 1.4);
  }
  /** A piece brought to someone at work, in the other hand from a coffee: a pizza slice, a donut, a sandwich, a cone or a slice of cake. */
  function sliceHeld(c, p, kind) {
    const dx = p.face === 'west' ? 15 : -15;
    if (kind === 'donuts') { donut(c, p.x + dx, p.y - 2, 5, PALETTE[p.seed % 6]); return; }
    if (kind === 'sandwiches') { sandwich(c, p.x + dx, p.y - 2, 6); return; }
    if (kind === 'icecream' || kind === 'cake') {
      // A cone with its scoop on top, or a wedge of cake with a cherry.
      c.beginPath();
      if (kind === 'icecream') {
        c.moveTo(p.x + dx - 4, p.y - 4);
        c.lineTo(p.x + dx + 4, p.y - 4);
        c.lineTo(p.x + dx, p.y + 6);
      } else {
        c.moveTo(p.x + dx - 6, p.y - 7);
        c.lineTo(p.x + dx + 6, p.y - 7);
        c.lineTo(p.x + dx, p.y + 4);
      }
      c.closePath();
      c.fillStyle = kind === 'icecream' ? '#e9b872' : '#f7d6e0';
      c.fill();
      c.strokeStyle = tone(INK);
      c.lineWidth = 1.3;
      c.stroke();
      if (kind === 'icecream') oval(c, p.x + dx, p.y - 6, 4.5, 4, SCOOPS[p.seed % SCOOPS.length], INK, 1.2);
      else oval(c, p.x + dx, p.y - 4, 1.8, 1.8, '#dc3f4f', null);
      return;
    }
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
    const list = [...world.people.values(), ...couriers, ...(tech ? [tech] : []), ...(fitter ? [fitter] : [])].filter((p) => !p.out || p.path.length).sort((a, b) => a.y - b.y);
    const size = labelSize(c);
    for (const p of list) {
      const walk = p.path.length > 0 && !calm();
      // On an energy drink: buzzing on the spot (not when less motion is asked for), and legs going three times as fast.
      const buzz = buzzing(p) && !calm();
      const y = p.y - (buzz && !p.path.length ? Math.abs(Math.sin(world.time * 22 + p.seed)) * 2.5 : 0);
      if (world.selected === p.id) oval(c, p.x, p.y + 12, 22, 11, '#f8d878', null);
      const look = p.look ?? (L ? L.fromId(p.id) : null);
      if (look && !walk && p.waveUntil > world.time) {
        // A thank-you for a treat: turned to face you, waving.
        L.sprite(c, look, p.x, y, 'south', { time: world.time, seed: p.seed % 10, wave: true });
      } else if (look && !walk && p.target?.area === 'party' && !calm()) {
        // In a room just opened: jumping, and every other one spinning round as they jump.
        const spin = ['south', 'east', 'north', 'west'][Math.floor(world.time * 4 + p.seed) % 4];
        L.sprite(c, look, p.x, y - Math.abs(Math.sin(world.time * 7 + p.seed)) * 12, p.seed % 2 ? spin : 'south', { walk: true, time: world.time, seed: p.seed % 10 });
      } else if (look && !walk && !calm() && (p.target?.area === 'stretch' || p.target?.area === 'volley' || p.target?.rest?.gym)) {
        // On the spot: stretching, on the gym kit, or on their toes at the volleyball net (facing the other side).
        L.sprite(c, look, p.x, y - Math.abs(Math.sin(world.time * 5 + p.seed)) * 6, p.target?.area === 'volley' ? p.face : 'south', { walk: true, time: world.time, seed: p.seed % 10 });
      } else if (look) L.sprite(c, look, p.x, y, p.face, { walk, time: buzz ? world.time * ENERGY_PACE : world.time, seed: p.seed % 10 });
      else oval(c, p.x, y, 14, 18, PALETTE[p.seed % 6]);
      if (p.carry === 'coffee') coffeeTray(c, { ...p, y });
      else if (FOOD[p.carry]) pizzaBox(c, { ...p, y }, p.carry);
      else if (p.carry === 'parcel') parcel(c, { ...p, y });
      else if (p.coffee === 'have' && world.time < p.coffeeUntil) coffeeHeld(c, { ...p, y });
      else if (buzzing(p)) energyHeld(c, { ...p, y });
      else if (breakOf(p) && !walk) drinkHeld(c, { ...p, y });
      if (p.slice && world.time < p.sliceUntil && !p.carry) sliceHeld(c, { ...p, y }, p.slice);
      else if (carriesDuck(p)) duck(c, p.x + (p.face === 'west' ? 15 : -15), y - 2, 0.8, p.face === 'west' ? 'west' : 'east');
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
      if (full && !p.delivery && app()?.showNames !== false) {
        const seats = p.target?.desk?.seats.length ?? 1;
        // On a towel the rows are staggered: a name is cut to its own towel's width.
        const max = p.target?.area === 'desk' || p.target?.area === 'needs' ? Math.max(48, 150 / seats) : p.target?.area === 'towel' ? 80 : 140;
        text(c, fitText(c, p.row.name, max, size * 0.85), p.x, y + 28, size * 0.85, floorInk(), 'center');
      } else if (full && p.delivery && walk) text(c, p.row.name, p.x, y + 32, size * 0.92, night ? '#aab6c4' : '#56677b', 'center');
    }
  }

  // ---- The view ----

  /** The strip's width beside the office, and the room kept for it (three thoughts) when it sits under the office. */
  const STRIP_W = 240;
  const STRIP_UNDER = 200;
  const NARROW = window.matchMedia('(max-width: 700px)');

  function fit(view) {
    const cv = view.canvas;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    // The whole office in sight, never taller than the window, centred in its column.
    const box = cv.parentElement;
    const top = box.getBoundingClientRect().top + window.scrollY;
    // Everything under the canvas (the strip, the paddings) is measured, not guessed, so the office never pushes the
    // page past the bottom of the window: that would be a second scroll bar.
    const middle = box.closest('.middle');
    const layout = middle?.parentElement;
    let room;
    const mcss = middle && getComputedStyle(middle);
    if (mcss && mcss.overflowY !== 'visible') {
      // A wide window: the middle column scrolls on its own, so the office fits the column's own height (less what sits
      // above it inside the column and the padding under the office's section), not the window's.
      const section = box.closest('section') || box;
      const contentTop = cv.getBoundingClientRect().top - middle.getBoundingClientRect().top - (parseFloat(mcss.borderTopWidth) || 0) + middle.scrollTop;
      const under = Math.max(0, section.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom);
      room = Math.max(260, Math.floor(middle.clientHeight - (parseFloat(mcss.paddingBottom) || 0) - contentTop - under - 1));
    } else {
      const below = middle
        ? middle.getBoundingClientRect().bottom - cv.getBoundingClientRect().bottom + (layout ? parseFloat(getComputedStyle(layout).paddingBottom) || 0 : 0)
        : 90;
      room = Math.max(260, window.innerHeight - top - Math.ceil(below) - 1);
    }
    // A wide panel where the strip beside the office would leave it small (held by the width, with room to spare
    // below): the strip goes under the office instead, so the office fills the panel (X-08).
    if (view.strip && !NARROW.matches) {
      const bcss = getComputedStyle(box);
      const gap = parseFloat(bcss.columnGap) || 14;
      // Under the office already: what the strip really takes (its thoughts can wrap), else a fair guess.
      const strip = box.classList.contains('office-stacked') ? view.strip.offsetHeight + (parseFloat(bcss.rowGap) || 0) + (parseFloat(getComputedStyle(view.strip).marginTop) || 0) : 0;
      const keep = Math.max(STRIP_UNDER, strip);
      const besideW = Math.min(box.clientWidth - STRIP_W - gap, (room * W) / H);
      const underW = Math.min(box.clientWidth, ((room - keep) * W) / H);
      const stack = underW > besideW * 1.15;
      box.classList.toggle('office-stacked', stack);
      if (stack) room -= keep;
    } else box.classList.remove('office-stacked');
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
    if (full) for (const r of emptyRooms()) text(c, 'Empty: furnish it from Staff rewards (right panel)', r.x + r.w / 2, r.y + r.h / 2 + 30, labelSize(c) * 0.9, floorSoft(), 'center');
    // A locked room: a big padlock in the middle, and what opens it (always drawn: the padlock says it at any size).
    for (const r of ROOMS.filter(lockedRoom)) {
      padlock(c, r.x + r.w / 2, r.y + r.h / 2 - 22, 2.6, '#c9d3dc');
      const key = world.shop.find((i) => i.unlocks === r.lock);
      if (full) text(c, world.unlocking.includes(r.lock) ? 'Bought: the IT tech is on the way to unlock it' : `Locked: click to unlock${key ? ` (${big(key.price)} tokens)` : ''}`, r.x + r.w / 2, r.y + r.h / 2 + 50, labelSize(c) * 0.9, '#e8eef4', 'center');
    }
    if (full && !world.people.size) text(c, 'Nobody in yet: start a thread in Claude and they come in.', 290, 200, labelSize(c), floorSoft(), 'center');
    drawDesks(c, full);
    if (world.rooms.trophy) trophyCase(c);
    if (councilOn()) {
      const n = Math.max(5, councilList().length);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        duck(c, 905 + Math.cos(a) * 95, 197 + Math.sin(a) * 30, 1.3, Math.cos(a) > 0 ? 'west' : 'east');
      }
    }
    for (const p of world.people.values()) if (p.target?.area === 'towel' && !p.path.length && !p.leaving) towel(c, p.target.x, p.target.y, p.seed);
    // The food on the kitchen table: one box in the middle, or two or three side by side (smaller, to fit the table).
    const SPOTS = [[[305, 1]], [[268, 0.9], [342, 0.9]], [[257, 0.66], [305, 0.66], [353, 0.66]]][Math.min(world.table.length, 3) - 1] ?? [];
    world.table.slice(0, 3).forEach((f, i) => {
      const [cx, s] = SPOTS[i];
      c.save();
      c.translate(cx, 622);
      c.scale(s, s);
      c.translate(-303, -622);
      if (f.kind === 'donuts') {
        box(c, 268, 603, 70, 38, 4, '#ffe3ef', INK, 2);
        for (let j = 0; j < 6; j++) donut(c, 281 + (j % 3) * 22, 613 + Math.floor(j / 3) * 18, 7, PALETTE[j % 6]);
      } else if (f.kind === 'sandwiches') {
        box(c, 262, 603, 82, 38, 6, '#f6f1e6', INK, 2);
        for (let j = 0; j < 4; j++) sandwich(c, 277 + j * 18, 623, 8);
      } else if (f.kind === 'icecream') {
        box(c, 264, 603, 78, 38, 6, '#bfe6f2', INK, 2);
        for (let j = 0; j < 5; j++) oval(c, 279 + j * 12, 622 + (j % 2 ? 6 : -5), 6, 6, SCOOPS[j % SCOOPS.length], INK, 1.2);
      } else if (f.kind === 'cake') {
        oval(c, 303, 622, 31, 17, '#f6f1e6', INK, 2);
        oval(c, 303, 621, 24, 13, '#f7d6e0', INK, 2);
        for (let j = 0; j < 3; j++) {
          box(c, 292 + j * 10, 614, 3, 8, 1, PALETTE[j], INK, 1);
          oval(c, 293.5 + j * 10, 611, 2, 3, '#f7cd50', null);
        }
      } else {
        box(c, 268, 603, 70, 38, 4, '#fff6e4', INK, 2);
        oval(c, 303, 622, 26, 14, '#f2bc66');
        for (let j = 0; j < 6; j++) oval(c, 285 + j * 7, 618 + (j % 2) * 7, 3, 3, '#dc776e', null);
      }
      c.restore();
    });
    // The wall clock keeps the real time; the flamingo bobs on the sea (it stays put when less motion is asked for).
    if (world.rooms.boardroom.clock && !lockedRoom(ROOMS[1])) wallClock(c, CLOCK.x, CLOCK.y, CLOCK.r, new Date());
    if (world.rooms.flamingo) flamingo(c, FLAMINGO.x + (calm() ? 0 : 40 * Math.sin(world.time / 23)), FLAMINGO.y + (calm() ? 0 : 1.5 * Math.sin(world.time * 1.6)));
    if (world.rooms.lounge.tv && !lockedRoom(ROOMS[3])) drawDvd(c);
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

  /** The strip beside the office: the person picked and what they do there, or the staff's latest thoughts. */
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
    // Nobody picked: the latest thoughts (drawn again when one is added, and each minute for the "ago").
    const key = p ? `${p.id}|${wordsOf(p)}|${holding(p)}|${p.row.name}` : `all|${world.people.size}|${world.thoughts.at(-1)?.at}|${Math.floor(Date.now() / 60000)}|${app()?.filterKey?.()}|${chatMode()}`;
    if (key === v.told) return;
    v.told = key;
    if (p) {
      v.strip.replaceChildren(
        el('b', { text: p.row.name }), el('span', { class: 'note', text: ` · ${p.row.pcId || 'Consultants'}` }), el('br'),
        el('span', { text: wordsOf(p) }), el('br'),
        el('span', { class: 'note', text: `Holding: ${holding(p)}` }));
      return;
    }
    if (!world.people.size) return v.strip.replaceChildren(el('span', { class: 'note', text: 'Nobody in the office yet.' }));
    const ago = (at) => { const m = Math.floor((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`; };
    // Only the people Filter by shows; the newest message at the bottom, each with its writer's small head on the left.
    const shownIn = (f) => app()?.inFilter?.(f) ?? true;
    const head = (t) => {
      const pic = L?.portrait?.({ key: t.id, name: t.who, look: t.look }, 26);
      return el('span', { class: 'chat-head', 'aria-hidden': 'true' }, pic || t.who.charAt(0).toUpperCase());
    };
    // The same words from several people within 10 minutes (three "Thinking it through…") show once, at the newest,
    // under all their names.
    const folded = [];
    for (const t of world.thoughts.filter((x) => shownIn(x.folder))) {
      const i = folded.findIndex((x) => x.text === t.text && t.at - x.at < 600000);
      const names = i < 0 ? [] : folded.splice(i, 1)[0].names.filter((n) => n !== t.who);
      folded.push({ ...t, names: [...names, t.who] });
    }
    const whoAll = (n) => (n.length < 2 ? n[0] : n.length > 3 ? `${n.length} people` : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
    const list = folded.slice(-THOUGHTS_SHOWN).map((t) => el('li', { class: `chat-msg${Date.now() - t.at < 1500 ? ' new' : ''}` }, head(t),
      el('div', { class: 'chat-body' }, el('div', {}, el('b', { text: whoAll(t.names), title: t.names.join(', ') }), el('span', { class: 'note', text: ` ${ago(t.at)}` })), el('div', { text: t.text }))));
    const off = chatMode() === 'off';
    v.strip.replaceChildren(el('b', { text: 'Thoughts' }),
      off ? el('p', { class: 'note', text: 'The chat is off. Turn it on in Setup.' })
        : list.length ? el('ul', { class: 'thoughts' }, ...list) : el('p', { class: 'note', text: 'Quiet for now: what they say and think shows here.' }),
      el('span', { class: 'note', text: 'Click a person for details.' }));
  }

  // ---- Pointer: press a person to pick them; press a desk to show only that project ----

  function at(view, e) {
    const r = view.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }
  const personAt = (x, y) => [...world.people.values()].filter((p) => !p.out).sort((a, b) => b.y - a.y).find((p) => Math.hypot(p.x - x, p.y - 10 - y) < 28);
  /** A duck, rock or cactus under the pointer, or null. */
  const friendUnder = (x, y) => world.desks.flatMap(friendsOf).find((fr) => Math.hypot(fr.x - x, fr.y - 3 - y) < 9) ?? null;
  /** The arcade machine under the pointer, once it is in the lounge (click it to play). */
  /** The vending machine under the pointer (the kitchen is never locked). */
  const vendingUnder = (x, y) => x > VENDING.x - 4 && x < VENDING.x + VENDING.w + 4 && y > VENDING.y - 4 && y < VENDING.y + VENDING.h + 4;
  const arcadeUnder = (x, y) => { const a = PIECES.arcade; return !!world.rooms.lounge.arcade && !lockedRoom(ROOMS[3]) && x > a.x - 4 && x < a.x + a.w + 4 && y > a.y - 4 && y < a.y + a.h + 4; };
  const trophyUnder = (x, y) => !!world.rooms.trophy && x > TROPHY.x - 4 && x < TROPHY.x + TROPHY.w + 4 && y > TROPHY.y - 4 && y < TROPHY.y + TROPHY.h + 4;
  const deskUnder = (x, y) => world.desks.find((d) => x > d.x - d.w / 2 - 6 && x < d.x + d.w / 2 + 6 && y > d.y - 45 && y < d.y + 20);
  /** A locked room under the pointer: the room itself, or its padlocked door on the corridor side. */
  const lockedUnder = (x, y) => ROOMS.filter((r) => lockedRoom(r) && !world.unlocking.includes(r.lock)).find((r) => x > r.x - 40 && x < r.x + r.w && y > r.y && y < r.y + r.h);

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

  /** The trophy case clicked: its plaque, under the office. */
  function showTrophy(view) {
    const t = world.rooms.trophy;
    if (!t) return;
    const day = new Date(t.at).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
    view.lockNote = { key: `trophy:${t.at}`, until: clock() + 20, parts: [el('b', { text: '🏆 World\'s Best Boss' }), el('br'), el('span', { text: `Earned ${day}.` }), el('br'),
      el('span', { class: 'note', text: 'Every room unlocked, every piece bought, and the team looked after.' })] };
    view.told = '';
    world.selected = null;
    tell(view);
  }
  function hookPointer(view) {
    const cv = view.canvas;
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = at(view, e);
      cv.style.cursor = personAt(x, y) || deskUnder(x, y) || lockedUnder(x, y) || trophyUnder(x, y) || arcadeUnder(x, y) || vendingUnder(x, y) ? 'pointer' : '';
      // A duck, a pet rock or a cactus: its name, and whose desk it sits on.
      const fr = !personAt(x, y) && friendUnder(x, y);
      const tip = trophyUnder(x, y) ? 'Trophy case: World\'s Best Boss (click to read it)' : !personAt(x, y) && arcadeUnder(x, y) ? 'Arcade machine: click to play' : !personAt(x, y) && vendingUnder(x, y) ? 'Vending machine: energy drinks for the team (a 1M-token coin)' : fr ? `${FRIEND_WORDS[fr.kind]}: ${fr.name}${fr.who?.row?.name ? ` (${fr.who.row.name}'s)` : fr.desk ? ` (on the ${fr.desk} desk)` : ''}` : '';
      if (cv.title !== tip) cv.title = tip;
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
      if (trophyUnder(x, y)) return showTrophy(view);
      if (arcadeUnder(x, y)) return app()?.arcade?.open();
      if (vendingUnder(x, y)) return openVending();
      const d = deskUnder(x, y);
      if (d) return app()?.pickProject?.(d.key);
      const r = lockedUnder(x, y);
      if (r) askUnlock(view, r);
    });
  }

  function addView(holder) {
    const canvas = el('canvas', { class: 'office-canvas', role: 'img', 'aria-label': 'The office: each Claude thread as a little person at their project\'s desk while it works, standing with a question mark when it needs you, in the meeting room when it thinks a long time (once it has a table), in the kitchen, the lounge or a deck chair when it has finished, and on a beach towel once a favourite has gone home. A locked room is dark: click it to unlock it. The List tab says the same in words.' });
    const strip = el('div', { class: 'office-strip', 'aria-live': 'off' });
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
    rocks: { label: 'Pet rocks', title: 'A pet rock with googly eyes on every desk. It never leaves, so whoever works alone always has a friend there' },
    ducks: { label: 'Rubber ducks', title: 'A rubber duck on every desk, to explain a problem to. They carry it to meetings, and a big bug (three snags in a quarter of an hour) calls the council of ducks to the meeting room table' },
    pizza: { label: 'Pizza', title: 'A pizza comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought a slice where they are (free)' },
    coffee: { label: 'Coffee', title: 'A coffee delivery comes in by the front door and hands each of them a coffee, wherever they are, busy or not' },
    donuts: { label: 'Donuts', title: 'A box of donuts comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought one where they are' },
    sandwiches: { label: 'Sandwiches', title: 'A platter of sandwiches comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought one where they are' },
    icecream: { label: 'Ice creams', title: 'A cool box of ice creams comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought a cone where they are' },
    cake: { label: 'Cake', title: 'A celebration cake comes to the kitchen table: whoever has finished gathers round it, and whoever is busy is brought a slice where they are' },
    cactus: { label: 'Desk cacti', title: 'A little cactus on every desk, on top of the computer. Each has a name: point at it to read it' },
    clock: { label: 'Wall clock', title: 'A clock on the meeting room wall that shows the real time' },
    cooler: { label: 'Water cooler', title: 'A water cooler in the meeting room corner: whoever is in a meeting has a cup of water to hand' },
    flamingo: { label: 'Flamingo', title: 'A pink inflatable flamingo bobbing on the sea' },
    arcade: { label: 'Arcade', title: 'An arcade machine for the lounge: staff who have finished play on it, and so can you: click it in the lounge for Tetris, Lunar Lander and Moon Rover' },
    volleyball: { label: 'Volleyball', title: 'A beach volleyball net on the sand: staff who have finished play together, two a side' },
    energy: { label: 'Energy drinks' },
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
    } else if (id === 'rocks') {
      petRock(c, 34, 46, 2.4);
      petRock(c, 66, 50, 2);
    } else if (id === 'ducks') {
      duck(c, 30, 50, 2, 'east');
      duck(c, 70, 50, 2, 'west');
      duck(c, 50, 34, 1.6, 'east');
    } else if (id === 'icecream') {
      for (const [x, k] of [[36, 1], [64, 2]]) {
        c.beginPath();
        c.moveTo(x - 10, 34);
        c.lineTo(x + 10, 34);
        c.lineTo(x, 68);
        c.closePath();
        c.fillStyle = '#e9b872';
        c.fill();
        c.strokeStyle = tone(INK);
        c.lineWidth = 2;
        c.stroke();
        line(c, x - 5, 42, x + 3, 54, '#c98f5a', 1.5);
        line(c, x + 5, 42, x - 3, 54, '#c98f5a', 1.5);
        oval(c, x, 28, 12, 11, SCOOPS[k], INK, 2);
      }
    } else if (id === 'cake') {
      line(c, 14, 64, 86, 64, INK, 3);
      box(c, 22, 34, 56, 28, 6, '#f7d6e0');
      box(c, 20, 30, 60, 9, 4, '#fff6f9', INK, 2);
      for (let i = 0; i < 3; i++) {
        box(c, 36 + i * 12, 16, 4, 14, 1, PALETTE[i], INK, 1.2);
        oval(c, 38 + i * 12, 12, 2.5, 4, '#f7cd50', null);
      }
    } else if (id === 'cactus') {
      cactus(c, 50, 38, 5.5);
    } else if (id === 'clock') {
      wallClock(c, 50, 38, 30, new Date(2026, 0, 1, 10, 10));
    } else if (id === 'cooler') {
      box(c, 36, 38, 28, 30, 4, '#e3e9ee');
      box(c, 38, 6, 24, 34, 9, '#9fd3ef');
      box(c, 40, 50, 6, 6, 2, '#69bfe9', INK, 1.2);
      box(c, 54, 50, 6, 6, 2, '#ef8a91', INK, 1.2);
    } else if (id === 'flamingo') {
      flamingo(c, 44, 52, 1.9);
    } else if (id === 'deckchair') {
      c.save();
      c.translate(36, 46);
      c.scale(0.8, 0.8);
      deckChair(c, 0, 0, 0);
      c.restore();
    }
  }
  /** The shop's sections: [title, [[room heading, item ids, the room's lock (if it has one)]]]. */
  const SECTIONS = [['Treat the team', [['', ['pizza', 'coffee', 'donuts', 'sandwiches', 'icecream', 'cake']]]], ['Improve the office', [['Desks', ['rocks', 'ducks', 'cactus']], ['Meeting room', ['table', 'chairs', 'whiteboard', 'plants', 'clock', 'cooler'], 'boardroom'], ['Lounge', ['armchair', 'bookcase', 'sofa', 'tv', 'gym', 'arcade'], 'lounge'], ['Beach', ['deckchair', 'volleyball', 'flamingo']]]]];
  const PIZZA_ITEM = { id: 'pizza', name: 'Pizza', price: 0, room: 'treats', keeps: false, most: 0, have: 0, owned: false, waits: false };
  const shopSaid = el('p', { class: 'note', 'aria-live': 'polite' });
  const purseLine = el('span', { class: 'note' });
  const purseWords = () => {
    const p = world.purse;
    return p ? `Spending balance ${big(p.left)} · ${big(p.earned)} written since the office opened · ${big(p.spent)} spent` : '';
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
    // The last few things bought (the office keeps the record), newest first, folded under one Transaction history line
    // (open, it stays open as the shop is drawn again).
    const when = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const wasOpen = !!shopBox?.querySelector('details.recent[open]');
    const recent = world.recent.length ? el('details', { class: 'recent', open: wasOpen },
      el('summary', {}, el('b', { text: 'Transaction history' }), el('span', { class: 'note', text: ` · ${world.recent.length} recent` })),
      el('ul', { class: 'recent-list' }, ...world.recent.map((b) => el('li', {}, el('span', { text: SHOP_WORDS[b.item]?.label ?? b.item }),
        el('span', { class: 'note', text: when(b.at) }), el('b', { text: big(b.price) }))))) : null;
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
    if (!orderFood('pizza')) return (shopSaid.textContent = 'A pizza is on its way already: order another once it is on the table.');
    shopSaid.textContent = 'Pizza ordered (free).';
  }
  async function buyItem(item, button) {
    if (item.room === 'treats' && !present().length) return (shopSaid.textContent = 'Nobody is in the office to buy for: start a thread in Claude first.');
    if (FOOD[item.id] && onTheWay(item.id)) {
      const label = SHOP_WORDS[item.id]?.label ?? item.name;
      const many = /s$/.test(label);
      return (shopSaid.textContent = `${label} ${many ? 'are on their way' : 'is on its way'} already: buy more once ${many ? 'they are' : 'it is'} on the table.`);
    }
    if (item.id === 'coffee' && onTheWay('coffee')) return (shopSaid.textContent = 'A coffee delivery is on its way already: buy another once it has been round.');
    button.disabled = true;
    try {
      const d = await window.aiOffice.api('/api/buy', { item: item.id });
      // A room key: the room stays shut until the IT tech has walked over and unlocked it (callTech, then openRoom).
      if (item.unlocks) callTech(item.unlocks);
      // Furniture: it shows once the fitter has carried it in and set it up (callFitter, then stepFitter).
      else if (item.keeps) callFitter(item.id);
      officeData(d.shop);
      drawShop();
      // One short line: the purse line above says what is left, and Transaction history keeps the record.
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
        // Nothing said yet: a couple notice the IT tech coming in by the front door (stepTech), and the thanks and the
        // wave come when the tech opens the room.
        shopSaid.textContent = `${item.unlocks === 'lounge' ? 'The lounge' : 'The meeting room'} is bought (${big(item.price)} tokens): the IT tech is on the way to unlock it. Then furnish it from the list below.`;
      } else {
        // Nothing said yet: a couple notice the fitter at the front door, or at the spot for beach gear (stepFitter),
        // and the thanks come once it is set up.
        // "Rubber ducks", "Indoor plants", "Desk cacti": bringing them in.
        shopSaid.textContent = `${item.name} bought (${big(item.price)} tokens): the fitter is bringing ${/(s|cacti)$/.test(item.name) ? 'them' : 'it'} in.`;
      }
      wake();
    } catch (e) {
      shopSaid.textContent = app()?.faultText?.(e) || 'The office did not answer. Check that the AI Office Overview window is still open, then try again.';
    } finally {
      button.disabled = false;
    }
  }
  // ---- The vending machine: a 1M-token coin buys everyone in an energy drink, and for a minute they buzz ----

  const buzzing = (p) => (p.hyperUntil ?? 0) > world.time;
  /** What they say on an energy drink, quickly, every couple of seconds; and when it wears off. */
  const BUZZ_LINES = ['Okayokayokay let\'s go!', 'I can hear the code!', 'Refactor everything! Now!', 'Race you to the kitchen!',
    'Ten tabs! Twenty! Thirty!', 'Typing at the speed of light!', 'Ship it ship it ship it!', 'I just blinked twice. Productive!',
    'Bugs? Fixed. All of them. Probably.', 'My keyboard is smoking!', 'Meeting? Done. Next!', 'Wheeee!', 'Faster! Faster!',
    'Deadline? Bring it!', 'I could rewrite this in an hour. Easy.', 'Zoom zoom!', 'Is the floor moving or is it me?', 'Who needs sleep?'];
  const CRASH_LINES = ['I need a nap.', 'Was I talking fast? Sorry.', 'Where did that minute go?', 'Never again. Until next time.', 'My hands are still buzzing.'];
  const SIP_LINES = ['Ooh, energy drinks!', 'Thanks, boss! *glug*', 'Here we gooo!', 'I can feel it already!'];
  function stepEnergy() {
    for (const p of world.people.values()) {
      if (!p.hyperUntil || p.leaving || p.out) continue;
      if (world.time >= p.hyperUntil) {
        p.hyperUntil = 0;
        // Worn off: back to what they were doing (the desk, the kitchen, the towel).
        p.run = null;
        p.targetKey = '';
        say(p, CRASH_LINES[(p.seed + (world.noticed || 0)) % CRASH_LINES.length], 3);
        continue;
      }
      if (world.time > (p.hyperNext ?? 0)) {
        say(p, BUZZ_LINES[Math.floor(Math.random() * BUZZ_LINES.length)], 1.3);
        p.hyperNext = world.time + 2 + Math.random() * 2.5;
      }
    }
  }
  /** The cans are out: everyone here has one, says so, and buzzes for ENERGY_SECONDS. */
  function drinkUp() {
    present().forEach((p, i) => {
      p.hyperUntil = world.time + ENERGY_SECONDS;
      p.targetKey = ''; // up and off at once
      p.hyperNext = world.time + 2 + Math.random() * 1.5;
      say(p, SIP_LINES[(p.seed + i) % SIP_LINES.length], 2);
      thank(p);
    });
    wake();
  }
  /** The machine itself, in a window: rows of cans behind the glass, a little display, the coin slot. */
  function openVending() {
    const energy = world.shop.find((i) => i.id === 'energy');
    const screen = el('p', { class: 'vend-screen', role: 'status' });
    const show = (big, small = '') => screen.replaceChildren(el('b', { text: big }), small ? el('span', { text: small }) : '');
    const balance = el('p', { class: 'vend-balance' });
    const showBalance = () => { balance.textContent = `Your balance: ${big(world.purse?.left ?? 0)} tokens`; };
    const tray = el('div', { class: 'vend-tray', 'aria-hidden': 'true' });
    const cans = el('div', { class: 'vend-glass', 'aria-hidden': 'true' }, ...Array.from({ length: 12 }, (_, i) => el('span', { class: `vend-can c${i % 4}` })));
    const coin = el('button', { type: 'button', class: 'vend-coin', onclick: insert }, el('span', { class: 'vend-slot', 'aria-hidden': 'true' }), el('span', { text: 'Insert a 1M-token coin' }));
    const awake = [...world.people.values()].filter(buzzing).length;
    show('INSERT COIN', 'Energy drinks for everyone in · 1M tokens');
    showBalance();
    async function insert() {
      if (!energy) return show('OUT OF ORDER', 'The office did not list the drinks: reload the page.');
      if (!present().length) return show('NOBODY HERE', 'Start a thread in Claude first: then there is someone to drink it.');
      const still = Math.max(...[...world.people.values()].map((p) => (buzzing(p) ? p.hyperUntil - world.time : 0)));
      if (still > 0) return show('STILL BUZZING', `They are on the last cans for ${Math.ceil(still)} s more. Try again after.`);
      if ((world.purse?.left ?? 0) < energy.price) return show('NOT ENOUGH TOKENS', `${big(energy.price - (world.purse?.left ?? 0))} more to go: come back after some work.`);
      coin.disabled = true;
      coin.classList.add('dropping');
      try {
        const d = await window.aiOffice.api('/api/buy', { item: 'energy' });
        officeData(d.shop);
        drawShop();
        showBalance();
        show('THANK YOU', 'Cans coming out…');
        // The delay is set on the element, not as a style attribute: the page's rules refuse inline styles.
        tray.replaceChildren(...present().slice(0, 6).map((_, i) => { const can = el('span', { class: `vend-can c${i % 4} out` }); can.style.animationDelay = `${i * 0.12}s`; return can; }));
        shopSaid.textContent = `Energy drinks bought (${big(energy.price)} tokens): everyone buzzes for a minute.`;
        setTimeout(() => { app()?.closeWindow?.(); drinkUp(); }, 1300);
      } catch (e) {
        show('COIN RETURNED', app()?.faultText?.(e) || 'The office did not answer. Check that the AI Office Overview window is still open, then try again.');
        coin.disabled = false;
        coin.classList.remove('dropping');
      }
    }
    app()?.openWindow?.('Vending machine: energy drinks', [el('div', { class: 'vend' },
      el('div', { class: 'vend-top' }, el('span', { class: 'vend-brand', text: 'ENERGY' }), el('span', { class: 'vend-sub', text: 'Drinks for the whole team' })),
      el('div', { class: 'vend-body' }, cans, el('div', { class: 'vend-side' }, screen, coin, balance)),
      tray,
      el('p', { class: 'vend-note', text: `Everyone in the office gets a can and, for a minute, walks and talks three times as fast.${awake ? ' Some are still buzzing from the last ones.' : ''}` }),
      el('div', { class: 'vend-foot' }, el('button', { type: 'button', class: 'btn', onclick: () => app()?.closeWindow?.() }, 'Close')))], []);
    document.querySelector('#check .sheet-box')?.classList.add('vend-box');
    coin.focus();
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

  // Day or night: the theme on <html> (Settings › Office), or Windows' own when it follows Windows. A change redraws the
  // rooms (kept as one picture) and the Staff rewards pictures, if they are open.
  const darkWindows = window.matchMedia?.('(prefers-color-scheme: dark)');
  function readTheme() {
    const t = document.documentElement.dataset.theme;
    const was = night;
    night = t === 'dark' || (t !== 'light' && !!darkWindows?.matches);
    if (night === was) return;
    background = null;
    for (const v of views) v.drawnAt = 0;
    if (shopBox?.isConnected) drawShop();
    wake();
  }
  readTheme();
  darkWindows?.addEventListener('change', readTheme);
  // Also on coming back to the window (Windows' colours are changed in its own Settings app), in case a browser does
  // not report the change while the page is in the background.
  window.addEventListener('focus', readTheme);
  document.addEventListener('visibilitychange', readTheme);
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.officeView = {
    update,
    /** Draws again now (Show names or Project on screens was ticked or unticked). */
    refresh: () => { for (const v of views) v.drawnAt = 0; wake(); },
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
    /** The IT tech now (for checks): the room they are on, what they are doing and where, and the rooms waiting. */
    /** The energy drinks now (for checks): the office clock, how many are buzzing, and the most seconds left. */
    energyNow: () => ({ time: world.time, buzzing: [...world.people.values()].filter(buzzing).length, left: Math.max(0, ...[...world.people.values()].map((p) => (p.hyperUntil ?? 0) - world.time)) }),
    /** A person's character in the office chat ("Pun lover"), for their card. */
    character: (id) => window.officeBanter?.characterOf(hash(id))?.name ?? '',
    techNow: () => ({ tech: tech && { lock: tech.lock, phase: tech.phase, x: Math.round(tech.x), y: Math.round(tech.y), path: tech.path.length }, waiting: [...world.unlocking], party: world.party?.lock ?? null }),
    where: (id) => {
      const p = world.people.get(id);
      return p ? { x: p.x, y: p.y, walking: p.path.length > 0, area: p.target?.area, words: wordsOf(p) } : null;
    },
    rewards,
  };
})();
