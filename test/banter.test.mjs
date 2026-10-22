// The office chat's characters and lines (public/banter.js): every kind of event has lines, every placeholder is
// filled, replies come from those nearby, and the quiet one is quiet. Run: node --test test/banter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../public/banter.js', import.meta.url), 'utf8'), { window });
const B = window.officeBanter;
/** A steady "random": the same sequence every run. */
const seq = (seed) => { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };
const EVENTS = [{ kind: 'tests-passed' }, { kind: 'tests-failed' }, { kind: 'commit' }, { kind: 'push' }, { kind: 'push-friday' }, { kind: 'again', file: 'app.js', n: 3 },
  { kind: 'stopped' }, { kind: 'late' }, { kind: 'pair' }, { kind: 'bug' }, { kind: 'failed' }, { kind: 'push-weekend' }, { kind: 'tests-failed-monday' }];

test('six characters, one for good per seat, all of them used', () => {
  assert.equal(B.CHARACTERS.length, 6);
  assert.equal(B.characterOf(123456), B.characterOf(123456));
  const seen = new Set();
  for (let s = 0; s < 2000; s += 7) seen.add(B.characterOf(s * 2654435761 >>> 0).id);
  assert.equal(seen.size, 6);
});

test('every event has lines in every voice, with every placeholder filled', () => {
  for (const e of EVENTS) {
    assert.ok(B.LINES[e.kind], e.kind);
    for (const me of B.CHARACTERS) {
      const near = B.CHARACTERS.slice(0, 3).map((c) => ({ character: c, name: 'Otto' }));
      for (let r = 1; r < 40; r++) {
        for (const l of B.plan(e, { ...me, talk: 1 }, near, 'Wren', seq(r))) {
          assert.ok(!/\{(file|n|who)\}/.test(l.text), `${e.kind}/${me.id}: ${l.text}`);
          assert.ok(l.by >= -1 && l.by < near.length);
        }
      }
    }
  }
});

test('most moments get one line; replies are the exception; some get none', () => {
  const near = B.CHARACTERS.slice(0, 2).map((c) => ({ character: c, name: 'Otto' }));
  let none = 0, one = 0, more = 0;
  const rnd = seq(7);
  for (let i = 0; i < 2000; i++) {
    const n = B.plan({ kind: 'tests-passed' }, B.CHARACTERS[2], near, 'Wren', rnd).length;
    if (!n) none++; else if (n === 1) one++; else more++;
  }
  assert.ok(none > 300, `silence happens (${none})`);
  assert.ok(one > more, `one line is the usual (${one} vs ${more})`);
});

test('the quiet one says far less than the pun lover', () => {
  const count = (c) => { const rnd = seq(11); let n = 0; for (let i = 0; i < 2000; i++) if (B.plan({ kind: 'commit' }, c, [], 'Wren', rnd).length) n++; return n; };
  assert.ok(count(B.CHARACTERS.find((c) => c.id === 'quiet')) * 2 < count(B.CHARACTERS.find((c) => c.id === 'punny')));
});

test('Work only: the plain fact for each event from a thread', () => {
  for (const e of EVENTS.filter((x) => !['late', 'pair'].includes(x.kind))) assert.ok(B.fact(e), e.kind);
  assert.equal(B.fact({ kind: 'again', file: 'app.js', n: 6 }), 'Editing app.js again (6 times).');
  assert.equal(B.fact({ kind: 'late' }), null, 'office-only moments have no fact');
});

test('"It worked on my desk." always gets its answer from the nearest, when someone is near', () => {
  const bold = { ...B.CHARACTERS.find((c) => c.id === 'bold'), talk: 1 };
  const near = [{ character: B.CHARACTERS.find((c) => c.id === 'quiet'), name: 'Otto' }];
  let seen = 0;
  for (let r = 1; r < 400; r++) {
    const lines = B.plan({ kind: 'tests-failed' }, bold, near, 'Wren', seq(r));
    const i = lines.findIndex((l) => l.by === -1 && l.text === 'It worked on my desk.');
    if (i < 0) continue;
    seen++;
    assert.equal(lines[i + 1]?.by, 0);
    assert.equal(lines[i + 1]?.text, B.COMEBACKS['It worked on my desk.'][0]);
  }
  assert.ok(seen > 10, `the line comes up (${seen})`);
  for (let r = 1; r < 400; r++) for (const l of B.plan({ kind: 'tests-failed' }, bold, [], 'Wren', seq(r))) assert.equal(l.by, -1, 'nobody near, nobody answers');
});

test('day-specific moments: a Friday or weekend push always, failed tests on a Monday about half the time', () => {
  // One week at local noon, built when the test runs: the Monday of this week, plus 0 (Monday) to 6 (Sunday) days.
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const at = (n) => { const d = new Date(monday); d.setDate(d.getDate() + n); return d.toISOString(); };
  const [MON, TUE, WED, FRI, SAT, SUN] = [0, 1, 2, 4, 5, 6];
  assert.equal(new Date(at(MON)).getDay(), 1, 'the week starts on a Monday');
  const always = () => 0;
  assert.equal(B.dayKind({ kind: 'push' }, at(FRI), always).kind, 'push-friday');
  assert.equal(B.dayKind({ kind: 'push' }, at(SAT), always).kind, 'push-weekend');
  assert.equal(B.dayKind({ kind: 'push' }, at(SUN), always).kind, 'push-weekend');
  assert.equal(B.dayKind({ kind: 'push' }, at(WED), always).kind, 'push');
  assert.equal(B.dayKind({ kind: 'tests-failed' }, at(MON), always).kind, 'tests-failed-monday');
  assert.equal(B.dayKind({ kind: 'tests-failed' }, at(MON), () => 0.9).kind, 'tests-failed', 'Mondays still hear the usual lines');
  assert.equal(B.dayKind({ kind: 'tests-failed' }, at(TUE), always).kind, 'tests-failed');
  assert.equal(B.dayKind({ kind: 'commit', file: 'a.js' }, at(FRI), always).file, 'a.js', 'the rest of the event is kept');
  assert.ok(B.LINES['push-friday'].any.includes('Pushing on a Friday... isn\'t there a rule about this?'));
});

test('payday: real figures, top thrilled, lowest asks, someone sees the bright side; nothing when it does not fit', () => {
  const three = B.payday([{ name: 'Ivy', today: 30000 }, { name: 'Wren', today: 500000 }, { name: 'Juno', today: 1000 }]);
  assert.equal(JSON.stringify(three.map((l) => l.by)), JSON.stringify([1, 0, 2, 1]));
  assert.equal(three[0].text, 'I\'m excited, I\'m getting paid 500K tokens...');
  assert.equal(three[1].text, 'Hang on. You\'re on 500K and I\'m on 30K?');
  assert.equal(three[2].text, '30K? I\'m on 1K. Wait, you lot are getting paid?');
  assert.equal(three[3].text, 'Well, there\'s always the odd pizza.');
  const four = B.payday([{ today: 2e6 }, { today: 400000 }, { today: 90000 }, { today: 5000 }]);
  assert.equal(four.length, 4);
  assert.equal(four[3].by, 2, 'the bright side comes from the one who had not spoken');
  const two = B.payday([{ today: 5000 }, { today: 2500000 }]);
  assert.equal(JSON.stringify(two.map((l) => l.by)), JSON.stringify([1, 0, 1]));
  assert.equal(two[1].text, '2.50M? I\'m on 5K. Wait, you\'re getting paid?');
  assert.equal(B.payday([{ today: 500000 }]).length, 0, 'one alone has nobody to compare with');
  assert.equal(B.payday([{ today: 500000 }, { today: 0 }]).length, 0, 'nothing earned today, nothing said');
  assert.equal(B.payday([{ today: 500200 }, { today: 499800 }]).length, 0, 'the same figure shown is no joke');
});
