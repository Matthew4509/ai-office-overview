// Setup: easy or advanced (hooks), the office's own settings, and how it all works. Opened by Setup at the top.
'use strict';

(() => {
  const app = window.aiOffice;
  const el = app.el;
  const sheet = document.getElementById('setup');
  const said = el('p', { class: 'note', 'aria-live': 'polite' });

  const fault = (e) => {
    const f = e?.error || {};
    return f.fault ? `${f.fault} ${f.reason || ''} ${f.wayOut || ''}`.trim() : 'The office did not answer. Check that AI Office Overview is still running.';
  };

  // ---- Update: asks GitHub for a newer office only when Check is pressed, and takes it in one click ----
  const updateBox = el('div', { class: 'update-box', 'aria-live': 'polite' });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const btn = (text, onclick, primary) => el('button', { type: 'button', class: primary ? 'btn primary' : 'btn', onclick }, text);
  const said2 = (...kids) => updateBox.replaceChildren(...kids.flat().filter(Boolean));
  const updating = () => /Taking|Restarting|Asking/.test(updateBox.textContent);
  const idle = () => said2(el('div', { class: 'row' }, btn('Check for a newer version', check)));
  // After an update the office starts again; the page waits for it and then reloads itself.
  async function backAgain() {
    said2(el('p', { text: 'Restarting the office with the new version…' }));
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch('/api/state', { cache: 'no-store' })).ok) return location.reload(); } catch { /* not back yet */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    said2(el('p', { text: 'The office did not come back by itself. Double-click Start AI Office Overview.cmd to start it.' }));
  }
  async function take(button) {
    button.disabled = true;
    said2(el('p', { text: 'Taking the update…' }));
    try {
      const r = await app.api('/api/update/pull', {});
      said2(el('p', { text: `Updated${r.newVersion ? ` to ${r.newVersion}` : ''}: ${plural(r.took, 'change', 'changes')} taken (${r.from} to ${r.to}).` }));
      await app.api('/api/update/restart', {}).catch(() => null);
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

  function draw() {
    const st = app.data?.setup || {};
    const advanced = st.mode === 'advanced';
    const heard = st.lastHookAt ? `Last heard from Claude ${new Date(st.lastHookAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Nothing heard from Claude yet since the office started.';
    const turn = el('button', {
      type: 'button',
      class: advanced ? 'btn' : 'btn primary',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        try {
          const r = await app.api('/api/setup', { advanced: !advanced });
          await app.refresh();
          draw();
          said.textContent = r.unchanged ? 'Nothing needed changing.' : advanced
            ? `Advanced setup is off: the office's hooks were taken out of Claude's settings, yours are as they were.${r.backup ? ` A copy of the file from before is at ${r.backup}.` : ''}`
            : `Advanced setup is on. Threads started from now on report straight away (a thread already open picks it up when it next starts).${r.backup ? ` A copy of the file from before is at ${r.backup}.` : ''}`;
        } catch (err) {
          said.textContent = fault(err);
          e.currentTarget.disabled = false;
        }
      },
    }, advanced ? 'Go back to easy setup' : 'Turn on advanced setup');

    const rootIn = el('input', { type: 'text', value: st.root || '', 'aria-label': 'Projects folder', spellcheck: 'false' });
    const quietIn = el('input', { type: 'number', min: '5', max: '1440', value: String(st.quietMinutes || 60), 'aria-label': 'Gone-home time in minutes' });
    const save = (body, done) => async (e) => {
      e.preventDefault();
      try {
        await app.api('/api/settings', body());
        await app.refresh();
        said.textContent = done;
      } catch (err) {
        said.textContent = fault(err);
      }
    };

    // The theme the page was served in is the one in use (the office's choice, or its default).
    const nowTheme = document.documentElement.dataset.themeChoice || 'light';
    const sun = window.officeSun;
    const themeBtn = ([id, name]) => el('button', {
      type: 'button', class: 'btn', 'aria-pressed': String(nowTheme === id),
      onclick: async () => {
        try {
          await sun.theme.choose(id);
          draw();
          said.textContent = id === 'system' ? 'Theme: Match Windows. The office turns dark or light with Windows.' : id === 'auto' ? `Theme: Auto. ${sun.theme.today()}` : `Theme: ${name}.`;
        } catch (err) { said.textContent = fault(err); }
      },
    }, name);
    // The Thoughts chat: everything, work only (no office chat), or off. Speech bubbles in the office stay either way.
    const chat = el('select', { 'aria-label': 'Thoughts chat', onchange: (e) => {
      app.setChatMode?.(e.target.value);
      said.textContent = { all: 'Thoughts: work lines and the office chat.', work: 'Thoughts: work only. No office chat, just what the threads are doing.', off: 'Thoughts is off.' }[e.target.value];
    } }, ...[['all', 'Everything: work and office chat'], ['work', 'Work only: no office chat'], ['off', 'Off']].map(([v, w]) => el('option', { value: v, selected: (app.chatMode?.() ?? 'all') === v }, w)));

    const box = el('div', { class: 'sheet-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'setup-title' },
      el('h2', { id: 'setup-title', text: 'Setup' }),
      said,
      el('h3', { text: 'How the office knows what Claude is doing' }),
      el('p', {}, el('b', { text: advanced ? 'Now: advanced setup.' : 'Now: easy setup.' }), ` ${heard}`),
      el('p', {}, el('b', { text: 'Easy setup' }), ' (the default) reads the Claude Code transcripts on this PC every 3 seconds. Nothing in Claude is changed. What it cannot do: "Needs you" is worked out from the last reply (a reply whose last lines ask a question), a permission prompt may not show at all, and what someone is doing can be up to 3 seconds behind.'),
      el('p', {}, el('b', { text: 'Advanced setup' }), ` also adds three small hooks to Claude Code's settings file (${st.settingsFile || '~/.claude/settings.json'}): when a thread gets a message, when it waits for your permission, and when it finishes a reply, Claude runs a small script that tells the office straight away. It sends only to this PC (127.0.0.1), prints nothing back to Claude, and gives up in under a second if the office is closed. Hooks you already have stay exactly as they are, and a copy of the file is saved first. Going back to easy setup takes out only the office's three.`),
      el('div', { class: 'row' }, turn),
      el('details', {}, el('summary', { text: 'What advanced setup adds to the file' }),
        el('pre', { class: 'code', text: JSON.stringify({ hooks: Object.fromEntries(['UserPromptSubmit', 'Notification', 'Stop'].map((ev) => [ev, [{ hooks: [{ type: 'command', command: 'node "<ai office overview folder>/hook.mjs" 8860 --ai-office-overview-hook', timeout: 3 }] }]])) }, null, 2) })),
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
      el('h3', { text: 'Update' }),
      el('p', { class: 'note', text: `This copy: AI Office Overview ${app.data?.version || ''}. Updates come from GitHub. Check asks GitHub once; nothing about you or your work is sent.` }),
      updateBox,
      el('h3', { text: 'How it works' }),
      el('ul', {},
        el('li', { text: 'Each Claude thread is one person. They sit at their project\'s desk: the project folder they write files in, or the one their first message says START HERE in. A thread that writes in two or more projects (an audit) is a Consultant.' }),
        el('li', { text: 'A name belongs to a seat, not a thread: the first thread in a folder sits in seat 1, a second one at the same time in seat 2 ("<folder> 2"), and so on. Change nickname names the seat for good, so the next handover thread in that folder is the same person again.' }),
        el('li', { text: 'Working is at the desk. A thread that stopped to ask you something stands up beside the desk with a "?" and goes on the Needs attention list. A long think goes to the meeting room once it has a table, and whoever has finished comes to help. After an hour with nothing happening they go home.' }),
        el('li', { text: 'The purse is every token Claude writes from the day the office opened. Tokens written before then are shown on each person but cannot be spent.' }),
        el('li', { text: 'A thread deleted in Claude keeps its person, nickname and tokens: the office keeps its own record in its data folder.' }),
        el('li', { text: 'Everything stays on this PC. The office reads Claude\'s transcripts and never sends them anywhere. A person\'s card shows text from your own threads, so a screenshot of it can show private work.' })),
      el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', onclick: () => { sheet.hidden = true; } }, 'Close')));
    sheet.replaceChildren(box);
  }

  document.getElementById('open-setup').addEventListener('click', () => {
    said.textContent = '';
    if (!updating()) idle();
    draw();
    sheet.hidden = false;
    sheet.querySelector('button, input')?.focus();
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
})();
