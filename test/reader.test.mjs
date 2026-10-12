import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { emptyThread, addLine, readFrom, onlyLooks, questionIn, wordsFor, commandFolder } from '../src/transcript.mjs';
import { tempHome, lines } from './helpers.mjs';

test('one reply written over several lines is counted once (its last count wins)', () => {
  const t = emptyThread('a');
  const base = { type: 'assistant', timestamp: '2026-10-12T01:00:00Z', message: { id: 'm1', stop_reason: 'tool_use' } };
  addLine(t, { ...base, message: { ...base.message, usage: { output_tokens: 5 }, content: [{ type: 'thinking' }] } });
  addLine(t, { ...base, message: { ...base.message, usage: { output_tokens: 40 }, content: [{ type: 'tool_use', name: 'Read', input: {} }] } });
  addLine(t, { ...base, message: { ...base.message, id: 'm2', usage: { output_tokens: 7 }, content: [] } });
  assert.equal(t.out, 47);
});

test('tokens before the office opened are not in outSince', () => {
  const t = emptyThread('a', '2026-10-12T01:00:00.000Z');
  for (const [id, at, n] of [['m1', '2026-10-12T00:59:00Z', 100], ['m2', '2026-10-12T01:01:00Z', 30]]) {
    addLine(t, { type: 'assistant', timestamp: at, message: { id, stop_reason: 'end_turn', usage: { output_tokens: n }, content: [] } });
  }
  assert.equal(t.out, 130);
  assert.equal(t.outSince, 30);
});

test('a command made only of looking is reading, not work; quoted | is not a pipe', () => {
  assert.equal(onlyLooks('cd "/c/x/Tomlin" && ls public | grep -i office; wc -l a.js'), true);
  assert.equal(onlyLooks('grep -n -E "^#+ |office|game" PLAN.md | head -5'), true);
  assert.equal(onlyLooks('git status && git log -3'), true);
  assert.equal(onlyLooks('npm test'), false);
  assert.equal(onlyLooks('ls; rm -rf build'), false);
  assert.equal(onlyLooks('sed -i s/a/b/ x.txt'), false);
  assert.equal(onlyLooks('git commit -m "ls"'), false);
  assert.equal(onlyLooks('f=$(find x -name "*.jsonl" | head -1); [ -n "$f" ] && head -c 600 "$f"'), true);
  assert.equal(onlyLooks('ls a 2>/dev/null; grep x b 2>&1 | head'), true);
  assert.equal(onlyLooks('echo hello > notes.txt'), false);
  assert.equal(onlyLooks('cat a >> b.txt'), false);
});

test('a command works where its leading cd goes', () => {
  assert.equal(commandFolder('cd "C:/Work/projects/app one" && npm test', 'C:/Work'), 'C:/Work/projects/app one');
  assert.equal(commandFolder('npm test', 'C:/Work/x'), 'C:/Work/x');
  // A variable set first, then cd to it: the folder is the variable's, not wherever the shell was left.
  assert.equal(commandFolder('D="C:/Work/projects/app one/sub"; cd "$D" && git add -A', 'C:/Work/projects/other'), 'C:/Work/projects/app one/sub');
  assert.equal(commandFolder('SRC=/c/w/a; cd ${SRC}/b && make', 'C:/x'), '/c/w/a/b');
  assert.equal(commandFolder('cd "$UNKNOWN" && make', 'C:/Work/x'), '');
  assert.equal(commandFolder('echo hi; cd ~/x && make', 'C:/Work/x'), '');
});

test('a reply asks when a last line ends with a question mark; the first such line is shown', () => {
  assert.equal(questionIn('Built it.\n\n**Your call:**\n1. Prices x 20?\n2. Seat names?\n\nThe notes are ready.'), '1. Prices x 20?');
  assert.equal(questionIn('Done. Let me know what you find.'), '');
  assert.equal(questionIn('Is this right? It was built and tested.'), '');
});

test('steps get plain words', () => {
  assert.equal(wordsFor('Edit', { file_path: 'C:\\a\\PLAN.md' }), 'Editing PLAN.md');
  assert.equal(wordsFor('Bash', { command: 'npm test', description: 'Run the tests' }), 'Running: Run the tests');
  assert.equal(wordsFor('Grep', {}), 'Searching the files');
});

test('a file is read a piece at a time: a half-written last line waits for the rest', () => {
  const h = tempHome();
  try {
    const file = path.join(h.dir, 't.jsonl');
    const one = lines('t').prompt(0, 'hello').text();
    const two = lines('t').reply(1, 'Done?', 9).text();
    fs.writeFileSync(file, one + two.slice(0, 30));
    const t = emptyThread('t');
    let off = readFrom(file, t, 0);
    assert.equal(off, Buffer.byteLength(one));
    assert.equal(t.out, 0);
    fs.writeFileSync(file, one + two);
    off = readFrom(file, t, off);
    assert.equal(t.out, 9);
    assert.equal(t.asked, 'Done?');
    assert.equal(t.firstPrompt, 'hello');
  } finally {
    h.done();
  }
});
