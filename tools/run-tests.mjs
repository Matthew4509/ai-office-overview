// npm test: runs every test/*.test.mjs of this folder with Node's own test runner. The files are listed here, not left
// to the runner's glob (Node 21 and newer only), so the tests run on Node 20 too; and only this folder's test/ is
// looked in, never a copy of the office in a folder below (such as the public clone).
//   node tools/run-tests.mjs                          every test file
//   node tools/run-tests.mjs test/server.test.mjs     only the files named
//   node tools/run-tests.mjs --test-name-pattern=hook  extra options go to node --test as they are

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = args.filter((a) => a.startsWith('-'));
const named = args.filter((a) => !a.startsWith('-')).map((f) => path.resolve(f));
const files = named.length
  ? named
  : fs.readdirSync(path.join(root, 'test')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join(root, 'test', f));
if (!files.length) { console.error('No test files found in test/.'); process.exit(1); }

const r = spawnSync(process.execPath, ['--test', ...options, ...files], { cwd: root, stdio: 'inherit' });
if (r.error) { console.error(r.error.message); process.exit(1); }
process.exit(r.status ?? 1);
