'use strict';

/* ---------- Constants ---------- */
const KEY = 'fittrack.v1';

const EXERCISES = [
  'Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Push-up', 'Dips',
  'Squat', 'Front Squat', 'Leg Press', 'Lunge', 'Leg Extension', 'Leg Curl', 'Calf Raise',
  'Deadlift', 'Romanian Deadlift', 'Hip Thrust',
  'Barbell Row', 'Pull-up', 'Chin-up', 'Lat Pulldown', 'Seated Cable Row', 'Face Pull',
  'Lateral Raise', 'Bicep Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skull Crusher', 'Plank',
];

const ACTIVITIES = [
  { id: 'run', name: 'Run', icon: '🏃', pace: true },
  { id: 'walk', name: 'Walk', icon: '🚶', pace: true },
  { id: 'cycle', name: 'Cycle', icon: '🚴' },
  { id: 'swim', name: 'Swim', icon: '🏊' },
  { id: 'row', name: 'Row', icon: '🚣' },
  { id: 'hike', name: 'Hike', icon: '🥾', pace: true },
  { id: 'elliptical', name: 'Elliptical', icon: '⚙️' },
  { id: 'other', name: 'Other', icon: '⭐' },
];

const TITLES = { home: 'Today', workout: 'Workout', progress: 'Progress', history: 'History' };

/* ---------- Helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => toKey(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const fmtDate = (k) => fromKey(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const fmtNum = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);
const actMeta = (id) => ACTIVITIES.find((a) => a.id === id) || ACTIVITIES.at(-1);
const fmtSecs = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

/* ---------- State ---------- */
// Sync-friendly model: every workout / weigh-in has an id + updatedAt, deletions leave
// a tombstone in `deleted`, and settings / draft carry their own timestamps in `meta`.
const freshState = () => ({
  settings: { unit: 'kg', dist: 'km', goal: 3, rest: 90 },
  workouts: [], weights: [], custom: [], draft: null,
  deleted: {}, meta: { settingsAt: 0, draftAt: 0 },
});

function normalize(s) {
  const f = freshState();
  return {
    settings: { ...f.settings, ...s.settings },
    workouts: s.workouts || [], weights: s.weights || [], custom: s.custom || [], draft: s.draft || null,
    deleted: s.deleted || {}, meta: { ...f.meta, ...s.meta },
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return normalize(s);
  } catch (e) { /* fall through */ }
  return freshState();
}

let state = load();
let tab = 'home';
let progressEx = null;
let showAllWeights = false;
let snap = { settings: JSON.stringify(state.settings), draft: JSON.stringify(state.draft) };

function persist() {
  snap = { settings: JSON.stringify(state.settings), draft: JSON.stringify(state.draft) };
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (e) { toast('Could not save — storage may be full'); return false; }
}

function save() {
  const now = Date.now();
  if (JSON.stringify(state.settings) !== snap.settings) state.meta.settingsAt = now;
  if (JSON.stringify(state.draft) !== snap.draft) state.meta.draftAt = now;
  if (persist()) window.dispatchEvent(new Event('ft:saved'));
}

const tombstone = (id) => { state.deleted[id] = Date.now(); };

/* ---------- Merging (used by cloud sync) ---------- */
function mergeStates(a, b) {
  a = normalize(a); b = normalize(b);
  const deleted = { ...a.deleted };
  for (const [k, v] of Object.entries(b.deleted)) deleted[k] = Math.max(deleted[k] || 0, v);
  const newer = (x, y) => (x.updatedAt || 0) > (y.updatedAt || 0) || ((x.updatedAt || 0) === (y.updatedAt || 0) && x.id > y.id);
  const list = (x, y) => {
    const m = new Map();
    for (const it of [...x, ...y]) { const c = m.get(it.id); if (!c || newer(it, c)) m.set(it.id, it); }
    return [...m.values()]
      .filter((it) => !(deleted[it.id] && deleted[it.id] >= (it.updatedAt || 0)))
      .sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  };
  // One weigh-in per date: the most recently edited wins.
  const byDate = new Map();
  for (const w of list(a.weights, b.weights)) { const c = byDate.get(w.date); if (!c || newer(w, c)) byDate.set(w.date, w); }
  const sA = a.meta.settingsAt >= b.meta.settingsAt;
  const dA = a.meta.draftAt >= b.meta.draftAt;
  return {
    settings: { ...freshState().settings, ...(sA ? a.settings : b.settings) },
    workouts: list(a.workouts, b.workouts),
    weights: [...byDate.values()].sort((p, q) => (p.id < q.id ? -1 : 1)),
    custom: [...new Set([...a.custom, ...b.custom])].sort(),
    draft: dA ? a.draft : b.draft,
    deleted,
    meta: { settingsAt: Math.max(a.meta.settingsAt, b.meta.settingsAt), draftAt: Math.max(a.meta.draftAt, b.meta.draftAt) },
  };
}

let pendingRender = false;
function applyRemote(remote) {
  const merged = mergeStates(state, remote);
  if (JSON.stringify(merged) === JSON.stringify(state)) return false;
  state = merged;
  persist();
  // Don't yank focus away from a field the user is typing in; re-render once they leave it.
  if (document.activeElement?.closest?.('#view input')) pendingRender = true;
  else if ($('#sheet').hidden) render();
  else pendingRender = true;
  return true;
}

document.addEventListener('focusout', () => setTimeout(() => {
  if (pendingRender && !document.activeElement?.closest?.('#view input') && $('#sheet').hidden) { pendingRender = false; render(); }
}, 50));

window.FT = { getState: () => state, merge: mergeStates, applyRemote };

/* ---------- Derived data ---------- */
const sorted = () => [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
const strength = () => state.workouts.filter((w) => w.type === 'strength');
const volume = (w) => w.exercises.reduce((v, e) => v + e.sets.reduce((s, x) => s + x.weight * x.reps, 0), 0);

function weekCounts() {
  const m = {};
  for (const w of state.workouts) {
    const k = toKey(weekStart(fromKey(w.date)));
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function streaks() {
  const wc = weekCounts(), goal = state.settings.goal;
  const hit = (d) => (wc[toKey(d)] || 0) >= goal;
  let wk = weekStart(new Date()), current = 0;
  if (hit(wk)) current++;           // this week only counts once it's hit; it never breaks the streak
  wk = addDays(wk, -7);
  while (hit(wk)) { current++; wk = addDays(wk, -7); }

  let best = 0, run = 0;
  if (state.workouts.length) {
    const first = state.workouts.reduce((m, w) => (w.date < m ? w.date : m), today());
    for (let d = weekStart(fromKey(first)); d <= new Date(); d = addDays(d, 7)) {
      if (hit(d)) best = Math.max(best, ++run); else run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}

function summary(w) {
  const { unit, dist } = state.settings;
  if (w.type === 'strength') {
    const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
    const vol = volume(w);
    const n = w.exercises.length;
    return `${n} exercise${n === 1 ? '' : 's'} · ${sets} sets${vol ? ` · ${fmtNum(vol)} ${unit}` : ''}`;
  }
  return [w.duration && `${fmtNum(w.duration)} min`, w.distance && `${fmtNum(w.distance)} ${dist}`, w.calories && `${fmtNum(w.calories)} kcal`]
    .filter(Boolean).join(' · ');
}

function describeSets(sets) {
  const u = state.settings.unit;
  const same = sets.every((s) => s.weight === sets[0].weight && s.reps === sets[0].reps);
  if (same) return `${sets.length} × ${sets[0].reps}${sets[0].weight ? ` @ ${fmtNum(sets[0].weight)} ${u}` : ''}`;
  return sets.map((s) => (s.weight ? `${fmtNum(s.weight)}×${s.reps}` : `${s.reps}`)).join(', ');
}

function lastExercise(name) {
  for (const w of sorted()) {
    if (w.type !== 'strength') continue;
    const e = w.exercises.find((x) => x.name === name);
    if (e) return { e, w };
  }
  return null;
}

function exerciseHistory(name) {
  return strength().flatMap((w) => {
    const e = w.exercises.find((x) => x.name === name);
    if (!e) return [];
    return [{
      date: w.date, ts: w.ts,
      best: Math.max(...e.sets.map((s) => e1rm(s.weight, s.reps))),
      top: Math.max(...e.sets.map((s) => s.weight)),
      maxReps: Math.max(...e.sets.map((s) => s.reps)),
    }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);
}

function loggedExercises() {
  const freq = {};
  strength().forEach((w) => w.exercises.forEach((e) => { freq[e.name] = (freq[e.name] || 0) + 1; }));
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b));
}

function allExercises() {
  const logged = loggedExercises();
  const rest = [...new Set([...state.custom, ...EXERCISES])].filter((n) => !logged.includes(n)).sort((a, b) => a.localeCompare(b));
  return [...logged, ...rest];
}

/* ---------- Charts ---------- */
let chartId = 0;
function lineChart(pts, color) {
  if (pts.length < 2) return '<div class="chart-empty">Log at least 2 entries to see a chart</div>';
  const W = 340, H = 170, pl = 38, pr = 10, pt = 12, pb = 22;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) x1 = x0 + 1;
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const py = (y1 - y0) * 0.15 || 1;
  y0 -= py; y1 += py;
  const X = (x) => pl + ((x - x0) / (x1 - x0)) * (W - pl - pr);
  const Y = (y) => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(pts.at(-1).x).toFixed(1)},${H - pb}L${X(pts[0].x).toFixed(1)},${H - pb}Z`;
  const id = `g${++chartId}`;
  const grid = [0, 0.5, 1].map((k) => {
    const v = y0 + py + (y1 - y0 - 2 * py) * k, y = Y(v);
    return `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text x="${pl - 6}" y="${y + 3}" text-anchor="end">${fmtNum(round(v))}</text>`;
  }).join('');
  const lbl = (x) => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const last = pts.at(-1);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#${id})"/>
    <path class="line" d="${line}" stroke="${color}"/>
    <circle cx="${X(last.x)}" cy="${Y(last.y)}" r="4.5" fill="${color}"/>
    <text x="${pl}" y="${H - 6}">${lbl(x0)}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${lbl(Math.max(...xs))}</text>
  </svg>`;
}

/* ---------- Views ---------- */
const empty = (title, text) => `<div class="empty"><b>${title}</b>${text}</div>`;

function workoutRow(w) {
  const icon = w.type === 'strength' ? '🏋️' : actMeta(w.activity).icon;
  return `<button class="row" data-action="open-workout" data-id="${w.id}">
    <span class="row-icon ${w.type}">${icon}</span>
    <span class="row-main"><b>${esc(w.name)}</b><small>${fmtDate(w.date)} · ${esc(summary(w))}</small></span>
    <span class="chev">›</span></button>`;
}

function homeView() {
  const { goal } = state.settings;
  const ws = weekStart(new Date());
  const done = weekCounts()[toKey(ws)] || 0;
  const C = 2 * Math.PI * 42;
  const pct = Math.min(1, done / goal);
  const active = new Set(state.workouts.map((w) => w.date));
  const days = Array.from({ length: 7 }, (_, i) => {
    const k = toKey(addDays(ws, i));
    return `<div class="day${active.has(k) ? ' on' : ''}${k === today() ? ' today' : ''}"><span>${'MTWTFSS'[i]}</span><i></i></div>`;
  }).join('');
  const { current, best } = streaks();
  const month = state.workouts.filter((w) => w.date.startsWith(today().slice(0, 7))).length;
  const left = Math.max(0, goal - done);
  const recent = sorted().slice(0, 5);
  const d = state.draft;

  return `
  <p class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
  ${d ? `<button class="card resume" data-action="tab" data-tab="workout"><span class="pulse"></span>
      <div><b>Workout in progress</b><small>${esc(d.name)} · ${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'}</small></div><span class="chev">›</span></button>` : ''}
  <section class="card goal">
    <div class="ring">
      <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42"/>
      <circle class="prog" cx="50" cy="50" r="42" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 50 50)"/></svg>
      <div class="ring-label"><b>${done}</b><small>of ${goal}</small></div>
    </div>
    <div class="goal-text">
      <h2>${left ? `${left} more to hit your goal` : 'Weekly goal hit! 🎉'}</h2>
      <p class="muted">${goal} workout${goal === 1 ? '' : 's'} a week</p>
      <div class="week">${days}</div>
    </div>
  </section>
  <div class="stats">
    <div class="stat"><b>🔥 ${current}</b><small>week streak</small></div>
    <div class="stat"><b>${best}</b><small>best streak</small></div>
    <div class="stat"><b>${month}</b><small>this month</small></div>
  </div>
  <div class="quick">
    <button class="qa strength" data-action="start-workout"><span class="qi">🏋️</span>${d ? 'Resume' : 'Start'} workout</button>
    <button class="qa cardio" data-action="log-cardio"><span class="qi">🏃</span>Log cardio</button>
    <button class="qa weight" data-action="log-weight"><span class="qi">⚖️</span>Log weight</button>
  </div>
  <h3 class="section">Recent activity</h3>
  ${recent.length ? `<div class="list">${recent.map(workoutRow).join('')}</div>` : empty('No workouts yet', 'Start a workout or log some cardio and it will show up here.')}`;
}

function workoutView() {
  const d = state.draft;
  if (!d) {
    const tpls = [], seen = new Set();
    for (const w of sorted()) {
      if (w.type !== 'strength' || seen.has(w.name.toLowerCase())) continue;
      seen.add(w.name.toLowerCase());
      tpls.push(w);
      if (tpls.length >= 5) break;
    }
    return `
    <section class="card hero">
      <div class="hero-icon">🏋️</div><h2>Ready to train?</h2>
      <p class="muted">Start an empty workout and add exercises as you go.</p>
      <button class="btn primary block" data-action="start-workout">Start empty workout</button>
    </section>
    ${tpls.length ? `<h3 class="section">Repeat a workout</h3><div class="list">${tpls.map((w) => `
      <button class="row" data-action="repeat-workout" data-id="${w.id}"><span class="row-icon strength">↻</span>
      <span class="row-main"><b>${esc(w.name)}</b><small>${esc(w.exercises.map((e) => e.name).join(', '))}</small></span><span class="chev">›</span></button>`).join('')}</div>` : ''}
    <h3 class="section">Other activity</h3>
    <div class="list"><button class="row" data-action="log-cardio"><span class="row-icon cardio">🏃</span>
      <span class="row-main"><b>Log cardio</b><small>Run, ride, swim, walk…</small></span><span class="chev">›</span></button></div>`;
  }

  const u = state.settings.unit;
  return `
  <div class="draft-head">
    <input class="title-input" data-draft="name" value="${esc(d.name)}" aria-label="Workout name" enterkeyhint="done">
    <div class="draft-meta">
      <input type="date" data-draft="date" value="${d.date}" max="${today()}" aria-label="Workout date">
      <span class="timer">⏱ <span id="elapsed">${fmtSecs((Date.now() - d.start) / 1000)}</span></span>
    </div>
  </div>
  ${d.exercises.map((e, ei) => exerciseCard(e, ei, u)).join('') || empty('No exercises yet', 'Add your first exercise to get going.')}
  <button class="btn soft block" data-action="add-exercise">+ Add exercise</button>
  <div class="draft-actions">
    <button class="btn primary block" data-action="finish-workout">Finish workout</button>
    <button class="btn ghost danger block" data-action="discard-workout">Discard workout</button>
  </div>`;
}

function exerciseCard(e, ei, u) {
  const last = lastExercise(e.name);
  return `<section class="card ex">
    <div class="ex-head"><h3>${esc(e.name)}</h3>
      <button class="icon-btn sm" data-action="remove-ex" data-ei="${ei}" aria-label="Remove ${esc(e.name)}">✕</button></div>
    ${last ? `<p class="hint">Last time: ${esc(describeSets(last.e.sets))} · ${fmtDate(last.w.date)}</p>` : ''}
    <div class="sets">
      <div class="set-row head"><span>Set</span><span>${u}</span><span>Reps</span><span></span></div>
      ${e.sets.map((s, si) => `
      <div class="set-row${s.done ? ' done' : ''}">
        <span class="set-n">${si + 1}</span>
        <input inputmode="decimal" placeholder="0" data-set="weight" data-ei="${ei}" data-si="${si}" value="${esc(s.weight)}" aria-label="Set ${si + 1} weight">
        <input inputmode="numeric" placeholder="0" data-set="reps" data-ei="${ei}" data-si="${si}" value="${esc(s.reps)}" aria-label="Set ${si + 1} reps">
        <button class="check" data-action="toggle-set" data-ei="${ei}" data-si="${si}" aria-label="Mark set ${si + 1} done">✓</button>
      </div>`).join('')}
    </div>
    <div class="ex-actions">
      <button class="btn soft sm" data-action="add-set" data-ei="${ei}">+ Add set</button>
      ${e.sets.length ? `<button class="btn ghost sm" data-action="remove-set" data-ei="${ei}">Remove set</button>` : ''}
    </div>
  </section>`;
}

function progressView() {
  const { unit, dist } = state.settings;

  // Body weight
  const ws = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ws.at(-1);
  let delta = '';
  if (latest && ws.length > 1) {
    const cutoff = toKey(addDays(new Date(), -30));
    const base = ws.filter((w) => w.date <= cutoff).at(-1) || ws[0];
    const diff = round(latest.value - base.value);
    delta = `<span class="delta">${diff > 0 ? '+' : ''}${fmtNum(diff)} ${unit} since ${fmtDate(base.date)}</span>`;
  }
  const wList = [...ws].reverse();
  const shown = showAllWeights ? wList : wList.slice(0, 3);
  const weightCard = `
  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">Body weight</p>
      ${latest ? `<div class="big">${fmtNum(latest.value)}<small>${unit}</small></div>${delta}` : '<p class="muted">No weigh-ins yet.</p>'}</div>
      <button class="btn soft sm" data-action="log-weight">+ Log</button>
    </div>
    ${ws.length ? lineChart(ws.slice(-90).map((w) => ({ x: fromKey(w.date).getTime(), y: w.value })), 'var(--weight)') : ''}
    ${shown.map((w) => `<div class="wrow"><span>${fmtDate(w.date)}</span><span><b>${fmtNum(w.value)} ${unit}</b>
      <button class="icon-btn sm" data-action="delete-weight" data-id="${w.id}" aria-label="Delete entry">✕</button></span></div>`).join('')}
    ${wList.length > 3 ? `<button class="link" data-action="toggle-weights">${showAllWeights ? 'Show less' : `Show all ${wList.length} entries`}</button>` : ''}
  </section>`;

  // Strength
  const names = loggedExercises();
  if (!names.includes(progressEx)) progressEx = names[0] || null;
  let strengthCard;
  if (!progressEx) {
    strengthCard = empty('No strength data yet', 'Finish a workout to start tracking personal records.');
  } else {
    const hist = exerciseHistory(progressEx);
    const bw = hist.every((h) => h.top === 0);
    const pts = hist.map((h) => ({ x: fromKey(h.date).getTime(), y: bw ? h.maxReps : round(h.best) }));
    strengthCard = `
    <section class="card">
      <select id="ex-select" class="input select" aria-label="Exercise">
        ${names.map((n) => `<option ${n === progressEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      <p class="muted small chart-cap">${bw ? 'Most reps in a set' : `Estimated 1-rep max (${unit})`} per session</p>
      ${lineChart(pts, 'var(--accent)')}
      <div class="tiles">
        ${bw ? '' : `<div class="tile"><small>Heaviest set</small><b>${fmtNum(Math.max(...hist.map((h) => h.top)))} ${unit}</b></div>
        <div class="tile"><small>Best est. 1RM</small><b>${fmtNum(round(Math.max(...hist.map((h) => h.best))))} ${unit}</b></div>`}
        <div class="tile"><small>Most reps</small><b>${Math.max(...hist.map((h) => h.maxReps))}</b></div>
        <div class="tile"><small>Sessions</small><b>${hist.length}</b></div>
      </div>
    </section>`;
  }

  // Cardio this month
  const month = today().slice(0, 7);
  const cardio = state.workouts.filter((w) => w.type === 'cardio' && w.date.startsWith(month));
  const byAct = {};
  for (const c of cardio) {
    const a = (byAct[c.activity] ??= { n: 0, min: 0, dist: 0 });
    a.n++; a.min += c.duration || 0; a.dist += c.distance || 0;
  }
  const totMin = cardio.reduce((s, c) => s + (c.duration || 0), 0);
  const totDist = cardio.reduce((s, c) => s + (c.distance || 0), 0);
  const cardioCard = cardio.length ? `
  <section class="card">
    <div class="tiles three">
      <div class="tile"><small>Sessions</small><b>${cardio.length}</b></div>
      <div class="tile"><small>Time</small><b>${totMin >= 60 ? `${fmtNum(round(totMin / 60))} h` : `${fmtNum(totMin)} min`}</b></div>
      <div class="tile"><small>Distance</small><b>${fmtNum(round(totDist))} ${dist}</b></div>
    </div>
    ${Object.entries(byAct).map(([id, a]) => `<div class="wrow"><span>${actMeta(id).icon} ${actMeta(id).name}</span>
      <span class="muted">${a.n}× · ${fmtNum(a.min)} min${a.dist ? ` · ${fmtNum(round(a.dist))} ${dist}` : ''}</span></div>`).join('')}
  </section>` : empty('No cardio this month', 'Log a run, ride or walk to see totals here.');

  const totalVol = strength().reduce((s, w) => s + volume(w), 0);
  return `
  ${weightCard}
  <h3 class="section">Strength</h3>${strengthCard}
  <h3 class="section">Cardio this month</h3>${cardioCard}
  <h3 class="section">All time</h3>
  <div class="stats">
    <div class="stat"><b>${state.workouts.length}</b><small>workouts</small></div>
    <div class="stat"><b>${strength().length}</b><small>strength</small></div>
    <div class="stat"><b>${totalVol >= 10000 ? `${fmtNum(round(totalVol / 1000))}k` : fmtNum(totalVol)}</b><small>${unit} lifted</small></div>
  </div>`;
}

function historyView() {
  const list = sorted();
  if (!list.length) return empty('Nothing logged yet', 'Your completed workouts and activities will appear here.');
  const groups = {};
  for (const w of list) {
    const k = fromKey(w.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    (groups[k] ??= []).push(w);
  }
  return Object.entries(groups).map(([m, ws]) =>
    `<h3 class="section">${m} <span class="count">${ws.length}</span></h3><div class="list">${ws.map(workoutRow).join('')}</div>`).join('');
}

const VIEWS = { home: homeView, workout: workoutView, progress: progressView, history: historyView };

function render() {
  $('#view').innerHTML = VIEWS[tab]();
  $('#title').textContent = TITLES[tab];
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

function go(t) {
  tab = t;
  render();
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Sheets ---------- */
function openSheet(html) {
  const s = $('#sheet');
  if (!s.hidden && s.classList.contains('open')) {
    $('.sheet-body', s).innerHTML = html;
    return;
  }
  s.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet-panel" role="dialog" aria-modal="true"><div class="grabber"></div><div class="sheet-body">${html}</div></div>`;
  s.hidden = false;
  void s.offsetWidth; // force layout so the slide-up transition runs
  s.classList.add('open');
}

function closeSheet() {
  const s = $('#sheet');
  s.classList.remove('open');
  setTimeout(() => { if (!s.classList.contains('open')) {
    s.hidden = true; s.innerHTML = '';
    if (pendingRender) { pendingRender = false; render(); }
  } }, 250);
}

function openCardio() {
  const last = sorted().find((w) => w.type === 'cardio');
  const act = last?.activity || 'run';
  const { dist } = state.settings;
  openSheet(`<h2>Log cardio</h2>
  <form data-form="cardio" class="form">
    <div class="chips">${ACTIVITIES.map((a) => `<label class="chip"><input type="radio" name="activity" value="${a.id}" ${a.id === act ? 'checked' : ''}><span>${a.icon} ${a.name}</span></label>`).join('')}</div>
    <div class="grid2">
      <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}"></label>
      <label class="field"><span>Duration (min)</span><input name="duration" inputmode="decimal" placeholder="30" required></label>
      <label class="field"><span>Distance (${dist})</span><input name="distance" inputmode="decimal" placeholder="Optional"></label>
      <label class="field"><span>Calories</span><input name="calories" inputmode="numeric" placeholder="Optional"></label>
    </div>
    <label class="field"><span>Notes</span><input name="notes" placeholder="How did it feel?"></label>
    <button class="btn primary block" type="submit">Save activity</button>
  </form>`);
}

function openWeight() {
  const last = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  openSheet(`<h2>Log body weight</h2>
  <form data-form="weight" class="form">
    <div class="grid2">
      <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}"></label>
      <label class="field"><span>Weight (${state.settings.unit})</span><input name="value" inputmode="decimal" placeholder="0" value="${last ? last.value : ''}" required></label>
    </div>
    <button class="btn primary block" type="submit">Save</button>
  </form>`);
}

function openPicker() {
  openSheet(`<h2>Add exercise</h2>
    <input id="ex-search" class="input" placeholder="Search or type a new exercise" autocomplete="off" enterkeyhint="done">
    <div id="ex-list" class="pick-list"></div>`);
  renderPicker('');
}

function renderPicker(q) {
  const el = $('#ex-list');
  if (!el || !state.draft) return;
  const name = q.trim(), ql = name.toLowerCase();
  const inDraft = new Set(state.draft.exercises.map((e) => e.name));
  const list = allExercises().filter((n) => n.toLowerCase().includes(ql));
  const exact = list.some((n) => n.toLowerCase() === ql);
  el.innerHTML = (ql && !exact ? `<button class="pick new" data-action="pick-exercise" data-name="${esc(name)}">+ Add “${esc(name)}”</button>` : '') +
    list.map((n) => `<button class="pick" data-action="pick-exercise" data-name="${esc(n)}">${esc(n)}${inDraft.has(n) ? '<small>added</small>' : ''}</button>`).join('');
}

function openWorkout(id) {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  const { unit, dist } = state.settings;
  let body;
  if (w.type === 'strength') {
    body = `<div class="tiles three">
        <div class="tile"><small>Duration</small><b>${w.duration ? `${w.duration} min` : '—'}</b></div>
        <div class="tile"><small>Sets</small><b>${w.exercises.reduce((n, e) => n + e.sets.length, 0)}</b></div>
        <div class="tile"><small>Volume</small><b>${fmtNum(volume(w))}</b></div>
      </div>` +
      w.exercises.map((e) => `<div class="detail-ex"><b>${esc(e.name)}</b><div class="set-chips">${e.sets.map((s) =>
        `<span>${s.weight ? `${fmtNum(s.weight)} ${unit} × ` : ''}${s.reps}</span>`).join('')}</div></div>`).join('');
  } else {
    const a = actMeta(w.activity);
    let pace = '—';
    if (w.distance && w.duration) {
      pace = a.pace ? `${fmtSecs((w.duration * 60) / w.distance)} /${dist}` : `${fmtNum(round(w.distance / (w.duration / 60)))} ${dist}/h`;
    }
    body = `<div class="tiles">
        <div class="tile"><small>Duration</small><b>${fmtNum(w.duration)} min</b></div>
        <div class="tile"><small>Distance</small><b>${w.distance ? `${fmtNum(w.distance)} ${dist}` : '—'}</b></div>
        <div class="tile"><small>${a.pace ? 'Pace' : 'Speed'}</small><b>${pace}</b></div>
        <div class="tile"><small>Calories</small><b>${w.calories ? fmtNum(w.calories) : '—'}</b></div>
      </div>${w.notes ? `<p class="notes">${esc(w.notes)}</p>` : ''}`;
  }
  openSheet(`<p class="eyebrow">${fmtDate(w.date)}</p><h2>${esc(w.name)}</h2>${body}
    <div class="sheet-actions">
      ${w.type === 'strength' ? `<button class="btn soft block" data-action="repeat-workout" data-id="${w.id}">Repeat this workout</button>` : ''}
      <button class="btn ghost danger block" data-action="delete-workout" data-id="${w.id}">Delete</button>
    </div>`);
}

function openSettings() {
  const s = state.settings;
  const seg = (action, opts, cur) => `<div class="seg">${opts.map(([v, l]) =>
    `<button class="${cur === v ? 'on' : ''}" data-action="${action}" data-value="${v}">${l}</button>`).join('')}</div>`;
  openSheet(`<h2>Settings</h2>
    <div class="setting"><span>Weekly workout goal</span>
      <div class="stepper"><button data-action="goal" data-delta="-1" aria-label="Decrease">−</button><b>${s.goal}</b><button data-action="goal" data-delta="1" aria-label="Increase">+</button></div></div>
    <div class="setting"><span>Weight unit</span>${seg('unit', [['kg', 'kg'], ['lb', 'lb']], s.unit)}</div>
    <div class="setting"><span>Distance unit</span>${seg('dist', [['km', 'km'], ['mi', 'mi']], s.dist)}</div>
    <div class="setting"><span>Rest timer after each set</span>${seg('rest', [[0, 'Off'], [60, '60s'], [90, '90s'], [120, '2m'], [180, '3m']], s.rest)}</div>
    <h3 class="section">Cloud sync</h3>
    <div id="sync-panel"></div>
    <h3 class="section">Your data</h3>
    <p class="muted small">A copy is always kept on this device so the app works offline. Backups are a good idea even with sync on.</p>
    <div class="grid2"><button class="btn soft" data-action="export">Export backup</button><button class="btn soft" data-action="import">Import backup</button></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
    <button class="btn ghost danger block" data-action="reset">Reset all data</button>`);
  window.FTSync?.renderPanel();
}

/* ---------- Workout draft ---------- */
function defaultName() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning workout' : h < 17 ? 'Afternoon workout' : 'Evening workout';
}

function startDraft(tpl) {
  if (state.draft) return;
  state.draft = {
    id: uid(), name: tpl?.name || defaultName(), date: today(), start: Date.now(),
    exercises: tpl ? tpl.exercises.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ weight: s.weight || '', reps: s.reps, done: false })) })) : [],
  };
  save();
}

function addExercise(name) {
  const d = state.draft;
  if (!d) return;
  if (!EXERCISES.includes(name) && !state.custom.includes(name)) state.custom.push(name);
  const last = lastExercise(name);
  const sets = last ? last.e.sets.map((s) => ({ weight: s.weight || '', reps: s.reps, done: false })) : [{ weight: '', reps: '', done: false }];
  d.exercises.push({ name, sets });
  save();
  render();
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('.card.ex');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function detectPRs(w) {
  const prs = [];
  for (const e of w.exercises) {
    const prev = exerciseHistory(e.name);
    if (!prev.length) continue;
    const before = Math.max(...prev.map((h) => h.best));
    const now = Math.max(...e.sets.map((s) => e1rm(s.weight, s.reps)));
    if (now > before) prs.push(e.name);
  }
  return prs;
}

function finishWorkout() {
  const d = state.draft;
  const exercises = d.exercises
    .map((e) => ({ name: e.name, sets: e.sets.filter((s) => num(s.reps) > 0).map((s) => ({ weight: num(s.weight), reps: Math.round(num(s.reps)) })) }))
    .filter((e) => e.sets.length);
  if (!exercises.length) {
    if (confirm('No sets with reps logged yet. Discard this workout?')) { state.draft = null; save(); stopRest(); go('home'); }
    return;
  }
  const w = {
    id: d.id, type: 'strength', name: d.name.trim() || 'Workout', date: d.date, ts: d.start, updatedAt: Date.now(),
    duration: clamp(Math.round((Date.now() - d.start) / 60000), 1, 300), exercises,
  };
  const prs = detectPRs(w);
  state.workouts.push(w);
  state.draft = null;
  save();
  stopRest();
  go('home');
  toast(prs.length ? `🏆 New PR: ${prs.join(', ')}` : 'Workout saved 💪');
}

/* ---------- Rest timer ---------- */
const rest = { end: 0, timer: null };

function startRest() {
  const el = $('#rest');
  rest.end = Date.now() + state.settings.rest * 1000;
  el.innerHTML = '<span>Rest</span><b></b><button data-action="rest-add">+30s</button><button data-action="skip-rest">Skip</button>';
  el.hidden = false;
  clearInterval(rest.timer);
  rest.timer = setInterval(tickRest, 250);
  tickRest();
}

function tickRest() {
  const left = Math.ceil((rest.end - Date.now()) / 1000);
  if (left <= 0) {
    stopRest();
    navigator.vibrate?.([200, 100, 200]);
    toast('Rest over — next set!');
    return;
  }
  const b = $('#rest b');
  if (b) b.textContent = fmtSecs(left);
}

function stopRest() {
  clearInterval(rest.timer);
  $('#rest').hidden = true;
}

/* ---------- Data import / export ---------- */
async function exportData() {
  const name = `fittrack-backup-${today()}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'FitTrack backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.workouts) || !Array.isArray(data.weights)) throw new Error('bad');
      if (!confirm(`Replace your current data with this backup (${data.workouts.length} workouts, ${data.weights.length} weigh-ins)?`)) return;
      // Imported entries win over anything currently stored; entries not in the backup are removed.
      const now = Date.now(), incoming = normalize(data);
      const keep = new Set([...incoming.workouts, ...incoming.weights].map((x) => x.id));
      const deleted = { ...state.deleted };
      [...state.workouts, ...state.weights].forEach((x) => { if (!keep.has(x.id)) deleted[x.id] = now; });
      [...incoming.workouts, ...incoming.weights].forEach((x) => { x.updatedAt = now; delete deleted[x.id]; });
      state = { ...incoming, deleted, meta: state.meta };
      save();
      closeSheet();
      render();
      toast('Backup restored');
    } catch (e) {
      toast("That file isn't a FitTrack backup");
    }
  };
  r.readAsText(file);
}

function convertUnits(kind, to) {
  const s = state.settings;
  const from = s[kind];
  if (from === to) return;
  if (kind === 'unit') {
    const f = to === 'lb' ? 2.20462 : 1 / 2.20462;
    const now = Date.now();
    strength().forEach((w) => { w.updatedAt = now; w.exercises.forEach((e) => e.sets.forEach((x) => { x.weight = round(x.weight * f); })); });
    state.weights.forEach((w) => { w.value = round(w.value * f); w.updatedAt = now; });
    state.draft?.exercises.forEach((e) => e.sets.forEach((x) => { if (x.weight !== '') x.weight = round(num(x.weight) * f); }));
  } else {
    const f = to === 'mi' ? 0.621371 : 1 / 0.621371;
    const now = Date.now();
    state.workouts.forEach((w) => { if (w.distance) { w.distance = round(w.distance * f, 2); w.updatedAt = now; } });
  }
  s[kind] = to;
}

/* ---------- Actions ---------- */
const draftSet = (d) => state.draft?.exercises[+d.ei]?.sets[+d.si];

const ACTIONS = {
  tab: (d) => go(d.tab),
  settings: openSettings,
  'close-sheet': closeSheet,
  'start-workout': () => { startDraft(); go('workout'); },
  'repeat-workout': (d) => {
    const tpl = state.workouts.find((w) => w.id === d.id);
    if (state.draft) {
      if (!confirm('You already have a workout in progress. Replace it?')) return;
      state.draft = null;
    }
    startDraft(tpl);
    closeSheet();
    go('workout');
  },
  'log-cardio': openCardio,
  'log-weight': openWeight,
  'add-exercise': openPicker,
  'pick-exercise': (d) => { closeSheet(); addExercise(d.name); },
  'add-set': (d) => {
    const sets = state.draft.exercises[+d.ei].sets;
    const last = sets.at(-1);
    sets.push({ weight: last?.weight ?? '', reps: last?.reps ?? '', done: false });
    save(); render();
  },
  'remove-set': (d) => { state.draft.exercises[+d.ei].sets.pop(); save(); render(); },
  'toggle-set': (d) => {
    const s = draftSet(d);
    if (!s) return;
    s.done = !s.done;
    if (s.done && !num(s.reps)) { s.done = false; toast('Enter reps first'); return; }
    if (s.done && state.settings.rest > 0) startRest();
    save(); render();
  },
  'remove-ex': (d) => {
    const e = state.draft.exercises[+d.ei];
    if (e.sets.some((s) => s.done) && !confirm(`Remove ${e.name}?`)) return;
    state.draft.exercises.splice(+d.ei, 1);
    save(); render();
  },
  'finish-workout': finishWorkout,
  'discard-workout': () => {
    if (!confirm('Discard this workout? Nothing will be saved.')) return;
    state.draft = null; save(); stopRest(); go('home');
  },
  'open-workout': (d) => openWorkout(d.id),
  'delete-workout': (d) => {
    if (!confirm('Delete this entry?')) return;
    tombstone(d.id);
    state.workouts = state.workouts.filter((w) => w.id !== d.id);
    save(); closeSheet(); render(); toast('Deleted');
  },
  'delete-weight': (d) => {
    if (!confirm('Delete this weigh-in?')) return;
    tombstone(d.id);
    state.weights = state.weights.filter((w) => w.id !== d.id);
    save(); render();
  },
  'toggle-weights': () => { showAllWeights = !showAllWeights; render(); },
  goal: (d) => { state.settings.goal = clamp(state.settings.goal + Number(d.delta), 1, 14); save(); openSettings(); render(); },
  unit: (d) => { convertUnits('unit', d.value); save(); openSettings(); render(); },
  dist: (d) => { convertUnits('dist', d.value); save(); openSettings(); render(); },
  rest: (d) => { state.settings.rest = Number(d.value); save(); openSettings(); },
  export: exportData,
  import: () => $('#import-file')?.click(),
  reset: () => {
    if (!confirm('Delete ALL workouts, weigh-ins and settings? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? With sync on, this also clears your other devices.')) return;
    const deleted = { ...state.deleted }, now = Date.now();
    [...state.workouts, ...state.weights].forEach((x) => { deleted[x.id] = now; });
    state = { ...freshState(), deleted, meta: state.meta };
    save(); stopRest(); closeSheet(); go('home'); toast('All data cleared');
  },
  'rest-add': () => { rest.end += 30000; tickRest(); },
  'skip-rest': stopRest,
};

const FORMS = {
  cardio: (f) => {
    const duration = num(f.duration);
    if (duration <= 0) { toast('Enter a duration'); return; }
    const a = actMeta(f.activity);
    state.workouts.push({
      id: uid(), type: 'cardio', activity: a.id, name: a.name, date: f.date || today(), ts: Date.now(), updatedAt: Date.now(),
      duration, distance: num(f.distance) || null, calories: Math.round(num(f.calories)) || null, notes: (f.notes || '').trim(),
    });
    save(); closeSheet(); render(); toast(`${a.icon} ${a.name} logged`);
  },
  weight: (f) => {
    const value = num(f.value);
    if (value <= 0) { toast('Enter your weight'); return; }
    const date = f.date || today();
    state.weights = state.weights.filter((w) => w.date !== date);
    state.weights.push({ id: uid(), date, value: round(value), updatedAt: Date.now() });
    save(); closeSheet(); render(); toast('Weight logged');
  },
};

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const fn = ACTIONS[t.dataset.action];
  if (fn) { e.preventDefault(); fn(t.dataset, t); }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.set) {
    const s = draftSet(t.dataset);
    if (s) { s[t.dataset.set] = t.value; save(); }
  } else if (t.dataset.draft && state.draft) {
    state.draft[t.dataset.draft] = t.value;
    save();
  } else if (t.id === 'ex-search') {
    renderPicker(t.value);
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'ex-select') { progressEx = t.value; render(); }
  else if (t.id === 'import-file' && t.files[0]) importData(t.files[0]);
  else if (t.dataset.draft === 'date' && !t.value) { t.value = today(); state.draft.date = today(); save(); }
});

document.addEventListener('submit', (e) => {
  const f = e.target, fn = FORMS[f.dataset.form];
  if (fn) { e.preventDefault(); fn(Object.fromEntries(new FormData(f))); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Enter' && e.target.matches('.title-input, .set-row input')) e.target.blur();
});

document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#sheet').hidden) render(); });

setInterval(() => {
  const el = $('#elapsed');
  if (el && state.draft) el.textContent = fmtSecs((Date.now() - state.draft.start) / 1000);
}, 1000);

/* ---------- Boot ---------- */
render();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
