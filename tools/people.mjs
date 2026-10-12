// Lists the people the office sees, from the command line: node tools/people.mjs [--data <folder>]
// Use a scratch --data folder to look without opening the office (the purse starts the first time data/ is made).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Office } from '../src/office.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--data');
const dataDir = i > 0 ? process.argv[i + 1] : process.env.AI_OFFICE_DATA || path.join(here, '..', 'data');
const office = new Office({ dataDir, transcriptsDir: process.env.AI_OFFICE_TRANSCRIPTS });
const t0 = Date.now();
const files = office.scan();
const s = office.snapshot();
office.save();
const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
console.log(`Read ${files} files in ${((Date.now() - t0) / 1000).toFixed(1)} s. Projects folder: ${s.root}`);
console.log(`\nProjects today: ${s.projects.map((p) => `${p.name} (${p.people.length})`).join(', ') || 'none'}`);
console.log('\nPeople (newest first):');
for (const p of s.people.slice(0, Number(process.env.SHOW || 25))) {
  const t = p.thread ? ` | ${p.thread.title}` : '';
  console.log(`  ${p.name.padEnd(28)} ${String(p.folder || '(projects folder)').padEnd(24)} seat ${p.seat}  ${p.state.padEnd(8)} ${p.words.slice(0, 40).padEnd(40)} threads ${String(p.threads).padStart(3)}  out ${k(p.out).padStart(7)}${t}`);
}
console.log(`\nNeeds revisiting: ${s.waiting.length}`);
for (const w of s.waiting.slice(0, 10)) console.log(`  ${w.name} (${w.folder || 'Consultants'}): ${w.asked.slice(0, 90)}${w.gone ? '  [gone home]' : ''}`);
console.log(`\nPeople: ${s.people.length}. Earned since the office opened (${s.openedAt}): ${k(s.earned)}`);
