// Setup: one window with tabs, opened by the gear at the top. Setup (the shortcuts, then easy or advanced setup), Office
// (theme, Thoughts chat, the projects folder, the gone-home time), Update (a newer version from GitHub, taken in one
// click), Help (how it works) and About (version, Quit, Uninstall).
'use strict';

(() => {
  const app = window.aiOffice;
  const { el } = app;
  const sheet = document.getElementById('setup');
  const SECTIONS = [['setup', 'Setup'], ['office', 'Office'], ['update', 'Update'], ['help', 'Help'], ['about', 'About']];
  let section = 'setup';
  const said = el('p', { class: 'note check-said', role: 'status', 'aria-live': 'polite' });
  const say = (t) => { said.textContent = t; };
  const fault = (e) => app.faultText(e);
  const btn = (label, onclick, primary = false, extra = {}) => el('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, onclick, ...extra }, label);
  const row = (title, sub, ...acts) => el('div', { class: 'set-row' }, el('div', { class: 'set-txt' }, el('b', { text: title }), sub ? el('span', { class: 'note', text: sub }) : null), el('div', { class: 'row set-acts' }, ...acts));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const close = () => { sheet.hidden = true; };

  async function show(which, then) {
    if (which) section = which;
    // A tab pressed from the keyboard keeps the focus on the (new) tab when the window is drawn again.
    const onTab = sheet.contains(document.activeElement) && document.activeElement.getAttribute('role') === 'tab';
    const tabs = el('div', { class: 'side-tabs', role: 'tablist', 'aria-label': 'Setup' }, SECTIONS.map(([id, name]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(section === id), onclick: () => { say(''); show(id); } }, name)));
    const body = el('div', { class: 'set-body' }, el('p', { class: 'note', text: 'Reading…' }));
    const box = el('div', { class: 'sheet-box wide', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'setup-title' },
      el('h2', { id: 'setup-title', text: 'Setup' }), tabs, said, body,
      el('div', { class: 'row sheet-foot' }, btn('Close', close, true)));
    sheet.replaceChildren(box);
    sheet.hidden = false;
    if (onTab) tabs.querySelector('[aria-selected="true"]')?.focus();
    try { body.replaceChildren(...[await DRAW[section]()].flat().filter(Boolean)); } catch (e) { body.replaceChildren(el('p', { text: fault(e) })); }
    then?.();
  }
  /** Opens the window on one tab; `then` runs once that tab is drawn (the Choose it line focuses the folder box). */
  app.openSetup = (which, then) => { say(''); show(which, then); };

  // ---- Setup: the shortcuts (Start menu, desktop, Start with Windows); then easy or advanced setup (hooks) ----
  const ITEMS = [['startmenu', 'Start menu shortcut', 'AI Office Overview in the Start menu, like any other program.'],
    ['desktop', 'Desktop shortcut', 'Double-click it to open the office.'], ['startup', 'Start with Windows', 'Starts the office quietly when you sign in.']];
  async function drawSetup() {
    const s = await app.api('/api/install');
    const isOn = (k) => !!(s[k]?.exists && s[k].here !== false);
    const moved = ITEMS.filter(([k]) => s[k]?.exists && s[k].here === false).map(([, n]) => n);
    const ticks = ITEMS.map(([k, name, note]) => el('label', { class: 'tick-row' }, el('input', { type: 'checkbox', 'data-k': k, checked: isOn(k), disabled: !!s[k]?.unsupported }), el('span', {}, el('b', { text: name }), el('br'), el('span', { class: 'note', text: s[k]?.unsupported ? `${note} (${s[k].unsupported})` : note }))));
    const st = app.data?.setup || {};
    const advanced = st.mode === 'advanced';
    const heard = st.lastHookAt ? `Last heard from Claude ${new Date(st.lastHookAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Nothing heard from Claude yet since the office started.';
    return [
      el('h3', { text: 'Step 1: shortcuts' }),
      el('p', { class: 'note', text: `Node.js ${s.node.version}${s.bundledNode ? ' (the installer\'s own copy)' : ''}${s.node.ok ? '' : ` is too old (needs ${s.node.min} or newer): quit and run install.cmd, which can update it`}. Ticked = set up, unticked = taken away, for your Windows user only; your projects and settings are not touched.` }),
      ...ticks,
      el('div', { class: 'row' }, btn('Apply', async () => {
        const body = {};
        for (const t of ticks) { const i = t.querySelector('input'); if (!i.disabled && i.checked !== isOn(i.dataset.k)) body[i.dataset.k] = i.checked; }
        if (!Object.keys(body).length) return say('Nothing to change: everything is already as ticked.');
        try {
          await app.api('/api/install', body);
          say(`Setup done: ${ITEMS.filter(([k]) => k in body).map(([k, n]) => `${n} ${body[k] ? 'on' : 'off'}`).join(', ')}.`);
          show('setup');
        } catch (e) { say(fault(e)); }
      }, true)),
      el('p', { class: 'note', text: `The office's folder: ${s.folder}.${moved.length ? ` ${moved.join(' and ')} point${moved.length === 1 ? 's' : ''} at another folder (the office was moved): tick and Apply to point ${moved.length === 1 ? 'it' : 'them'} here.` : ' If you move it, Apply points the shortcuts at the new place.'}` }),
      el('h3', { text: 'Step 2 (advanced): hooks in Claude Code' }),
      el('p', {}, el('b', { text: advanced ? 'Now: advanced setup is on.' : 'Now: easy setup.' }), ` ${heard}`),
      advanced && st.hookHere === false ? el('p', { class: 'note', text: 'The hooks in Claude\'s settings point at another folder or port (the office was moved, or runs on another port), so Claude cannot reach this office with them. Press Turn on advanced setup again to point them here.' }) : null,
      advanced && st.hookHere === false ? el('div', { class: 'row' }, btn('Turn on advanced setup again', async (e) => {
        e.currentTarget.disabled = true;
        try { const r = await app.api('/api/setup', { advanced: true }); await app.refresh(); say(r.unchanged ? 'Nothing needed changing.' : `The hooks now point at this office.${r.backup ? ` A copy of the file from before is at ${r.backup}.` : ''}`); show('setup'); } catch (err) { say(fault(err)); e.currentTarget.disabled = false; }
      }, true)) : null,
      el('p', { text: 'Easy setup (the default) reads the Claude Code transcripts on this PC every 3 seconds. Nothing in Claude is changed. What it cannot do: "Needs you" is worked out from the last reply (a reply whose last lines ask a question), a permission prompt may not show at all, and what someone is doing can be up to 3 seconds behind.' }),
      el('p', { text: `Advanced setup also adds three small hooks to Claude Code's settings file (${st.settingsFile || '~/.claude/settings.json'}): when a thread gets a message, when it waits for your permission, and when it finishes a reply, Claude runs a small script that tells the office straight away. It sends only to this PC (127.0.0.1), prints nothing back to Claude, and gives up in under a second if the office is closed. Hooks you already have stay exactly as they are, and a copy of the file is saved first. Going back to easy setup takes out only the office's three.` }),
      el('div', { class: 'row' }, btn(advanced ? 'Go back to easy setup' : 'Turn on advanced setup', async (e) => {
        e.currentTarget.disabled = true;
        try {
          const r = await app.api('/api/setup', { advanced: !advanced });
          await app.refresh();
          say(r.unchanged ? 'Nothing needed changing.' : advanced
            ? `Advanced setup is off: the office's hooks were taken out of Claude's settings, yours are as they were.${r.backup ? ` A copy of the file from before is at ${r.backup}.` : ''}`
            : `Advanced setup is on. Threads started from now on report straight away (a thread already open picks it up when it next starts).${r.backup ? ` A copy of the file from before is at ${r.backup}.` : ''}`);
          show('setup');
        } catch (err) { say(fault(err)); e.currentTarget.disabled = false; }
      }, !advanced)),
      el('details', {}, el('summary', { text: 'What advanced setup adds to the file' }),
        el('pre', { class: 'code', text: JSON.stringify({ hooks: Object.fromEntries(['UserPromptSubmit', 'Notification', 'Stop'].map((ev) => [ev, [{ hooks: [{ type: 'command', command: 'node "<ai office overview folder>/hook.mjs" 8860 --ai-office-overview-hook', timeout: 3 }] }]])) }, null, 2) })),
    ];
  }

  // ---- Office: theme, the Thoughts chat, the projects folder, the gone-home time ----
  function drawOffice() {
    const st = app.data?.setup || {};
    const rootIn = el('input', { type: 'text', value: st.root || '', 'aria-label': 'Projects folder', spellcheck: 'false' });
    const quietIn = el('input', { type: 'number', min: '5', max: '1440', value: String(st.quietMinutes || 60), 'aria-label': 'Gone-home time in minutes' });
    const save = (body, done) => async (e) => {
      e.preventDefault();
      try { await app.api('/api/settings', body()); await app.refresh(); say(done); } catch (err) { say(fault(err)); }
    };
    // The theme the page was served in is the one in use (the office's choice, or its default).
    const nowTheme = document.documentElement.dataset.themeChoice || 'light';
    const sun = window.officeSun;
    const themeBtn = ([id, name]) => el('button', {
      type: 'button', class: 'btn', 'aria-pressed': String(nowTheme === id),
      onclick: async () => {
        try {
          await sun.theme.choose(id);
          say(id === 'system' ? 'Theme: Match Windows. The office turns dark or light with Windows.' : id === 'auto' ? `Theme: Auto. ${sun.theme.today()}` : `Theme: ${name}.`);
          show('office');
        } catch (err) { say(fault(err)); }
      },
    }, name);
    // The Thoughts chat: everything, work only (no office chat), or off. Speech bubbles in the office stay either way.
    const chat = el('select', { 'aria-label': 'Thoughts chat', onchange: (e) => {
      app.setChatMode?.(e.target.value);
      say({ all: 'Thoughts: work lines and the office chat.', work: 'Thoughts: work only. No office chat, just what the threads are doing.', off: 'Thoughts is off.' }[e.target.value]);
    } }, ...[['all', 'Everything: work and office chat'], ['work', 'Work only: no office chat'], ['off', 'Off']].map(([v, w]) => el('option', { value: v, selected: (app.chatMode?.() ?? 'all') === v }, w)));
    return [
      el('h3', { text: 'Theme' }),
      el('div', { class: 'row', role: 'group', 'aria-label': 'Theme' }, ...[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark'], ['system', 'Match Windows']].map(themeBtn)),
      el('p', { class: 'note', text: `Auto is light from sunrise to sunset and dark at night: ${sun.theme.today()} Dark dims the office for the evening: the page, the rooms and the beach. Match Windows follows Settings › Personalisation › Colours in Windows. The sun, moon and auto switch on the top line does the same.` }),
      el('h3', { text: 'Thoughts chat' }),
      el('div', { class: 'row' }, chat),
      el('p', { class: 'note', text: 'The office chat is the staff\'s banter: each has a character of their own, and every line answers something that really happened in a thread (tests, a commit or push, a bug found, the same file again). Work only keeps what the threads are doing and the plain facts. Kept in this browser.' }),
      el('h3', { text: 'Office settings' }),
      el('form', { class: 'row nick-form', onsubmit: save(() => ({ root: rootIn.value }), 'Projects folder saved.') },
        el('label', { class: 'note', text: 'Projects folder (each folder in it is a project; work in the folder itself makes a Consultant)' }), rootIn, el('button', { type: 'submit', class: 'btn' }, 'Save folder')),
      el('form', { class: 'row nick-form', onsubmit: save(() => ({ quietMinutes: quietIn.value }), 'Gone-home time saved.') },
        el('label', { class: 'note', text: 'Gone home after this many minutes with nothing happening' }), quietIn, el('button', { type: 'submit', class: 'btn' }, 'Save time')),
    ];
  }

  // ---- Update: asks GitHub for a newer office only when Check is pressed, and takes it in one click ----
  const updateBox = el('div', { class: 'update-box', 'aria-live': 'polite' });
  const said2 = (...kids) => updateBox.replaceChildren(...kids.flat().filter(Boolean));
  const updating = () => /Taking|Restarting|Asking/.test(updateBox.textContent);
  const idle = () => said2(el('div', { class: 'row' }, btn('Check for a newer version', check)));
  // After an update the office starts again; the page waits for it and then reloads itself. Any answer at all means
  // it is back (the new run has a new key, so its answer to this page's old key is a refusal, which still counts).
  async function backAgain() {
    said2(el('p', { text: 'Restarting the office with the new version…' }));
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 0; i < 60; i++) {
      try { await fetch('/', { cache: 'no-store' }); return location.reload(); } catch { /* not back yet */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    said2(el('p', { text: 'The office did not come back by itself. Double-click Start AI Office Overview.cmd (or its shortcut) to start it.' }));
  }
  async function take(button) {
    button.disabled = true;
    said2(el('p', { text: 'Taking the update…' }));
    try {
      const r = await app.api('/api/update/pull', {});
      said2(el('p', { text: `Updated${r.newVersion ? ` to ${r.newVersion}` : ''}: ${plural(r.took, 'change', 'changes')} taken (${r.from} to ${r.to}).` }));
      // A refused restart (another tab is taking an update) says so, rather than waiting for a restart that never comes.
      try { await app.api('/api/update/restart', {}); } catch (e) { if (e?.error) return said2(el('p', { text: fault(e) }), el('div', { class: 'row' }, btn('Check again', check))); }
      backAgain();
    } catch (e) { said2(el('p', { text: fault(e) }), el('div', { class: 'row' }, btn('Check again', check))); }
  }
  async function check() {
    said2(el('p', { class: 'note', text: 'Asking GitHub for the newest version…' }));
    let r;
    try { r = await app.api('/api/update/check', {}); } catch (e) { return said2(el('p', { text: fault(e) }), el('div', { class: 'row' }, btn('Check again', check))); }
    const again = btn('Check again', check);
    const where = el('p', { class: 'note', text: `From ${r.remote}, branch ${r.branch}. This copy is at ${r.at}. Checked ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` });
    if (!r.behind) return said2(el('p', {}, el('b', { text: '● You have the newest version.' })), where, el('div', { class: 'row' }, again));
    const list = el('ul', { class: 'update-list' }, r.commits.map((c) => el('li', {}, el('span', { class: 'note', text: `${c.date} ` }), c.text)));
    const blocked = r.changed.length ? `Files here were changed (${r.changed.slice(0, 3).join(', ')}${r.changed.length > 3 ? ', …' : ''}), so it will not update until they are kept or undone.`
      : r.ahead ? `This copy has ${plural(r.ahead, 'saved change', 'saved changes')} of its own, so it cannot simply move forward.` : '';
    const go = btn('Update now', (e) => take(e.currentTarget), true);
    go.title = 'Takes the new version from GitHub, then restarts the office. Your data folder (names, looks, rewards, the ledger) is not touched.';
    said2(el('p', {}, el('b', { text: `▲ ${r.newVersion && r.newVersion !== app.data?.version ? `Version ${r.newVersion} is out` : 'A newer version is out'}: ${plural(r.behind, 'change', 'changes')} since yours.` })),
      list, blocked ? el('p', { text: blocked }) : null, where,
      el('div', { class: 'row' }, blocked ? null : go, again),
      el('p', { class: 'note', text: 'Update now takes it and restarts the office (the page reloads itself). Your data folder is never touched, and nothing here is overwritten: an update that would is refused.' }));
  }
  function drawUpdate() {
    if (!updating() && !updateBox.childElementCount) idle();
    return [
      el('p', { class: 'note', text: `This copy: AI Office Overview ${app.data?.version || ''}. Updates come from GitHub. Check asks GitHub once; nothing about you or your work is sent.` }),
      updateBox,
    ];
  }

  // ---- Help: how it works, what leaves this PC, if something goes wrong ----
  function drawHelp() {
    const h3 = (t) => el('h3', { text: t });
    const p = (t) => el('p', { text: t });
    const li = (...t) => el('ul', {}, t.map((x) => el('li', { text: x })));
    return [
      p('AI Office Overview shows your Claude Code threads as staff in an office. It runs only on this PC.'),
      h3('The office'),
      li('Each Claude thread is one person. They sit at their project\'s desk: the project folder they write files in, or the one their first message says START HERE in. A thread that writes in two or more projects (an audit) is a Consultant.',
        'A name belongs to a seat, not a thread: the first thread in a folder sits in seat 1, a second one at the same time in seat 2 ("<folder> 2"), and so on. EDIT names the seat for good, so the next handover thread in that folder is the same person again.',
        'Working is at the desk. A thread that stopped to ask you something stands up beside the desk with a "?" and goes on the Needs attention list. A long think goes to the meeting room once it has a table, and whoever has finished comes to help. After an hour with nothing happening they go home.',
        'Click someone for their card: what they are doing, their last messages, Open in Claude, EDIT (name and look), the star beside their name (a favourite) and Favourite project.',
        'Staff rewards: as your staff work, the tokens they make can be spent on office improvements. Tokens written before the office opened are shown on each person but cannot be spent.',
        'A thread deleted in Claude keeps its person, nickname and tokens: the office keeps its own record in its data folder.'),
      h3('What leaves this PC'),
      p('Nothing about you or your work. The office reads Claude\'s transcripts and never sends them anywhere. The only request that leaves this PC is the look at GitHub for a newer version when you press Check under Update. A person\'s card shows text from your own threads, so a screenshot of it can show private work.'),
      h3('If something goes wrong'),
      li('The page says the office is not answering: it stopped. Double-click Start AI Office Overview.cmd (or its shortcut); the page catches up by itself.',
        '"Needs Node.js 20 or newer": double-click install.cmd; it offers to install it.',
        'Port 8860 is taken by another program: start it with PORT=8865 (any free port) set, for example in a terminal: set PORT=8865 then node server.mjs.',
        'Your names, looks or rewards are suddenly back to the start: the file that held them could not be read; the office kept it in its data folder as <name>.damaged-….json.'),
      h3('Uninstall'),
      p('About › Uninstall (or uninstall.cmd in the office\'s folder) stops the office, removes its shortcuts and takes its hooks out of Claude\'s settings. Your files stay: delete the office\'s folder yourself to remove it completely. Its data folder holds the names and looks you gave the staff, the rewards you bought and the token ledger. A copy put on this PC by the installer is removed under Settings › Apps instead, which asks before deleting the data folder.'),
    ];
  }

  // ---- About: version, Quit, Uninstall ----
  async function drawAbout() {
    let s = null;
    try { s = await app.api('/api/install'); } catch { /* the folder is then left out */ }
    return [
      row(`AI Office Overview ${app.data?.version || ''}`, `Runs only on this PC (127.0.0.1:${location.port || '8860'}). PolyForm Noncommercial License 1.0.0.${s ? ` Node.js ${s.node.version}${s.bundledNode ? ', the installer\'s own copy' : ''}. Folder: ${s.folder}.` : ''}`),
      row('Quit the office', 'Stops the office. Start it again with Start AI Office Overview.cmd or a shortcut.', btn('Quit', async () => {
        if (!confirm('Quit the office? It stops; this page then has nothing to show.')) return;
        try { await app.api('/api/quit', {}); } catch (e) { if (e?.error?.fault) return say(fault(e)); /* else it is stopping */ }
        document.body.replaceChildren(el('p', { class: 'empty stopped', text: 'The office has stopped. You can close this window.' }));
      })),
      row('Uninstall', 'Stops the office, removes its shortcuts and takes its hooks out of Claude\'s settings. Your files are not deleted.', btn('Uninstall…', async () => {
        if (!confirm('Uninstall AI Office Overview? It stops, its shortcuts are removed and its hooks are taken out of Claude\'s settings. Nothing is deleted: its folder stays, and you can remove it yourself.')) return;
        try {
          const r = await app.api('/api/uninstall', {});
          document.body.replaceChildren(el('div', { class: 'stopped' }, el('h2', { text: 'AI Office Overview is uninstalled' }),
            el('p', { text: 'The shortcuts are gone, the hooks are out, and the office has stopped.' }),
            el('p', { text: `Its files are still in ${r.folder}. Delete that folder to remove it completely; its data folder holds the names and looks you gave the staff, the rewards you bought and the token ledger, so keep a copy of anything you want.` }),
            el('p', { class: 'note', text: 'Changed your mind? Double-click install.cmd in that folder.' })));
        } catch (e) { say(fault(e)); }
      })),
    ];
  }

  const DRAW = { setup: drawSetup, office: drawOffice, update: drawUpdate, help: drawHelp, about: drawAbout };

  document.getElementById('open-setup').addEventListener('click', () => { say(''); show(); });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
})();
