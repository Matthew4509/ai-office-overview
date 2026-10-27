// Run by install.cmd and uninstall.cmd (they check Node.js first). Asks in the console window, then sets up or takes
// away the office's shortcuts, for this Windows user only.
//   node tools/setup.mjs install            Start menu shortcut, then asks about the desktop and Start with Windows (Enter = yes)
//   node tools/setup.mjs install --yes      no questions: all three
//   node tools/setup.mjs uninstall          stops the office, takes all three away and the hooks out; the folder is left for you
// Add --no-desktop / --no-startup to leave one out without being asked.

import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import * as install from '../src/install.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const has = (f) => args.includes(f);
const say = (s) => console.log(` ${s}`);

// One reader for the whole run (answers can arrive together when typed ahead or piped in by a test). No input left
// counts as Enter, that is Yes.
let rl = null, waiting = null, closed = false;
const lines = [];
async function ask(q) {
  if (has('--yes')) return true;
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (l) => { if (waiting) { const w = waiting; waiting = null; w(l); } else lines.push(l); });
    rl.on('close', () => { closed = true; if (waiting) { const w = waiting; waiting = null; w(''); } });
  }
  process.stdout.write(` ${q} [Y/n] `);
  const a = lines.length ? lines.shift() : closed ? '' : await new Promise((r) => { waiting = r; });
  if (!process.stdin.isTTY) console.log(a);
  return !/^\s*n/i.test(a);
}

function report(r) {
  for (const x of r.results) {
    const name = install.NAMES[x.where];
    if (x.error) say(`  x ${name}: ${x.error}`);
    else if (x.unsupported) say(`  - ${name}: ${x.unsupported}`);
    else if (x.where === 'hooks') say(`  OK ${name}${x.removed ? ` taken out of Claude's settings (a copy is kept: ${x.backup})` : ': none were set up'}`);
    else say(`  ${x.exists ? `OK ${name}${x.path ? ` (${x.path})` : ''}` : `OK ${name} removed`}`);
  }
}

async function doInstall() {
  const want = { startmenu: true };
  want.desktop = has('--no-desktop') ? undefined : await ask('Put an AI Office Overview shortcut on your desktop?');
  want.startup = has('--no-startup') ? undefined : await ask('Start the office quietly when you sign in to Windows?');
  if (want.desktop === false) want.desktop = undefined; // "no" leaves an existing one alone; Setup can remove it
  if (want.startup === false) want.startup = undefined;
  console.log('');
  const r = await install.apply(want);
  report(r);
  if (r.errors.length) { say(''); say('Not everything could be set up. The office still works: start it with Start AI Office Overview.cmd.'); return 1; }
  return 0;
}

async function doUninstall() {
  // Stop a running office first.
  try { execFileSync(process.execPath, [path.join(install.HERE, 'server.mjs'), '--stop'], { stdio: 'ignore', timeout: 15000 }); } catch { /* not running, or already gone */ }
  const r = await install.uninstall();
  report(r);
  say('');
  say('AI Office Overview is switched off and its shortcuts are gone. Its files are still in');
  say(`  ${install.HERE}`);
  say('Delete that folder to remove it completely (your names, looks, rewards and the ledger are in its data folder).');
  return r.errors.length ? 1 : 0;
}

if (cmd === 'install') process.exitCode = await doInstall();
else if (cmd === 'uninstall') process.exitCode = await doUninstall();
else { say('Use: node tools/setup.mjs install | uninstall'); process.exitCode = 2; }
if (rl) rl.close();
