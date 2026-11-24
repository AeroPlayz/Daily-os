/* Daily OS: all app logic. Data is stored in localStorage (no backend).
   Sections: helpers · state · stats · views · events · init */
'use strict';

/* ---------- Helpers ---------- */
const KEY = 'dailyos.v1';
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-'); return new Date(+y, m - 1, +d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const TODAY = () => ymd(new Date());
const mondayOf = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const fmtLong = s => parse(s).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATS = ['Academics', 'Programming', 'Fitness', 'Personal development', 'Discipline'];
const QUOTES = [
  'Small steps every day beat big plans someday.', 'Discipline is choosing what you want most over what you want now.',
  'You do not rise to your goals. You fall to your habits.', 'Do the work. The motivation will follow.',
  'Be the student your future business needs.', 'One focused hour is worth three distracted ones.',
  'Strong body, sharp mind, steady habits.', 'Boring consistency builds impressive results.',
  'Your phone is a tool. Do not let it use you.', 'Finish today. Tomorrow starts fresh.',
  'Skills compound. Start the clock today.', 'Rest is part of the plan, not a break from it.'
];
// light:true = still shown on Saturday (the lighter rest day)
const DEFAULT_TASKS = [
  ['Academics', 'Deep study session'], ['Academics', 'Homework and revision'],
  ['Academics', 'English writing practice'], ['Academics', 'Nepali writing practice'],
  ['Programming', 'Learn programming'], ['Programming', 'Practice coding or build a small project'],
  ['Fitness', 'Daily workout or physical activity', 1],
  ['Personal development', 'Read for 30–45 minutes', 1], ['Personal development', 'Chess practice', 1],
  ['Personal development', "Rubik's Cube practice", 1], ['Personal development', 'Business and sales learning'],
  ['Discipline', 'Stay within my screen-time limit', 1], ['Discipline', 'No unnecessary scrolling', 1]
].map(([cat, text, light]) => ({ id: uid(), cat, text, light: !!light }));
const DEFAULT_ROUTINE = [
  ['06:00', 'Wake up'], ['06:30', 'Workout'], ['07:15', 'Personal development (reading, chess, cube)'],
  ['08:00', 'Academic study'], ['11:00', 'College begins (11:00 or 11:30)', 1], ['17:00', 'College ends', 1],
  ['18:00', 'Study and programming'], ['20:00', 'Hobbies and reading'],
  ['22:00', 'Prepare for sleep'], ['22:30', 'Sleep']
].map(([time, label, college]) => ({ id: uid(), time, label, college: !!college }));

/* ---------- State ---------- */
let S = load();
const ui = { tab: 'today', date: TODAY(), week: mondayOf(TODAY()), installEvt: null };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.tasks) return raw;
  } catch (e) { /* fall through to defaults */ }
  return fresh();
}
function fresh() {
  return { tasks: DEFAULT_TASKS, routine: DEFAULT_ROUTINE, checks: {}, ent: {}, reflections: {},
    settings: { limit: 120, sundayCollege: true } };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save: storage is full or blocked'); }
}

/* ---------- Stats ---------- */
// Tasks shown on a date: daily ones + one-day ones for that date. Saturday keeps only "light" ones.
function tasksFor(date) {
  const sat = parse(date).getDay() === 6;
  return S.tasks.filter(t => (!t.date || t.date === date) && (!sat || t.light || t.date));
}
function stats(date) {
  const list = tasksFor(date), c = S.checks[date] || {};
  const done = list.filter(t => c[t.id]).length;
  return { done, total: list.length, pct: list.length ? Math.round(done / list.length * 100) : 0 };
}
function weekStats(start) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(start, i); return { d, ...stats(d) }; });
  const done = days.reduce((a, x) => a + x.done, 0);
  const avg = Math.round(days.reduce((a, x) => a + x.pct, 0) / 7);
  return { days, done, avg };
}
function hasCollege(date) {
  const dow = parse(date).getDay();
  return dow === 6 ? false : dow === 0 ? S.settings.sundayCollege : true;
}

/* ---------- Views ---------- */
const bar = (p, cls = '') => `<div class="bar ${cls}"><b style="width:${p}%"></b></div>`;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); };

function dateNav() {
  const isToday = ui.date === TODAY();
  return `<div class="datenav"><button class="ic" data-a="day" data-n="-1" aria-label="Previous day">‹</button>
  <h1>${fmtLong(ui.date)}</h1><button class="ic" data-a="day" data-n="1" aria-label="Next day">›</button></div>
  <p class="mute" style="text-align:center;margin:0 0 8px">${isToday ? 'Today' : `<button class="btn ghost small" data-a="goToday">Back to today</button>`}</p>`;
}

function weekCard(start, detailed) {
  const w = weekStats(start), t = TODAY();
  return `<div class="card"><div class="row"><h2 class="sp">${detailed ? 'Week of ' + fmtLong(start) : 'This week'}</h2>
  <span class="mute">${w.done} habits done</span></div>
  <div class="row"><span class="big">${w.avg}%</span><span class="mute">weekly average</span></div>
  <div class="chart">${w.days.map(x => `<button class="col ${x.d === t ? 'today' : ''}" data-a="openDay" data-d="${x.d}" aria-label="${fmtLong(x.d)} ${x.pct}%">
  <i style="height:${Math.max(x.pct, 3)}%"></i><small>${DAYS[parse(x.d).getDay()]}</small></button>`).join('')}</div></div>`;
}

function viewToday() {
  const d = ui.date, st = stats(d), list = tasksFor(d), c = S.checks[d] || {};
  const sat = parse(d).getDay() === 6;
  const ent = S.ent[d] || 0, lim = S.settings.limit, over = ent > lim;
  const q = QUOTES[Math.floor(parse(d) / 864e5) % QUOTES.length];
  const groups = CATS.map(cat => {
    const items = list.filter(t => t.cat === cat);
    return items.length ? `<h3>${cat}</h3>` + items.map(t => `<div class="task"><label><input type="checkbox" data-a="check" data-id="${t.id}" ${c[t.id] ? 'checked' : ''}>
      <span class="box"></span><span>${esc(t.text)}${t.date ? '<em class="tag">today only</em>' : ''}</span></label>
      <button class="mini" data-a="edit" data-id="${t.id}" aria-label="Edit">✎</button>
      <button class="mini" data-a="del" data-id="${t.id}" aria-label="Delete">✕</button></div>`).join('') : '';
  }).join('');
  return `${dateNav()}
  <div class="card"><p class="quote" style="margin:0">${esc(q)}</p></div>
  <div class="card"><div class="row"><span class="big">${st.pct}%</span><span class="mute sp">${st.done} of ${st.total} done</span></div>
  <div style="margin-top:12px">${bar(st.pct)}</div></div>
  ${sat ? '<div class="note">Saturday is a lighter day. Only the core habits are shown.</div>' : ''}
  <div class="card"><h2>Checklist</h2>${groups || '<p class="mute">No tasks yet. Add one below.</p>'}</div>
  <div class="card"><h2>Add a task</h2>
  <input type="text" id="newText" placeholder="What do you want to get done?" maxlength="80">
  <div class="row" style="margin:10px 0"><select id="newCat">${CATS.map(x => `<option>${x}</option>`).join('')}</select>
  <select id="newRep"><option value="daily">Every day</option><option value="once">This day only</option></select></div>
  <button class="btn" data-a="add" style="width:100%">Add task</button></div>
  <div class="card"><h2>Entertainment time</h2>
  <div class="row"><input type="number" id="ent" min="0" max="1440" value="${ent}" aria-label="Entertainment minutes"><span class="mute">min of ${lim}</span></div>
  <div style="margin:12px 0 8px">${bar(Math.min(100, Math.round(ent / lim * 100)), over ? 'over' : '')}</div>
  <p class="mute" style="margin:0">${over ? 'Over your limit. Close the app and start your next task.' : 'Reminder: no mindless scrolling. Decide before you open an app.'}</p></div>
  ${weekCard(mondayOf(d), false)}`;
}

function viewWeek() {
  const w = weekStats(ui.week), t = TODAY();
  return `<div class="datenav"><button class="ic" data-a="wk" data-n="-7" aria-label="Previous week">‹</button><h1>Weekly progress</h1>
  <button class="ic" data-a="wk" data-n="7" aria-label="Next week">›</button></div>
  ${weekCard(ui.week, true)}
  <div class="card"><h2>Days</h2>${w.days.map(x => `<button class="day" data-a="openDay" data-d="${x.d}">
  <div class="row"><b class="sp">${fmtLong(x.d)}${x.d === t ? '<em class="tag">today</em>' : ''}</b><span class="mute">${x.done}/${x.total} · ${x.pct}%</span></div>
  <div style="margin-top:8px">${bar(x.pct)}</div></button>`).join('')}</div>`;
}

function viewRoutine() {
  const t = TODAY(), dow = parse(t).getDay();
  const note = dow === 6 ? 'Saturday: lighter rest day, no college.' : hasCollege(t) ? 'College today.' : 'No college today.';
  return `<h1>Routine</h1><p class="mute">${note}</p>
  <div class="card switch"><div><b>College on Sundays</b><div class="mute">Turn off when you have no college</div></div>
  <input type="checkbox" data-a="sunday" ${S.settings.sundayCollege ? 'checked' : ''} aria-label="College on Sundays"></div>
  <div class="note">Saturday is a lighter day: no college, and only core habits on the checklist.</div>
  <div class="card"><h2>Daily schedule</h2>${S.routine.map(r => `<div class="rt">
  <input type="time" data-a="rtime" data-id="${r.id}" value="${r.time}" aria-label="Time">
  <input type="text" data-a="rlabel" data-id="${r.id}" value="${esc(r.label)}" maxlength="70" aria-label="Activity">
  <button class="mini" data-a="rdel" data-id="${r.id}" aria-label="Delete">✕</button>
  ${r.college ? `<span></span><span class="mute" style="grid-column:2/4">College block <em class="tag">college days only</em></span>` : ''}</div>`).join('')}
  <div class="row" style="margin-top:14px"><button class="btn" data-a="radd">Add item</button><button class="btn ghost" data-a="rreset">Reset</button></div></div>`;
}

const PROMPTS = [['done', 'What did I accomplish today?'], ['failed', 'What did I fail to complete?'],
  ['distract', 'What distracted me?'], ['improve', 'What will I improve tomorrow?']];
function viewReflect() {
  const r = S.reflections[ui.date] || {};
  const past = Object.keys(S.reflections).filter(k => PROMPTS.some(([f]) => (S.reflections[k][f] || '').trim())).sort().reverse();
  return `${dateNav()}<div class="card"><h2>Daily reflection</h2>${PROMPTS.map(([f, q]) => `<h3>${q}</h3>
  <textarea data-a="reflect" data-f="${f}" maxlength="2000">${esc(r[f] || '')}</textarea>`).join('')}
  <p class="mute" id="saved">Saves automatically.</p></div>
  <div class="card"><h2>Past reflections</h2>${past.length ? past.map(k => `<button class="chip" data-a="openRef" data-d="${k}">${fmtLong(k)}</button>`).join('') : '<p class="mute">Nothing written yet.</p>'}</div>`;
}

function viewData() {
  return `<h1>Data</h1>
  <div class="card"><h2>Screen-time limit</h2><div class="row"><input type="number" id="limit" min="10" max="1440" value="${S.settings.limit}"><span class="mute">minutes per day</span></div></div>
  <div class="card"><h2>Backup</h2><p class="mute">Your data lives only on this device. Export a backup now and then.</p>
  <div class="row"><button class="btn" data-a="export">Export JSON</button><button class="btn ghost" data-a="import">Import JSON</button></div></div>
  ${ui.installEvt ? '<div class="card"><h2>Install</h2><button class="btn" data-a="install">Install Daily OS</button></div>' : ''}
  <div class="card"><h2>Reset</h2><p class="mute">Deletes everything on this device.</p><button class="btn danger" data-a="wipe">Erase all data</button></div>`;
}

const VIEWS = { today: viewToday, week: viewWeek, routine: viewRoutine, reflect: viewReflect, data: viewData };
function render() {
  $('#app').innerHTML = `<div class="view">${VIEWS[ui.tab]()}</div>`;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
}
function go(tab, date) { ui.tab = tab; if (date) { ui.date = date; ui.week = mondayOf(date); } render(); scrollTo(0, 0); }

/* ---------- Events (delegated) ---------- */
const actions = {
  day: el => { ui.date = addDays(ui.date, +el.dataset.n); ui.week = mondayOf(ui.date); render(); },
  goToday: () => { ui.date = TODAY(); ui.week = mondayOf(ui.date); render(); },
  wk: el => { ui.week = addDays(ui.week, +el.dataset.n); render(); },
  openDay: el => go('today', el.dataset.d),
  openRef: el => go('reflect', el.dataset.d),
  check: el => {
    const c = S.checks[ui.date] = S.checks[ui.date] || {};
    el.checked ? c[el.dataset.id] = true : delete c[el.dataset.id];
    save(); render();
  },
  add: () => {
    const text = $('#newText').value.trim();
    if (!text) return toast('Type a task first');
    const t = { id: uid(), cat: $('#newCat').value, text, light: true };
    if ($('#newRep').value === 'once') t.date = ui.date;
    S.tasks.push(t); save(); render(); toast('Task added');
  },
  edit: el => {
    const t = S.tasks.find(x => x.id === el.dataset.id), v = prompt('Edit task', t.text);
    if (v && v.trim()) { t.text = v.trim().slice(0, 80); save(); render(); }
  },
  del: el => {
    const t = S.tasks.find(x => x.id === el.dataset.id);
    if (confirm(`Delete "${t.text}"?`)) { S.tasks = S.tasks.filter(x => x !== t); save(); render(); }
  },
  sunday: el => { S.settings.sundayCollege = el.checked; save(); render(); },
  radd: () => { S.routine.push({ id: uid(), time: '12:00', label: 'New activity', college: false }); save(); render(); },
  rdel: el => { S.routine = S.routine.filter(r => r.id !== el.dataset.id); save(); render(); },
  rreset: () => { if (confirm('Reset routine to the default schedule?')) { S.routine = JSON.parse(JSON.stringify(DEFAULT_ROUTINE)); save(); render(); } },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `daily-os-backup-${TODAY()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Backup downloaded');
  },
  import: () => $('#importFile').click(),
  install: async () => { ui.installEvt.prompt(); await ui.installEvt.userChoice; ui.installEvt = null; render(); },
  wipe: () => { if (confirm('Erase ALL data? This cannot be undone.')) { S = fresh(); save(); render(); toast('Data erased'); } }
};

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) return go(tab.dataset.tab);
  const el = e.target.closest('[data-a]');
  if (el && el.type !== 'checkbox' && actions[el.dataset.a]) actions[el.dataset.a](el);
});
// Checkbox/time/number inputs fire "change"
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.a === 'check' || el.dataset.a === 'sunday') return actions[el.dataset.a](el);
  if (el.dataset.a === 'rtime') { S.routine.find(r => r.id === el.dataset.id).time = el.value; S.routine.sort((a, b) => a.time.localeCompare(b.time)); save(); render(); }
  if (el.dataset.a === 'rlabel') { S.routine.find(r => r.id === el.dataset.id).label = el.value.trim() || 'Activity'; save(); }
  if (el.id === 'ent') { S.ent[ui.date] = Math.max(0, +el.value || 0); save(); render(); }
  if (el.id === 'limit') { S.settings.limit = Math.max(10, +el.value || 120); save(); toast('Limit saved'); }
});
// Reflections save while typing (no re-render, so the keyboard stays open)
document.addEventListener('input', e => {
  if (e.target.dataset.a !== 'reflect') return;
  const r = S.reflections[ui.date] = S.reflections[ui.date] || {};
  r[e.target.dataset.f] = e.target.value; save();
  const s = $('#saved'); if (s) s.textContent = 'Saved';
});
$('#importFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!Array.isArray(d.tasks) || typeof d.checks !== 'object') throw 0;
      if (!confirm('Replace current data with this backup?')) return;
      S = Object.assign(fresh(), d); save(); render(); toast('Backup restored');
    } catch (err) { toast('That file is not a valid Daily OS backup'); }
  };
  rd.readAsText(f); e.target.value = '';
});

/* ---------- PWA + init ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ui.installEvt = e; if (ui.tab === 'data') render(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
save(); render();
