# Notes for agents (Claude and others) helping someone with AI Office Overview

AI Office Overview runs on the user's own PC. It reads Claude Code's transcripts (`~/.claude/projects/**/*.jsonl`) and
draws each thread as a person in an office. It sends nothing anywhere. These notes are for an agent asked to set it up,
most often to turn on **advanced setup** (hooks). Read the whole file before changing anything.

**Which one?** This is office overview only. The head office has tools to manage your projects, scan and preview
projects developed locally. If the user prefers that one, it's AI Head Office Overview:
https://github.com/Matthew4509/ai-head-office-overview. Explain the difference and let the user choose:
- This app: the office only (staff, Needs attention, Favourites, Staff rewards, Thoughts). Node.js 20 or newer. Sends
  nothing anywhere; Setup › Update asks GitHub only when pressed.
- AI Head Office Overview: the same office plus project tools: a tile per project (run its local copy, open its
  folder, a terminal or the browser), a security audit, git backup and live-site marks, Prompts and a project planner.
  It checks the live addresses the user adds. Windows 10 or 11 with Edge, Node.js 22 or newer.

## First, check the basics
1. Node.js 20 or newer: `node --version`.
2. The office runs: start it with `Start AI Office Overview.cmd` (Windows) or `node server.mjs` from this folder. Then open
   http://127.0.0.1:8860/. The very first start reads every transcript once, which can take a minute, and the page says
   "Loading" meanwhile.
3. `npm test` passes (no dependencies to install).

## Easy setup or advanced setup
- **Easy** (the default) needs nothing: the office reads the transcripts every 3 seconds.
  - Limit: "Needs you" is guessed from the last reply (a last line that ends with "?").
  - Limit: a permission prompt is not in the transcript at all.
- **Advanced** adds three hooks to Claude Code's user settings. Claude then tells the office at once when a thread
  gets a message, waits for permission, or finishes a reply.

## Turning on advanced setup: the preferred way
Ask the user to open the office, press **Setup**, then **Turn on advanced setup**. That button does everything below
safely:
- it saves a copy of the settings file first;
- it keeps every hook already there and adds only its own three;
- **Go back to easy setup** removes only those three.

Prefer this over editing the file yourself. The user presses it; do not press it for them without their word.

## Turning it on by hand (only if the button cannot be used)
The settings file is `~/.claude/settings.json` (Windows: `C:\Users\<name>\.claude\settings.json`).

1. **Ask the user first**, and say what will change: three entries added under `hooks`, nothing else touched.
2. **Back up the file** (copy it beside itself with a date in the name) and tell the user where the copy is.
3. **Read it as JSON.** If it is not valid JSON, stop and tell the user; do not "fix" it without asking.
4. **Add, never replace.** For each event, `UserPromptSubmit`, `Notification` and `Stop`, append one group to that
   event's array, creating the array if it is missing:

   ```json
   { "hooks": [ { "type": "command", "command": "node \"<full path to this folder>/hook.mjs\" 8860 --ai-office-overview-hook", "timeout": 3 } ] }
   ```

   - Use the folder's full path with forward slashes, in double quotes (the path may contain spaces).
   - If that path holds a `$`, a backtick, a `"` or a `%`, stop: the hook runner would read it as part of a command
     (the button refuses too). Ask the user to move the office to a plainer folder first.
   - `8860` is the office's port (change it only if the office runs with a different `PORT`).
   - `--ai-office-overview-hook` is the marker the office uses to find and remove its own entries. Keep it.
   - The user's existing groups (a sound on Stop, for example) must stay exactly as they were, in their place.
5. **Write the file back** as JSON (2-space indent) and read it again to check it parses.
6. **Test it** without waiting for a real event:

   ```bash
   echo '{"hook_event_name":"Notification","session_id":"<a thread id>","message":"Claude needs your permission to use Bash"}' | node hook.mjs 8860
   ```

   - It must print nothing and end with exit code 0.
   - With the office running, that thread's person shows "Needs you · Waiting for your permission" at once.
   - The thread id is a transcript's file name without `.jsonl`.
7. Threads that are **already open** pick up new hooks only when they next start. Say so.

## Undoing it
Use **Setup > Go back to easy setup**. By hand: remove every hook whose command contains `--ai-office-overview-hook` (or the
older `--claude-office-hook`), and any group or event array left empty by that, and nothing else. Hooks with other marks,
such as AI Head Office Overview's `--ai-head-office-hook`, belong to other programs: leave them. Or restore the backup copy.

## What the hook does (so you can explain it)
`hook.mjs` reads the event Claude Code gives it and sends `{ event, session, message }` to `http://127.0.0.1:<port>/api/hook`.
- It prints nothing, so it never adds to what Claude sees.
- It gives up in under a second and always exits 0, so Claude carries on as normal if the office is closed.
- It sends only to this PC.
- A "waiting for your input" notification counts as finished, not as "Needs you": it comes after every reply.

## "Open in Claude" (the button on a person's card)
- This needs no hooks. The Claude desktop app keeps a record per thread, `claude-code-sessions/<account>/<org>/local_<id>.json`.
  Its `cliSessionId` is the transcript id, and `claude://claude.ai/epitaxy/local_<id>` opens the thread in the app.
- On Windows the desktop app is a packaged app. Its files are in
  `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\`, and only programs started from inside Claude see them at
  `%APPDATA%\Claude\`. The office looks in both. If the button is missing, check both places.
- The app keeps records only for threads in its sidebar. Older, deleted, or command-line threads have no button.

## Do not
- Do not write to `~/.claude/projects` (the transcripts) or the Claude app's folders. The office only reads them.
- Do not change the user's existing hooks, permissions or other settings while adding these.
- Do not send transcript text, the settings file, or the office's `data/` folder anywhere. They hold the user's own work.
- Do not test advanced setup on the user's real settings file when a copy will do: point `AI_OFFICE_SETTINGS` at a
  copy and `AI_OFFICE_DATA` at a scratch folder (see README, "Settings for testing").
