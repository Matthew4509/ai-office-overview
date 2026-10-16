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
  { kind: 'stopped' }, { kind: 'late' }, { kind: 'pair' }, { kind: 'bug' }, { kind: 'failed' }];

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
