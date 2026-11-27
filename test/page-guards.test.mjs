// The page's keyboard and saving guards (public/app.js, public/office.js, public/index.html): the plain helpers in app.js
// run here in Node (the tab an arrow key moves to, what EDIT's Save sends, how long a change is waited for), and the
// page files are read for the parts that need a browser to run (tab strips, the machines' buttons, the purse update).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const appJs = read('app.js');
const officeJs = read('office.js');
const html = read('index.html');

// The block between the two marker lines in app.js holds functions that touch no page.
const helpers = (() => {
  const from = appJs.indexOf('// ---- Plain helpers with no page in them');
  const to = appJs.indexOf('// ---- End of the plain helpers ----');
  assert.ok(from > 0 && to > from, 'the plain helpers block is in app.js');
  return new Function(`${appJs.slice(from, to)}\nreturn { postWait, tookTooLong, nextTab, editChanges };`)();
})();

test('arrow keys move along a tab strip and wrap; Home and End go to the ends; other keys do nothing', () => {
  const { nextTab } = helpers;
  assert.equal(nextTab('ArrowRight', 0, 3), 1);
  assert.equal(nextTab('ArrowRight', 2, 3), 0);
  assert.equal(nextTab('ArrowLeft', 0, 3), 2);
  assert.equal(nextTab('Home', 2, 3), 0);
  assert.equal(nextTab('End', 0, 3), 2);
  assert.equal(nextTab('Enter', 0, 3), -1);
  assert.equal(nextTab('ArrowRight', 0, 0), -1);
});

test('EDIT sends only what was changed: an untouched name is left out, so another tab\'s new name is kept', () => {
  const { editChanges } = helpers;
  const lookBefore = { hair: 'short', top: 'blue' };
  // Only the look changed: no nick in the body (the bug: the old name went with it and wiped the new one).
  assert.deepEqual(editChanges({ nickBefore: 'Ann', nickNow: 'Ann', lookBefore, lookNow: { hair: 'long', top: 'blue' }, lookTouched: true }), { look: { hair: 'long', top: 'blue' } });
  // Only the name changed: no look.
  assert.deepEqual(editChanges({ nickBefore: 'Ann', nickNow: 'Bea', lookBefore, lookNow: lookBefore, lookTouched: false }), { nick: 'Bea' });
  // Emptied on purpose: sent, so the default name comes back.
  assert.deepEqual(editChanges({ nickBefore: 'Ann', nickNow: '', lookBefore, lookNow: lookBefore }), { nick: '' });
  // The editor touched but back where it began (parts in another order): nothing to send.
  assert.equal(editChanges({ nickBefore: '', nickNow: '', lookBefore, lookNow: { top: 'blue', hair: 'short' }, lookTouched: true }), null);
  assert.equal(editChanges({ nickBefore: undefined, nickNow: '', lookBefore, lookNow: lookBefore }), null);
});

test('EDIT\'s Save and its made-up-look button build their bodies from editChanges, never from the name box alone', () => {
  assert.ok(!/nick: input\.value/.test(appJs), 'no save sends the name box as it stands');
  assert.match(appJs, /api\('\/api\/edit', \{ folder: p\.folder, seat: p\.seat, \.\.\.changed \}\)/);
});

test('a change (POST) gives up: 15 seconds, 2 minutes for update, shortcuts, setup and uninstall; said as a fault with a way out', () => {
  const { postWait, tookTooLong } = helpers;
  assert.equal(postWait('/api/buy'), 15000);
  assert.equal(postWait('/api/edit'), 15000);
  assert.equal(postWait('/api/update/pull'), 120000);
  assert.equal(postWait('/api/install'), 120000);
  assert.equal(postWait('/api/uninstall'), 120000);
  assert.equal(postWait('/api/setup'), 120000);
  const f = tookTooLong(15000).error;
  assert.ok(f.fault && f.reason.includes('15 seconds') && f.wayOut, 'fault, reason and way out');
  assert.match(appJs, /signal: stop\.signal/, 'the POST carries the abort signal');
});

test('every tab strip is a WAI-ARIA tab strip: tabs point at their panels, only the chosen tab is in the Tab order', () => {
  for (const [tab, panel] of [['tab-office', 'office-view'], ['tab-list', 'list-view'], ['tab-favs', 'favs-view'], ['tab-needs', 'side-needs'], ['tab-rewards', 'side-rewards']]) {
    assert.match(html, new RegExp(`role="tab" id="${tab}"[^>]*aria-controls="${panel}"`), `${tab} controls ${panel}`);
    assert.match(html, new RegExp(`id="${panel}" role="tabpanel" aria-labelledby="${tab}"`), `${panel} is a tab panel`);
  }
  for (const tab of ['tab-list', 'tab-favs', 'tab-rewards']) assert.match(html, new RegExp(`id="${tab}"[^>]*tabindex="-1"`), `${tab} starts out of the Tab order`);
  assert.match(appJs, /nextTab\(e\.key, tabs\.indexOf\(t\), tabs\.length\)/, 'one key handler for every strip');
  assert.match(appJs, /getElementById\('setup'\)[\s\S]{0,200}roving\(list\)/, 'Setup\'s strip is kept roving after each redraw');
});

test('the arcade, the vending machine and the trophy case can be opened from the keyboard', () => {
  assert.match(officeJs, /class: 'office-keys'/);
  assert.match(officeJs, /machine\('Play on the arcade machine'[^\n]*arcade\?\.open\(\)\)/);
  assert.match(officeJs, /machine\('Use the vending machine'[^\n]*openVending\(\)\)/);
  assert.match(read('app.css'), /\.office-keys \.btn:not\(:focus\)/, 'out of sight until focused, shown on focus');
});

test('a purchase updates the header\'s balance from the shop\'s answer at once', () => {
  assert.equal((officeJs.match(/app\(\)\?\.shopBought\?\.\(d\.shop\)/g) || []).length, 2, 'both /api/buy callers');
  assert.match(appJs, /app\.shopBought = \(shop\) => \{[\s\S]{0,200}drawPurse\(\);[\s\S]{0,40}refresh\(\);/);
});

test('a card opened from the keyboard takes the focus, and gives it back to the person when closed', () => {
  assert.match(appJs, /class: 'name-heading', tabindex: '-1'/, 'the heading can take the focus without a redraw');
  assert.match(appJs, /heading\?\.focus\(/);
  assert.match(appJs, /'data-person': p\.key/);
  assert.match(appJs, /'data-person': w\.person/);
});
