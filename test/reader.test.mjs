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

test('a snag for the quips: a step that ended in an error, or the AI saying it found a bug; a declined step is not one', () => {
  const t = emptyThread('a');
  const result = (at, is_error, text) => ({ type: 'user', timestamp: at, message: { content: [{ type: 'tool_result', is_error, content: text }] } });
  const said = (at, text) => ({ type: 'assistant', timestamp: at, message: { id: at, content: [{ type: 'text', text }] } });
  addLine(t, result('2026-10-16T10:00:00Z', false, 'all passed'));
  assert.equal(t.snag, null);
  addLine(t, result('2026-10-16T10:01:00Z', true, "The user doesn't want to proceed with this tool use."));
  assert.equal(t.snag, null, 'a step the person declined is their choice, not a snag');
  addLine(t, result('2026-10-16T10:02:00Z', true, 'Exit code 1\nFAIL'));
  assert.deepEqual(t.snag, { at: '2026-10-16T10:02:00Z', kind: 'failed', run: 1 });
  addLine(t, said('2026-10-16T10:03:00Z', 'Found the bug: the list was read before it was sorted.'));
  assert.deepEqual(t.snag, { at: '2026-10-16T10:03:00Z', kind: 'bug', run: 2 });
  addLine(t, said('2026-10-16T10:04:00Z', 'No bugs here, the tests pass.'));
  assert.equal(t.snag.at, '2026-10-16T10:03:00Z', 'a mention of the word alone is not a find');
  addLine(t, result('2026-10-16T10:09:00Z', true, 'FAIL again'));
  assert.equal(t.snag.run, 3, 'three snags in 15 minutes: a big bug (the council of ducks)');
  addLine(t, result('2026-10-16T10:40:00Z', true, 'FAIL'));
  assert.equal(t.snag.run, 1, 'a snag long after the others starts a new run');
});

test('events for the chat: tests passed or failed, a commit or push that worked, the same file again, a stopped reply', () => {
  const t = emptyThread('a');
  const step = (at, id, name, input) => addLine(t, { type: 'assistant', timestamp: at, message: { id: at, content: [{ type: 'tool_use', id, name, input }] } });
  const result = (at, id, is_error) => addLine(t, { type: 'user', timestamp: at, message: { content: [{ type: 'tool_result', tool_use_id: id, is_error, content: 'output' }] } });
  step('2026-10-16T10:00:00Z', 't1', 'Bash', { command: 'node tools/test-all.js', description: 'Run the tests' });
  assert.equal(t.event, null, 'nothing until the result is in');
  result('2026-10-16T10:01:00Z', 't1', false);
  assert.deepEqual(t.event, { at: '2026-10-16T10:01:00Z', kind: 'tests-passed' });
  step('2026-10-16T10:02:00Z', 't2', 'Bash', { command: 'npm test' });
  result('2026-10-16T10:03:00Z', 't2', true);
  assert.equal(t.event.kind, 'tests-failed');
  step('2026-10-16T10:04:00Z', 't3', 'Bash', { command: 'git commit -m "Save"' });
  result('2026-10-16T10:05:00Z', 't3', true);
  assert.equal(t.event.kind, 'tests-failed', 'a commit that failed is not a commit');
  step('2026-10-16T10:06:00Z', 't4', 'Bash', { command: 'git push origin main' });
  result('2026-10-16T10:07:00Z', 't4', false);
  assert.equal(t.event.kind, 'push');
  for (let i = 0; i < 3; i++) step(`2026-10-16T10:1${i}:00Z`, `e${i}`, 'Edit', { file_path: 'C:/work/site/app.js' });
  assert.deepEqual(t.event, { at: '2026-10-16T10:12:00Z', kind: 'again', file: 'app.js', n: 3 });
  addLine(t, { type: 'user', timestamp: '2026-10-16T10:13:00Z', message: { content: '[Request interrupted by user]' } });
  assert.equal(t.event.kind, 'stopped');
  assert.ok(!JSON.stringify(t.event).includes('work/site'), 'only a file\'s short name is kept');
});
