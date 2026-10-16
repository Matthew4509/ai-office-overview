// The office chat's characters and lines (window.officeBanter). Every line is a reaction to something that really
// happened in a thread, measured by the office (a test run, a commit, a push, the same file edited again, a reply you
// stopped, a snag or a bug found) or seen in the office itself (two at one desk, working late). Nothing here makes up an
// event, quotes a thread, or asks an AI model anything: it is plain lines and a picker, so it costs nothing and sends
// nothing. Each seat has one character for good, from its seed: how often they talk, and in what voice. Most moments get
// one line, some get a reply or two, some get silence. Film nods are in our own words.
'use strict';

(() => {
  /** talk: the chance they say something when something happens to them (the quiet one rarely, the punster nearly always). */
  const CHARACTERS = [
    { id: 'punny', name: 'Pun lover', talk: 0.9 },
    { id: 'dry', name: 'Dry wit', talk: 0.7 },
    { id: 'sunny', name: 'Sunny', talk: 0.7 },
    { id: 'quiet', name: 'Quiet one', talk: 0.3 },
    { id: 'lead', name: 'Tired lead', talk: 0.5 },
    { id: 'bold', name: 'Bold', talk: 0.75 },
  ];
  /** A seat's character, for good (the low bits of the seed already pick other things, so these use the higher ones). */
  const characterOf = (seed) => CHARACTERS[(Math.abs(Number(seed) || 0) >>> 4) % CHARACTERS.length];

  // What the one it happened to says: shared lines (any) and their own voice. {file} and {n} come from the event.
  const LINES = {
    'tests-passed': {
      any: ['All green. I\'m going to need a bigger celebration.', 'Tests pass. That\'s suspicious.', 'It\'s alive! The test suite, I mean.', 'Every test green. Nobody touch anything.'],
      punny: ['Tests passed with flying colours. Well, one colour: green.', 'I\'d tell you a joke about passing tests, but you\'d all pass on it.'],
      dry: ['They passed. I\'ll check what I broke instead.', 'Green. I\'m as surprised as you are.'],
      sunny: ['All green! Best day ever!', 'Passed! High fives all round!'],
      quiet: ['Green.'],
      lead: ['Good. Now nobody touch it before lunch.', 'Passing. Write that down somewhere.'],
      bold: ['Told you. Never doubted it.', 'First try. Well, nearly.'],
    },
    'tests-failed': {
      any: ['Houston, we have a failing test.', 'Red, not green. Back to it.', 'The tests have opinions today.', 'Well, the tests found something.'],
      punny: ['Anyone got the bug spray?', 'Looks like a cache-22.'],
      dry: ['Which part of that was meant to work?', 'The tests and I need to talk.'],
      sunny: ['A red test is just a green test that hasn\'t happened yet!', 'Ooh, a puzzle!'],
      quiet: ['Hm.'],
      lead: ['Right. Nobody deploy anything.', 'Fix it before anyone notices. Too late, I noticed.'],
      bold: ['Define "failed".', 'It worked on my desk.'],
    },
    commit: {
      any: ['Committed. May the source be with you.', 'Saved for posterity. Or blame.', 'One more commit for the history books.'],
      punny: ['I\'m very committed to this relationship.', 'Commit to the bit. Literally.'],
      dry: ['Committed. The message is a work of art, I\'m sure.', 'Saved. Future me can deal with it.'],
      sunny: ['Commit made! Little wins!'],
      quiet: ['Saved.'],
      lead: ['Committed. Good. Small steps.'],
      bold: ['Committed. Flawless, obviously.'],
    },
    push: {
      any: ['Pushed. Where we\'re deploying, we don\'t need roads.', 'It\'s out there now. Wave goodbye.', 'Pushed. Fingers crossed for whoever pulls it.'],
      punny: ['I\'m not pushy. I just push.', 'Pushed. That\'s what I call a power move.'],
      dry: ['Pushed. Now it\'s everyone\'s problem.'],
      sunny: ['Off it goes into the world!'],
      quiet: ['Pushed.'],
      lead: ['Pushed. Good. Go and have a coffee.'],
      bold: ['Pushed straight to main. Live a little.'],
    },
    'push-friday': {
      any: ['A push on a Friday. Bold choice.', 'Pushed. On a Friday. Nobody tell the weekend.'],
      lead: ['Nobody push anything. It\'s Fri… oh. Never mind.'],
      bold: ['Friday push. Fortune favours the brave.'],
    },
    again: {
      any: ['{file} again. It\'s Groundhog Day in here.', 'Edit number {n} on {file}. We\'re getting close. Probably.', 'Back to {file}. It missed me.'],
      punny: ['{file} and I are on first-name terms now.'],
      dry: ['{n} edits to {file}. Persistence or stubbornness, you decide.'],
      sunny: ['{file}, one more time, with feeling!'],
      quiet: ['{file} again.'],
      lead: ['{n} times on {file}. Shall we talk about it?'],
      bold: ['{file} is nearly perfect. Nearly.'],
    },
    stopped: {
      any: ['I\'ll be back. Once the boss has had a think.', 'Stopped mid-sentence. Fair enough.', 'The boss pulled the plug. Fair.'],
      dry: ['Stopped. I\'ll pretend that was the plan.'],
      sunny: ['Pausing! Ready when you are!'],
      bold: ['Stopped? I was just getting good.'],
    },
    late: {
      any: ['Working late. Nobody tell the bugs we\'re still here.', 'Midnight code. What could possibly go wrong?', 'Is it late? It feels late.'],
      punny: ['Late-night coding: the dark mode of the soul.'],
      lead: ['It\'s late. Commit, then bed.'],
      quiet: ['Still here.'],
    },
    pair: {
      any: ['Two of us on one project. This is either teamwork or a race.', 'Shoulder to shoulder on this one.'],
      bold: ['Race you to the next commit.'],
      dry: ['Two of us on one desk. What could go wrong.'],
      sunny: ['Teamwork makes the dream work!'],
    },
    bug: {
      any: ['Whoever wrote this code got this wrong. …Oh. It was me.', 'Found a bug! Whoever wrote this got it wrong. Please don\'t check the history.', 'Aha, there you are, little bug.', 'Bug found. Squashing it before anyone notices.', 'Found the problem. It was hiding in plain sight.'],
      punny: ['Anyone got the bug spray?', 'I found the root cause. It was rooting for itself.'],
      dry: ['Found it. I\'d like a word with whoever wrote this. Ah.'],
      lead: ['Found it. Fix it properly, please.'],
      bold: ['Found it in seconds. You\'re welcome.'],
    },
    failed: {
      any: ['Well, that didn\'t work. Trying again.', 'Red, not green. Back to it.', 'The computer says no. Let\'s see why.', 'That went bang. Nobody panic.', 'Plan B it is.', 'Error! Totally meant to do that.'],
      punny: ['That error was a byte much.'],
      dry: ['Interesting. And by interesting I mean broken.'],
      bold: ['That was a test. Of you. You passed.'],
    },
  };

  // How the others answer, in their own voice. {who} is the one it happened to. Most moments get none.
  const REPLIES = {
    any: {
      punny: ['I\'ve got a pun for this but I\'ll save it.', 'Classic {who}.'],
      dry: ['Of course.', 'Here we go.', 'Mate.'],
      sunny: ['You\'ve got this, {who}!', 'Go {who}!'],
      quiet: ['Mm.', '…'],
      lead: ['Back to work, everyone.', 'Noted.'],
      bold: ['I\'d have done it faster.', 'Rookie numbers, {who}.'],
    },
    'tests-passed': { dry: ['I\'m uncomfortable with this.'], lead: ['Don\'t get used to it.'], sunny: ['Woo!'] },
    'tests-failed': { dry: ['Only if you\'ve never met the code.'], sunny: ['Need a hand, {who}?'], lead: ['Fix first, jokes later.'] },
    'push-friday': { lead: ['Absolutely not. …Too late.'], dry: ['See you all on Saturday, then.'] },
    again: { dry: ['Again?'], sunny: ['Third time\'s the charm!'] },
    bug: { dry: ['Dude. You wrote it.'], sunny: ['Send it over, {who}. We\'ll fix it first, laugh later.'], punny: ['Call the exterminator.'] },
    late: { lead: ['Go home, {who}.'], quiet: ['Me too.'] },
    pair: { bold: ['You\'re on.'], sunny: ['Love it!'] },
  };

  // Little exchanges: the one it happened to, an answer from someone near, and their come-back.
  const EXCHANGES = {
    again: [['Ugh, this needs an AI to sort it out.', 'You are an AI, {who}.', 'I meant a clever one.']],
    failed: [['Ugh, this needs an AI to sort it out.', 'You are an AI, {who}.', 'I meant a clever one.']],
    bug: [['Whoever wrote this got it wrong.', 'Mate. You wrote it.', 'And I\'ve grown since then.'], ['This code has more plot twists than a mystery novel.', 'You wrote the mystery, {who}.', 'And I still didn\'t see the ending coming.']],
    'tests-failed': [['It was working five minutes ago.', 'What changed?', 'Nothing. Well. Something.']],
  };

  // Work only (the office chat off): the plain fact, no banter. null: nothing to say.
  const FACTS = {
    'tests-passed': () => 'Tests passed.',
    'tests-failed': () => 'Tests failed: looking into it.',
    commit: () => 'Committed.',
    push: () => 'Pushed.',
    'push-friday': () => 'Pushed.',
    again: (e) => `Editing ${e.file || 'the same file'} again (${e.n || 'several'} times).`,
    stopped: () => 'Stopped by you.',
    bug: () => 'Found a bug.',
    failed: () => 'A step failed: trying again.',
  };
  const fact = (e) => FACTS[e.kind]?.(e) ?? null;

  const fill = (text, e, who) => text.replaceAll('{file}', e.file || 'that file').replaceAll('{n}', String(e.n || 'a few')).replaceAll('{who}', who || 'mate');
  const pick = (list, rnd) => list[Math.floor(rnd() * list.length) % list.length];

  /**
   * What is said when `e` happens to someone of character `me` (named `who`), with `near` = [{ character, name }] the
   * others nearby (most relevant first). Returns [{ by, text }] in order: by -1 is the one it happened to, 0.. the others.
   * Often one line, sometimes a reply or two, sometimes an exchange, sometimes nothing at all. `rnd` is Math.random.
   */
  function plan(e, me, near, who, rnd = Math.random) {
    const lines = LINES[e.kind];
    if (!lines || rnd() > me.talk) return [];
    const ex = EXCHANGES[e.kind];
    if (ex && near.length && rnd() < 0.18) {
      const [a, b, c] = pick(ex, rnd);
      return [{ by: -1, text: fill(a, e, who) }, { by: 0, text: fill(b, e, who) }, { by: -1, text: fill(c, e, who) }];
    }
    const own = [...(lines[me.id] || []), ...(lines.any || [])];
    const out = [{ by: -1, text: fill(pick(own, rnd), e, who) }];
    // Usually nobody answers; now and then one, rarely two: each by their own chance to talk.
    const answers = rnd() < 0.55 ? 0 : rnd() < 0.75 ? 1 : 2;
    near.slice(0, answers).forEach((o, i) => {
      if (rnd() > o.character.talk) return;
      const list = [...(REPLIES[e.kind]?.[o.character.id] || []), ...(REPLIES.any[o.character.id] || [])];
      if (list.length) out.push({ by: i, text: fill(pick(list, rnd), e, who) });
    });
    return out;
  }

  window.officeBanter = { CHARACTERS, characterOf, plan, fact, LINES, REPLIES, EXCHANGES, KINDS: Object.keys(LINES) };
})();
