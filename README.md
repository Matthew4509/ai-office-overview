# AI Office Overview

An office that shows what your Claude Code threads are doing. Each thread is a little person at their project's desk:
working, thinking in the meeting room, standing up with a "?" when they need you, resting when they have finished, and
going home when they have gone quiet. As your staff work, the tokens they make can be spent on office improvements.

It runs on your PC only. It reads Claude Code's transcripts and never sends them anywhere.

This is office overview only. The head office has tools to manage your projects, scan and preview projects developed
locally. If you prefer that one, it's [AI Head Office Overview](https://github.com/Matthew4509/ai-head-office-overview).

- **AI Office Overview** (this one): the office only. Your threads as staff, Needs attention, Favourites, Staff rewards
  and the Thoughts chat. Needs Node.js 20 or newer. It sends nothing anywhere (Setup › Update asks GitHub only when you
  press it).
- **AI Head Office Overview**: the same office, plus a tile for each project (run its local copy, open its folder, a
  terminal or the browser), a built-in security audit, git backup and live-site marks, Prompts and a project planner.
  It checks the live addresses you add. Windows 10 or 11 with Edge, Node.js 22 or newer.

## Start it

You need Node.js 20 or newer. Double-click **Start AI Office Overview.cmd**, or run:

```
node server.mjs
```

The page opens by itself once the office is ready (or go to http://127.0.0.1:8860/). The very first start reads all
your Claude transcripts once, which can take a minute: keep the window open. Later starts take about a second. The first
start also opens the office: the purse counts from then on.

## What you see

- **AI Office Overview** (the title, top left) goes back to the office with all projects. The page always opens on the
  office (an address ending `#list` or `#favourites` opens that tab instead).
- **Sun, moon and auto** (top right): light, dark, or Auto, which is light from sunrise to sunset and dark at night.
  Sunrise is worked out from this PC's time zone, so nothing is asked online. Setup also has **Match Windows**. Dark dims
  the rooms and the beach too. Until one is picked the office is light.
- **Projects** (down the left; above the office on a narrower window): All projects, then every project with a thread
  today, with how many people are working, thinking, need you, or have finished. Click one to show only that project.
  When everyone sits in one project and no projects folder is set, a line under the list asks "Are your projects in
  one folder? Choose it": Choose it opens Setup at the projects folder box.
- **The office** (or **List**, the same in words): click a person to open their card. What the person picked is doing
  shows to the right of the office (under it on a narrow screen). On a wide window the page itself does not scroll:
  the middle and the right panel each scroll on their own.
- **Ticks under the tabs** (with the office): **Show names** (the staff's names), **Project on screens** (the project's name above
  each desk's computer) and **Show general chit-chat** (the office banter in Thoughts; unticked, Thoughts keeps only what
  the threads are doing). All three are ticked until you untick them. Kept in this
  browser.
- **Needs attention** (right panel, first tab): every thread whose last reply asked you something, longest waiting first. Press
  "Answered: take off the list" on the card once you have dealt with it; it comes back if they ask again.
- **A person's card** shows their name with **EDIT** beside it (their name and look, TOMLIN's look editor; both belong
  to the seat), **Open in Claude** (opens their thread in the Claude desktop app), their project and seat, what they are
  doing now and for how long, their recent messages, their last few steps, what they asked, and **Earnings**: one line
  with today's tokens that opens to their helpers and the tokens they wrote (today, since the office opened, before it
  opened, all time).
- **List** shows everyone as tiles (up to 5 across): picture and name, then project and what they are doing.
- **Favourites** (third tab): each project with a favourite, its name as a subtitle and its favourite staff in a row.
  Star a person with **Favourite** on their card, or everyone in their project with **Favourite project**. A favourite
  who goes home stays at the office instead: they lie on a beach towel until their next thread starts, then walk back
  to their desk. The star belongs to the seat, so the next handover thread in that seat is a favourite too. A
  favourite who has gone home has a small **Hide** box (off the tab and the beach; "Show hidden" brings them back).
- **Staff rewards** (right panel, second tab; "Spending balance" at the top right opens it): the shop that furnishes the
  office. The meeting room and the lounge start locked: dark, with a padlock on the door. Click one to see what it costs
  and unlock it (the lounge 10M tokens, the meeting room 20M). Until then Staff rewards says "Room not available" for
  it, with an Unlock button, instead of its furniture.
- **Life in the office:** a courier brings each treat to the front door, the IT tech walks over and unlocks a room you
  buy, and a fitter carries each new piece of furniture in. The staff wave a thank-you, try out what is new, and the
  ones waiting for your answer take a short break in the lounge or on a deck chair, then come back. Pet rocks and
  rubber ducks sit on the desks (hover for their names); the ducks go to meetings, and a run of bugs calls the council
  of ducks. Ice creams and cake come to the kitchen table like the other treats, and desk cacti, a wall clock that
  keeps the real time, a water cooler and an inflatable flamingo on the sea fill the rows three across. Buy everything
  and treat the team to each treat once, and the trophy case (World's Best Boss) arrives.
- **The arcade machine** (lounge, once bought): click it to play Tetris, Lunar Lander or Moon Rover on its own cabinet.
  A game plays while its screen has the keyboard; best scores are kept in this browser.
- **The vending machine** (kitchen): click it and insert a 1M-token coin. Everyone in gets an energy drink and, for a
  minute, walks and talks three times as fast, then slumps. Anyone with nothing to do (resting, waiting for a reply, on
  a beach towel) dashes from spot to spot around the office and the beach, and goes back when it wears off.
- **The TV** (lounge) stands against the wall, with a bouncing logo that never quite hits a corner.
- **Thoughts** (beside the office): the office chat. Each seat has its own character (shown on their card), with lines
  for what really happened in a thread: tests passed or failed, a commit, a push, the same file edited again, a stopped
  reply, a bug found, working late, two at one desk. Only the kind of event (and a file's short name for "the same
  file again") is used, never text from your threads. A push on a Friday or at the weekend, and failed tests on a
  Monday, get their own lines; "It worked on my desk." always gets its answer; on a Thursday the staff compare their pay
  (their real tokens today). The same words from several people at once ("Thinking it through…") show once, under all
  their names. **Setup › Thoughts chat** picks Everything, Work only (no office chat) or Off.

## Updating

Setup › Update › **Check for a newer version** asks GitHub once (nothing about you is sent) and lists what is new.
**Update now** takes it and restarts the office; your `data/` folder is never touched. It works for a copy made with
`git clone https://github.com/Matthew4509/ai-office-overview.git`; a downloaded zip cannot update itself (download the
new one and copy your `data/` folder across). It refuses, and changes nothing, when files in the folder were changed,
or when it would replace a file of yours that git ignores. Restart waits while an update is being taken.

## The rules

- **The projects folder** is the one set in Setup. Until one is set, the office guesses it from where threads started:
  the folder most of them started in or, when they started in sibling folders (Claude opened in each project's own
  folder), the folder those sit in.
- **One person per thread.** Their desk is the project folder they write files in. With no files written yet, it is
  the folder their first message says START HERE in, then the folder they are working in.
- **Consultants.** Work in the projects folder itself, or in two or more projects (an audit), makes a Consultant.
- **Seats keep the name.** The first thread in a folder sits in seat 1 and is called after the folder. A second thread
  there at the same time is seat 2 ("ai office overview 2"), sitting at the same desk on an extended table. Change nickname
  names a seat for good: the next handover thread in that folder sits in the lowest free seat and is that person again.
- **Gone home.** After an hour with nothing happening (Setup can change this) a thread goes home and frees its seat. If
  its last reply asked something, it stays on Needs attention (marked gone home) for up to 7 days.
- **Thinking.** A thread waiting on Claude for 15 seconds or more is thinking. Once the meeting room has a table, a long
  think goes there, and everyone who has finished comes to help.
- **Helpers** (subagents) earn for their thread only when they write files or run commands that change something.
- **Deleted threads.** A thread deleted in Claude keeps its person, nickname and tokens: the office keeps its own record
  in `data/`.
- **The purse** is every output token Claude writes from the day the office opened, less what was spent. Prices are
  TOMLIN's x 20, scaled to the output tokens a day of Claude Code work writes.

## Easy or advanced setup

- **Easy** (the default): the office reads the transcripts every 3 seconds. Nothing in Claude is changed. "Needs you"
  is worked out from the last reply, and a permission prompt may not show.
- **Advanced** (Setup > Turn on advanced setup): adds three hooks to Claude Code's settings file
  (`~/.claude/settings.json`): on a new message, a permission prompt, and a finished reply. Claude then tells the office
  straight away. Hooks you already have stay as they are, a copy of the file is saved first, and Go back to easy setup
  takes out only the office's three. Each hook runs `hook.mjs`, which sends only to 127.0.0.1 and prints nothing.
  It is refused when the office's folder path holds a `$`, a backtick, a `"` or a `%`, which the hook runner would read
  as part of a command: move the office to a plainer folder first.

## Helping someone set it up

Agents (Claude and others) helping a user, for example to turn on advanced setup (hooks): read **AGENTS.md** first.

## Files

- `server.mjs`: the small server (127.0.0.1:8860 only).
- `src/transcript.mjs` reads one transcript; `src/people.mjs` has the folder, seat and state rules; `src/office.mjs`
  keeps the ledger and makes the snapshot; `src/shop.mjs` is the shop; `src/setup.mjs` does easy and advanced setup;
  `src/update.mjs` is Setup › Update.
- `public/`: the page. `office.js` and `look.js` are adapted from TOMLIN's office and staff looks;
  `banter.js` has the office chat's characters and lines; `sun.js` works out sunrise and sunset for the Auto colours
  (the server runs it too, so the page comes in its colours); `arcade.js` is the arcade machine's three games.
- `hook.mjs`: the advanced-setup hook.
- `AGENTS.md` (and `CLAUDE.md`, which points Claude Code to it): how an agent helps set up hooks safely.
- `data/` (made on first start, not shipped): settings, nicknames, the ledger, purchases, and where each transcript was
  read to.
- `test/`: `npm test`.
- `tools/head-office-check.mjs`: compares this app with AI Head Office Overview's office, which is the main copy.
  `tools/head-office-differences.json` lists every difference left, each marked as on purpose, to bring here, or ahead
  here. Run `node tools/head-office-check.mjs [path to Head Office's office folder]`: it says "Everything left is on the
  list", or names what changed since. `--show <file>` prints one file's differences, and `--accept <file>` records them
  once sorted.

## Settings for testing

- `PORT`: default 8860.
- `AI_OFFICE_DATA`: the office's own folder (default `data/`). Use a scratch folder to look without opening the
  office.
- `AI_OFFICE_TRANSCRIPTS`: where the transcripts are (default `~/.claude/projects`).
- `AI_OFFICE_SETTINGS`: the Claude settings file advanced setup changes (default `~/.claude/settings.json`). Point it
  at a copy when testing.

## Licence

The office drawing and the staff looks come from TOMLIN (PolyForm Noncommercial 1.0.0), by the same owner.
