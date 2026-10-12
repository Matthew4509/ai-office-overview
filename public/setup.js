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
      el('h3', { text: 'Office settings' }),
      el('form', { class: 'row nick-form', onsubmit: save(() => ({ root: rootIn.value }), 'Projects folder saved.') },
        el('label', { class: 'note', text: 'Projects folder (each folder in it is a project; work in the folder itself makes a Consultant)' }), rootIn, el('button', { type: 'submit', class: 'btn' }, 'Save folder')),
      el('form', { class: 'row nick-form', onsubmit: save(() => ({ quietMinutes: quietIn.value }), 'Gone-home time saved.') },
        el('label', { class: 'note', text: 'Gone home after this many minutes with nothing happening' }), quietIn, el('button', { type: 'submit', class: 'btn' }, 'Save time')),
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
    draw();
    sheet.hidden = false;
    sheet.querySelector('button, input')?.focus();
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
})();
