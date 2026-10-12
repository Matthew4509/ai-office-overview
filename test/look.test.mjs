import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { LOOK_OPTIONS, cleanLook } from '../src/look.mjs';
import { Office } from '../src/office.mjs';
import { tempHome } from './helpers.mjs';

const LOOK = { gender: 'woman', skin: 'tan', hair: 'bob', hairColour: 'auburn', top: 'mint', glasses: 'round', facial: 'none', headwear: 'beret' };

test('the page and the server know the same parts and colours', () => {
  const ctx = { window: { devicePixelRatio: 1 }, document: { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {} }), style: {}, setAttribute() {} }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'look.js'), 'utf8'), ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.officeLook.options())), LOOK_OPTIONS);
});

test('a look is kept only when every part is known', () => {
  assert.deepEqual(cleanLook(LOOK), LOOK);
  assert.equal(cleanLook({ ...LOOK, hair: 'mohawk' }), null);
  assert.equal(cleanLook({ ...LOOK, skin: undefined }), null);
  assert.equal(cleanLook('nope'), null);
});

test('a saved look belongs to the seat, sits beside its nickname, and can be taken off again', () => {
  const h = tempHome();
  try {
    const office = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    office.setNickname('ai office overview', 1, 'Wren');
    assert.equal(office.setLook('ai office overview', 1, LOOK), true);
    assert.equal(office.setLook('ai office overview', 1, { ...LOOK, top: 'tartan' }), false, 'refused, the saved one stays');
    const again = new Office({ dataDir: h.data, transcriptsDir: h.transcripts });
    const p = again.snapshot().people.find((x) => x.key === 'ai office overview#1');
    assert.equal(p.name, 'Wren');
    assert.deepEqual(p.look, LOOK);
    again.setLook('ai office overview', 1, null);
    const after = again.snapshot().people.find((x) => x.key === 'ai office overview#1');
    assert.equal(after.look, null);
    assert.equal(after.name, 'Wren', 'the nickname stays');
  } finally {
    h.done();
  }
});
