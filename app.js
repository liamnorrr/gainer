'use strict';

/* ---------- Constants ---------- */
const KEY = 'fittrack.v1';
// Bump on every deploy so you can confirm in Settings which version a device is running.
const APP_VERSION = '7 (climbing)';

// Muscle-group tags, in display order. Users can add their own tags too.
const TAGS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Full body'];

// Built-in exercise library: name → tags. Users can edit, delete or add to it.
const DEFAULT_EXERCISES = {
  'Bench Press': ['Chest', 'Triceps'],
  'Incline Dumbbell Press': ['Chest', 'Shoulders'],
  'Dumbbell Fly': ['Chest'],
  'Push-up': ['Chest', 'Triceps'],
  'Dips': ['Chest', 'Triceps'],
  'Overhead Press': ['Shoulders', 'Triceps'],
  'Dumbbell Shoulder Press': ['Shoulders', 'Triceps'],
  'Lateral Raise': ['Shoulders'],
  'Rear Delt Fly': ['Shoulders', 'Back'],
  'Face Pull': ['Shoulders', 'Back'],
  'Shrug': ['Back'],
  'Deadlift': ['Back', 'Legs', 'Hamstrings', 'Glutes'],
  'Barbell Row': ['Back', 'Biceps'],
  'Pull-up': ['Back', 'Biceps'],
  'Chin-up': ['Back', 'Biceps'],
  'Lat Pulldown': ['Back', 'Biceps'],
  'Seated Cable Row': ['Back', 'Biceps'],
  'Bicep Curl': ['Biceps'],
  'Hammer Curl': ['Biceps', 'Forearms'],
  'Preacher Curl': ['Biceps'],
  'Tricep Pushdown': ['Triceps'],
  'Skull Crusher': ['Triceps'],
  'Overhead Tricep Extension': ['Triceps'],
  'Squat': ['Legs', 'Quads', 'Glutes'],
  'Front Squat': ['Legs', 'Quads'],
  'Leg Press': ['Legs', 'Quads', 'Glutes'],
  'Lunge': ['Legs', 'Quads', 'Glutes'],
  'Bulgarian Split Squat': ['Legs', 'Quads', 'Glutes'],
  'Leg Extension': ['Legs', 'Quads'],
  'Leg Curl': ['Legs', 'Hamstrings'],
  'Romanian Deadlift': ['Legs', 'Hamstrings', 'Glutes'],
  'Hip Thrust': ['Legs', 'Glutes'],
  'Calf Raise': ['Legs', 'Calves'],
  'Plank': ['Abs'],
  'Crunch': ['Abs'],
  'Cable Crunch': ['Abs'],
  'Hanging Leg Raise': ['Abs'],
  'Russian Twist': ['Abs'],
  // Climbing strength training
  'Hangboard': ['Forearms', 'Back'],
  'Dead Hang': ['Forearms', 'Back'],
  'Campus Board': ['Forearms', 'Back', 'Biceps'],
  'Wrist Curl': ['Forearms'],
};

const CLIMB_STYLES = ['Bouldering', 'Top rope', 'Lead', 'Auto-belay'];

const ACTIVITIES = [
  { id: 'run', name: 'Run', icon: '🏃', pace: true },
  { id: 'walk', name: 'Walk', icon: '🚶', pace: true },
  { id: 'cycle', name: 'Cycle', icon: '🚴' },
  { id: 'swim', name: 'Swim', icon: '🏊' },
  { id: 'row', name: 'Row', icon: '🚣' },
  { id: 'hike', name: 'Hike', icon: '🥾', pace: true },
  { id: 'elliptical', name: 'Elliptical', icon: '⚙️' },
  { id: 'climb', name: 'Climb', icon: '🧗' },
  { id: 'other', name: 'Other', icon: '⭐' },
];

const TITLES = { home: 'Today', workout: 'Workout', progress: 'Progress', history: 'Calendar', edit: 'Edit workout' };

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
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
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
  workouts: [], weights: [], library: [], draft: null,
  deleted: {}, meta: { settingsAt: 0, draftAt: 0 },
});

// `library` holds the user's own exercises plus edits to built-in ones (same id as the
// built-in, "d:<name>"). Deleting an exercise leaves a tombstone like any other entry.
function normalize(s) {
  const f = freshState();
  const library = [...(s.library || [])];
  // Older versions stored custom exercise names in `custom`: turn them into library entries.
  for (const name of s.custom || []) {
    if (!library.some((x) => x.id === `c:${name}`)) library.push({ id: `c:${name}`, name, tags: [], updatedAt: 0 });
  }
  return {
    settings: { ...f.settings, ...s.settings },
    workouts: s.workouts || [], weights: s.weights || [], library, draft: s.draft || null,
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
    library: list(a.library, b.library),
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

window.FT = { getState: () => state, merge: mergeStates, applyRemote, ask: (o) => ask(o) };

/* ---------- Derived data ---------- */
// Time of day a session happened ("HH:MM") or null. Older strength sessions logged live
// have no `time` field but their start timestamp is exact, so use that.
const timeOf = (w) => (w.time !== undefined ? w.time || null : w.type === 'strength' && w.ts ? hhmm(new Date(w.ts)) : null);
const sorted = () => [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || (timeOf(b) || '').localeCompare(timeOf(a) || '') || b.ts - a.ts);
const tsFor = (date, time) => { const d = fromKey(date); if (time) { const [h, m] = time.split(':').map(Number); d.setHours(h, m); } else d.setHours(12); return d.getTime(); };

// Climbing is stored as an activity (type 'cardio', activity 'climb') but shown as its own kind.
const isClimb = (w) => w.type === 'cardio' && w.activity === 'climb';
const kindOf = (w) => (w.type === 'strength' ? 'strength' : isClimb(w) ? 'climb' : 'cardio');

/* ---------- Exercise library ---------- */
function exLibrary() {
  const own = new Map(state.library.map((x) => [x.id, x]));
  const out = [];
  for (const [name, tags] of Object.entries(DEFAULT_EXERCISES)) {
    const id = `d:${name}`;
    if (own.has(id) || state.deleted[id]) continue;
    out.push({ id, name, tags, builtin: true });
  }
  for (const x of own.values()) out.push({ ...x, builtin: x.id.startsWith('d:') });
  return out.sort((a, b) => byName(a.name, b.name));
}
const findExercise = (name) => exLibrary().find((x) => x.name.toLowerCase() === String(name).toLowerCase());
const exTags = (name) => findExercise(name)?.tags || [];
const tagOrder = (t) => { const i = TAGS.indexOf(t); return i < 0 ? 99 : i; };
const sortTags = (tags) => [...new Set(tags)].sort((a, b) => tagOrder(a) - tagOrder(b) || byName(a, b));
function allTags() { return sortTags([...TAGS, ...exLibrary().flatMap((x) => x.tags)]); }
function workoutTags(w) {
  if (w.type === 'cardio') return [isClimb(w) ? 'Climbing' : 'Cardio'];
  return sortTags(w.exercises.flatMap((e) => exTags(e.name)));
}
const tagChips = (tags) => (tags.length ? `<span class="tag-list">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : '');
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
  if (isClimb(w)) {
    return [w.duration && `${fmtNum(w.duration)} min`, w.climbs && `${w.climbs} climb${w.climbs === 1 ? '' : 's'}`, w.grade && `max ${w.grade}`]
      .filter(Boolean).join(' · ');
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
  return [...new Set(strength().flatMap((w) => w.exercises.map((e) => e.name)))].sort(byName);
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

function workoutRow(w, { showDate = true } = {}) {
  const icon = w.type === 'strength' ? '🏋️' : actMeta(w.activity).icon;
  const t = timeOf(w);
  const when = [showDate && fmtDate(w.date), t && fmtTime(t)].filter(Boolean).join(' · ');
  const tags = w.type === 'strength' ? workoutTags(w) : [];
  return `<button class="row" data-action="open-workout" data-id="${w.id}">
    <span class="row-icon ${kindOf(w)}">${icon}</span>
    <span class="row-main"><b>${esc(w.name)}</b><small>${when ? `${when} · ` : ''}${esc(summary(w))}</small>${tagChips(tags.slice(0, 4))}</span>
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
    <button class="qa climb" data-action="log-cardio" data-activity="climb"><span class="qi">🧗</span>Log climb</button>
    <button class="qa weight" data-action="log-weight"><span class="qi">⚖️</span>Log weight</button>
  </div>
  <h3 class="section">Recent activity</h3>
  ${recent.length ? `<div class="list">${recent.map(workoutRow).join('')}</div>` : empty('No workouts yet', 'Start a workout or log some cardio and it will show up here.')}`;
}

function workoutView() {
  const d = state.draft;
  if (!d) {
    // Most recent session of each distinct workout name, listed A–Z.
    const tpls = [], seen = new Set();
    for (const w of sorted()) {
      if (w.type !== 'strength' || seen.has(w.name.toLowerCase())) continue;
      seen.add(w.name.toLowerCase());
      tpls.push(w);
    }
    tpls.sort((a, b) => byName(a.name, b.name));
    return `
    <section class="card hero">
      <div class="hero-icon">🏋️</div><h2>Ready to train?</h2>
      <p class="muted">Start an empty workout and add exercises as you go.</p>
      <button class="btn primary block" data-action="start-workout">Start empty workout</button>
      <button class="btn ghost block" data-action="log-past">Log a past workout</button>
    </section>
    ${tpls.length ? `<h3 class="section">Repeat a workout</h3><div class="list">${tpls.map((w) => `
      <button class="row" data-action="repeat-workout" data-id="${w.id}"><span class="row-icon strength">↻</span>
      <span class="row-main"><b>${esc(w.name)}</b><small>${esc(w.exercises.map((e) => e.name).join(', '))}</small></span><span class="chev">›</span></button>`).join('')}</div>` : ''}
    <h3 class="section">Other activity</h3>
    <div class="list">
      <button class="row" data-action="log-cardio" data-activity="climb"><span class="row-icon climb">🧗</span>
        <span class="row-main"><b>Log climbing</b><small>Bouldering, top rope, lead</small></span><span class="chev">›</span></button>
      <button class="row" data-action="log-cardio"><span class="row-icon cardio">🏃</span>
        <span class="row-main"><b>Log cardio</b><small>Run, ride, swim, walk…</small></span><span class="chev">›</span></button>
    </div>`;
  }

  const u = state.settings.unit;
  return `
  <div class="draft-head">
    <input class="title-input" data-draft="name" value="${esc(d.name)}" aria-label="Workout name" enterkeyhint="done">
    <div class="draft-meta">
      <span class="meta-inputs">
        <input type="date" data-draft="date" value="${d.date}" max="${today()}" aria-label="Workout date">
        <input type="time" data-draft="time" value="${d.time ?? hhmm(new Date(d.start))}" aria-label="Start time">
      </span>
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

// `live` = the in-progress workout (with ✓ buttons + rest timer); false = editing a saved one.
function exerciseCard(e, ei, u, live = true) {
  const last = live ? lastExercise(e.name) : null;
  return `<section class="card ex">
    <div class="ex-head"><div><h3>${esc(e.name)}</h3>${tagChips(exTags(e.name))}</div>
      <button class="icon-btn sm" data-action="remove-ex" data-ei="${ei}" aria-label="Remove ${esc(e.name)}">✕</button></div>
    ${last ? `<p class="hint">Last time: ${esc(describeSets(last.e.sets))} · ${fmtDate(last.w.date)}</p>` : ''}
    <div class="sets${live ? '' : ' no-check'}">
      <div class="set-row head"><span>Set</span><span>${u}</span><span>Reps</span>${live ? '<span></span>' : ''}</div>
      ${e.sets.map((s, si) => `
      <div class="set-row${s.done && live ? ' done' : ''}">
        <span class="set-n">${si + 1}</span>
        <input inputmode="decimal" placeholder="0" data-set="weight" data-ei="${ei}" data-si="${si}" value="${esc(s.weight)}" aria-label="Set ${si + 1} weight">
        <input inputmode="numeric" placeholder="0" data-set="reps" data-ei="${ei}" data-si="${si}" value="${esc(s.reps)}" aria-label="Set ${si + 1} reps">
        ${live ? `<button class="check" data-action="toggle-set" data-ei="${ei}" data-si="${si}" aria-label="Mark set ${si + 1} done">✓</button>` : ''}
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

/* ---------- Calendar ---------- */
let calMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
let calDay = today();
let calTag = null;

const matchesTag = (w) => !calTag || workoutTags(w).includes(calTag);

function calendarView() {
  const list = sorted().filter(matchesTag);
  const byDay = {};
  for (const w of list) (byDay[w.date] ??= []).push(w);

  // Filter chips: only tags that appear in some session, plus "All".
  const used = sortTags(state.workouts.flatMap(workoutTags));
  const chips = used.length ? `<div class="chip-row">
      <button class="fchip${calTag ? '' : ' on'}" data-action="cal-tag" data-tag="">All</button>
      ${used.map((t) => `<button class="fchip${calTag === t ? ' on' : ''}" data-action="cal-tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>` : '';

  // Month grid starting on Monday, always 6 rows.
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const start = weekStart(calMonth);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i), k = toKey(d);
    const ws = byDay[k] || [];
    const dots = ws.slice(0, 3).map((w) => `<i class="${kindOf(w)}"></i>`).join('') + (ws.length > 3 ? '<i class="more"></i>' : '');
    const cls = [d.getMonth() !== m && 'out', k === today() && 'today', k === calDay && 'sel', ws.length && 'has', k > today() && 'future'].filter(Boolean).join(' ');
    return `<button class="cal-cell ${cls}" data-action="cal-day" data-date="${k}" aria-label="${fmtDate(k)}${ws.length ? `, ${ws.length} session${ws.length === 1 ? '' : 's'}` : ''}">
      <span>${d.getDate()}</span><span class="dots">${dots}</span></button>`;
  }).join('');
  const monthKey = `${y}-${pad(m + 1)}`;
  const monthCount = list.filter((w) => w.date.startsWith(monthKey)).length;
  const activeDays = new Set(list.filter((w) => w.date.startsWith(monthKey)).map((w) => w.date)).size;

  // Selected day, earliest first; sessions without a time go last.
  const dayList = [...(byDay[calDay] || [])].sort((a, b) => (timeOf(a) || '99').localeCompare(timeOf(b) || '99'));
  const dayLabel = fromKey(calDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // Everything else below, grouped by month.
  const groups = {};
  for (const w of list) (groups[fromKey(w.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })] ??= []).push(w);

  return `
  ${chips}
  <section class="card cal">
    <div class="cal-head">
      <button class="icon-btn" data-action="cal-prev" aria-label="Previous month">‹</button>
      <div class="cal-title"><b>${calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
        <small>${monthCount} session${monthCount === 1 ? '' : 's'} · ${activeDays} active day${activeDays === 1 ? '' : 's'}</small></div>
      <button class="icon-btn" data-action="cal-next" aria-label="Next month">›</button>
    </div>
    <div class="cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="cal-dow">${d}</span>`).join('')}${cells}</div>
    <div class="cal-legend"><span><i class="strength"></i>Strength</span><span><i class="cardio"></i>Cardio</span><span><i class="climb"></i>Climbing</span>
      ${toKey(calMonth) !== toKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) ? '<button class="link" data-action="cal-today">Today</button>' : ''}</div>
  </section>

  <div class="day-head"><h3 class="section">${dayLabel}</h3>
    ${calDay <= today() ? `<button class="btn soft sm" data-action="add-on-day" data-date="${calDay}">+ Add</button>` : ''}</div>
  ${dayList.length ? `<div class="list">${dayList.map((w) => workoutRow(w, { showDate: false })).join('')}</div>`
    : `<div class="empty small-empty">${calTag ? `No ${esc(calTag)} sessions on this day.` : 'Nothing logged on this day.'}</div>`}

  ${list.length ? `<h3 class="section">${calTag ? `All ${esc(calTag)} sessions` : 'All sessions'}</h3>` : ''}
  ${Object.entries(groups).map(([mo, ws]) => `<p class="month-label">${mo} <span class="count">${ws.length}</span></p><div class="list">${ws.map((w) => workoutRow(w)).join('')}</div>`).join('')}`;
}

/* ---------- Edit / log past workout ---------- */
// `editing` is an in-memory copy of a strength workout being edited (or created after the fact).
// Nothing is written until Save.
let editing = null;

function startEdit(w, date) {
  editing = w
    ? { id: w.id, isNew: false, name: w.name, date: w.date, time: timeOf(w) || '', duration: w.duration ?? '', notes: w.notes || '', ts: w.ts,
        exercises: w.exercises.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ weight: s.weight || '', reps: s.reps })) })) }
    : { id: null, isNew: true, name: 'Workout', date: date || today(), time: '', duration: '', notes: '', exercises: [] };
  editing.returnTab = tab === 'edit' ? 'history' : tab;
  closeSheet();
  go('edit');
}

function editView() {
  const e = editing;
  if (!e) return empty('Nothing to edit', '');
  const u = state.settings.unit;
  return `
  <div class="draft-head">
    <input class="title-input" data-edit="name" value="${esc(e.name)}" aria-label="Workout name" enterkeyhint="done">
  </div>
  <div class="edit-meta">
    <label class="field"><span>Date</span><input type="date" data-edit="date" value="${e.date}" max="${today()}"></label>
    <label class="field"><span>Time <em>optional</em></span><input type="time" data-edit="time" value="${esc(e.time)}"></label>
    <label class="field"><span>Duration (min) <em>optional</em></span><input inputmode="numeric" data-edit="duration" value="${esc(e.duration)}" placeholder="—"></label>
  </div>
  ${e.exercises.map((x, ei) => exerciseCard(x, ei, u, false)).join('') || empty('No exercises yet', 'Add the exercises you did, then fill in your sets.')}
  <button class="btn soft block" data-action="add-exercise">+ Add exercise</button>
  <label class="field notes-field"><span>Notes <em>optional</em></span><input data-edit="notes" value="${esc(e.notes)}" placeholder="How did it go?"></label>
  <div class="draft-actions">
    <button class="btn primary block" data-action="save-edit">${e.isNew ? 'Save workout' : 'Save changes'}</button>
    <button class="btn ghost block" data-action="cancel-edit">Cancel</button>
    ${e.isNew ? '' : `<button class="btn ghost danger block" data-action="delete-workout" data-id="${e.id}">Delete workout</button>`}
  </div>`;
}

function saveEdit() {
  const e = editing;
  const exercises = e.exercises
    .map((x) => ({ name: x.name, sets: x.sets.filter((s) => num(s.reps) > 0).map((s) => ({ weight: num(s.weight), reps: Math.round(num(s.reps)) })) }))
    .filter((x) => x.sets.length);
  if (!exercises.length) { toast('Add at least one set with reps'); return; }
  if (!e.date) { toast('Pick a date'); return; }
  const now = Date.now();
  const w = {
    id: e.id || uid(), type: 'strength', name: e.name.trim() || 'Workout', date: e.date, time: e.time || null,
    ts: e.isNew || !e.ts ? tsFor(e.date, e.time) : e.ts, updatedAt: now,
    duration: num(e.duration) > 0 ? Math.round(num(e.duration)) : null, notes: e.notes.trim(), exercises,
  };
  state.workouts = state.workouts.filter((x) => x.id !== w.id);
  state.workouts.push(w);
  save();
  const back = e.returnTab;
  editing = null;
  calDay = w.date; calMonth = new Date(fromKey(w.date).getFullYear(), fromKey(w.date).getMonth(), 1);
  go(back === 'edit' ? 'history' : back);
  toast(e.isNew ? 'Workout added' : 'Changes saved');
}

const VIEWS = { home: homeView, workout: workoutView, progress: progressView, history: calendarView, edit: editView };

function render() {
  if (tab === 'edit' && !editing) tab = 'history';
  $('#view').innerHTML = VIEWS[tab]();
  centerActiveChip($('#view'));
  $('#title').textContent = tab === 'edit' && editing?.isNew ? 'Log workout' : TITLES[tab];
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === (tab === 'edit' ? editing?.returnTab : tab)));
}

// Keep the selected filter chip visible after a re-render resets the row's scroll.
function centerActiveChip(root) {
  const on = root?.querySelector('.chip-row .fchip.on');
  if (!on) return;
  const row = on.parentElement;
  row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
}

function go(t) {
  if (tab === 'edit' && t !== 'edit') editing = null;   // leaving the editor via the nav bar discards it
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
let sheetOnClose = null;   // called once when the sheet is dismissed (used by ask())
let confirmSettle = null;

function openSheet(html) {
  const s = $('#sheet');
  if (!s.hidden && s.classList.contains('open')) {
    $('.sheet-body', s).innerHTML = html;
    $('.sheet-panel', s).scrollTop = 0;
    return;
  }
  s.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet-panel" role="dialog" aria-modal="true"><div class="grabber-zone"><div class="grabber"></div></div><div class="sheet-body">${html}</div></div>`;
  // Direct listener (not delegated): iOS Safari doesn't deliver delegated clicks on plain divs.
  $('.sheet-backdrop', s).addEventListener('click', closeSheet);
  attachSwipe(s);
  s.hidden = false;
  void s.offsetWidth; // force layout so the slide-up transition runs
  s.classList.add('open');
}

// Drag the sheet down to dismiss it: from the handle, or anywhere once its content is scrolled to the top.
function attachSwipe(s) {
  const panel = $('.sheet-panel', s), backdrop = $('.sheet-backdrop', s);
  let tracking = false, dragging = false, startY = 0, dy = 0, lastY = 0, lastT = 0, vel = 0;

  const begin = (y, fromHandle) => {
    if (!fromHandle && panel.scrollTop > 0) return;
    tracking = true; dragging = false; startY = lastY = y; lastT = performance.now(); dy = 0; vel = 0;
  };
  const move = (y, e) => {
    if (!tracking) return;
    const d = y - startY;
    if (!dragging) {
      if (d > 6) { dragging = true; panel.style.transition = 'none'; backdrop.style.transition = 'none'; document.activeElement?.blur?.(); }
      else if (d < -6) { tracking = false; return; }   // scrolling up: let the content scroll
      else return;
    }
    const now = performance.now();
    vel = (y - lastY) / Math.max(1, now - lastT);
    lastY = y; lastT = now;
    dy = Math.max(0, d);
    panel.style.transform = `translateY(${dy}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - dy / panel.offsetHeight));
    if (e?.cancelable) e.preventDefault();
  };
  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    panel.style.transition = ''; backdrop.style.transition = '';
    panel.style.transform = ''; backdrop.style.opacity = '';
    if (dy > Math.min(120, panel.offsetHeight * 0.3) || vel > 0.5) closeSheet();
  };

  panel.addEventListener('touchstart', (e) => begin(e.touches[0].clientY, !!e.target.closest('.grabber-zone')), { passive: true });
  panel.addEventListener('touchmove', (e) => move(e.touches[0].clientY, e), { passive: false });
  panel.addEventListener('touchend', end);
  panel.addEventListener('touchcancel', end);
  // Mouse / trackpad: drag the handle.
  panel.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || !e.target.closest('.grabber-zone')) return;
    begin(e.clientY, true);
    const mv = (ev) => move(ev.clientY, ev);
    const up = () => { end(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
}

// In-app replacement for window.confirm(), which some browsers and home-screen apps silently block.
function ask({ title, text = '', ok = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const settle = (v) => { sheetOnClose = null; confirmSettle = null; resolve(v); };
    openSheet(`<h2>${esc(title)}</h2>${text ? `<p class="confirm-text">${esc(text)}</p>` : ''}
      <div class="sheet-actions">
        <button class="btn ${danger ? 'danger-fill' : 'primary'} block" data-action="confirm-yes">${esc(ok)}</button>
        <button class="btn soft block" data-action="confirm-no">Cancel</button>
      </div>`);
    confirmSettle = settle;
    sheetOnClose = () => settle(false);
  });
}

function closeSheet() {
  const s = $('#sheet');
  const cb = sheetOnClose;
  sheetOnClose = null;
  cb?.();
  s.classList.remove('open');
  setTimeout(() => { if (!s.classList.contains('open')) {
    s.hidden = true; s.innerHTML = '';
    if (pendingRender) { pendingRender = false; render(); }
  } }, 250);
}

// New cardio/climbing entry (optionally on a given past date or with a preset activity), or edit one.
function openCardio(existing = null, date = null, activity = null) {
  const w = existing;
  const act = w?.activity || activity || sorted().find((x) => x.type === 'cardio' && !isClimb(x))?.activity || 'run';
  const { dist } = state.settings;
  const v = (x) => (x === null || x === undefined ? '' : esc(x));
  const style = w?.climbStyle || sorted().find(isClimb)?.climbStyle || 'Bouldering';
  const title = w ? 'Edit activity' : act === 'climb' ? 'Log climbing' : 'Log cardio';
  openSheet(`<h2>${title}</h2>
  <form data-form="cardio" class="form">
    <input type="hidden" name="id" value="${w ? w.id : ''}">
    <div class="chips">${ACTIVITIES.map((a) => `<label class="chip${a.id === 'climb' ? ' climb-chip' : ''}"><input type="radio" name="activity" value="${a.id}" ${a.id === act ? 'checked' : ''}><span>${a.icon} ${a.name}</span></label>`).join('')}</div>
    <div class="climb-only field"><span>Style</span>
      <div class="chips">${CLIMB_STYLES.map((s) => `<label class="chip climb-chip"><input type="radio" name="climbStyle" value="${s}" ${s === style ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div>
    </div>
    <div class="grid2">
      <label class="field"><span>Date</span><input type="date" name="date" value="${w?.date || date || today()}" max="${today()}"></label>
      <label class="field"><span>Time <em>optional</em></span><input type="time" name="time" value="${v(w ? timeOf(w) : '')}"></label>
      <label class="field"><span>Duration (min)</span><input name="duration" inputmode="decimal" placeholder="${act === 'climb' ? '90' : '30'}" value="${v(w?.duration)}" required></label>
      <label class="field not-climb"><span>Distance (${dist})</span><input name="distance" inputmode="decimal" placeholder="Optional" value="${v(w?.distance)}"></label>
      <label class="field climb-only"><span>Climbs <em>optional</em></span><input name="climbs" inputmode="numeric" placeholder="e.g. 12" value="${v(w?.climbs)}"></label>
      <label class="field climb-only"><span>Hardest grade <em>optional</em></span><input name="grade" placeholder="V5, 6b+, 5.11a…" value="${v(w?.grade)}" autocapitalize="characters" autocomplete="off"></label>
      <label class="field"><span>Calories</span><input name="calories" inputmode="numeric" placeholder="Optional" value="${v(w?.calories)}"></label>
    </div>
    <label class="field"><span>Notes</span><input name="notes" placeholder="How did it feel?" value="${v(w?.notes)}"></label>
    <button class="btn primary block" type="submit">${w ? 'Save changes' : 'Save activity'}</button>
    ${w ? `<button class="btn ghost danger block" type="button" data-action="delete-workout" data-id="${w.id}">Delete</button>` : ''}
  </form>`);
}

// Choose what to add on a calendar day.
function openAddOnDay(date) {
  openSheet(`<p class="eyebrow">${fmtDate(date)}</p><h2>Add to this day</h2>
    <div class="list">
      <button class="row" data-action="log-past" data-date="${date}"><span class="row-icon strength">🏋️</span>
        <span class="row-main"><b>Strength workout</b><small>Exercises, sets and reps</small></span><span class="chev">›</span></button>
      <button class="row" data-action="log-cardio" data-date="${date}" data-activity="climb"><span class="row-icon climb">🧗</span>
        <span class="row-main"><b>Climbing</b><small>Bouldering, top rope, lead</small></span><span class="chev">›</span></button>
      <button class="row" data-action="log-cardio" data-date="${date}"><span class="row-icon cardio">🏃</span>
        <span class="row-main"><b>Cardio</b><small>Run, ride, swim, walk…</small></span><span class="chev">›</span></button>
    </div>`);
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

/* ---------- Exercise picker / library ---------- */
// mode 'add': tapping an exercise adds it to the current workout. mode 'manage': tapping edits it.
let picker = { mode: 'add', tag: null, q: '' };

function openPicker(mode = 'add') {
  picker = { mode, tag: picker.mode === mode ? picker.tag : null, q: '' };
  openSheet(`<h2>${mode === 'add' ? 'Add exercise' : 'Exercises'}</h2>
    <input id="ex-search" class="input" placeholder="Search exercises" autocomplete="off" enterkeyhint="done">
    <div id="ex-tags" class="chip-row in-sheet"></div>
    <div id="ex-list" class="pick-list"></div>`);
  renderPicker();
}

function renderPicker() {
  const el = $('#ex-list');
  if (!el) return;
  const name = picker.q.trim(), ql = name.toLowerCase();
  const inSession = new Set((cur()?.exercises || []).map((e) => e.name));
  const lib = exLibrary();
  const list = lib.filter((x) => x.name.toLowerCase().includes(ql) && (!picker.tag || x.tags.includes(picker.tag)));
  const exact = lib.some((x) => x.name.toLowerCase() === ql);
  const tags = sortTags(lib.flatMap((x) => x.tags));
  $('#ex-tags').innerHTML = `<button class="fchip${picker.tag ? '' : ' on'}" data-action="pick-tag" data-tag="">All</button>` +
    tags.map((t) => `<button class="fchip${picker.tag === t ? ' on' : ''}" data-action="pick-tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  centerActiveChip($('#ex-tags').parentElement);
  const editBtn = (x) => `<button class="icon-btn sm" data-action="edit-exercise" data-id="${esc(x.id)}" aria-label="Edit ${esc(x.name)}">✎</button>`;
  el.innerHTML =
    `<button class="pick new" data-action="new-exercise" data-name="${esc(exact ? '' : name)}">+ ${name && !exact ? `Create “${esc(name)}”` : 'New exercise'}</button>` +
    (list.length ? list.map((x) => `<div class="pick-row">
      <button class="pick" data-action="${picker.mode === 'add' ? 'pick-exercise' : 'edit-exercise'}" data-name="${esc(x.name)}" data-id="${esc(x.id)}">
        <span>${esc(x.name)}${inSession.has(x.name) && picker.mode === 'add' ? '<small>added</small>' : ''}</span>
        <span class="pick-tags">${x.tags.length ? x.tags.map(esc).join(' · ') : 'No tags'}</span></button>
      ${picker.mode === 'add' ? editBtn(x) : ''}</div>`).join('')
      : `<p class="muted small pick-empty">No exercises match${picker.tag ? ` in ${esc(picker.tag)}` : ''}.</p>`);
}

// Create or edit an exercise. `after`: 'add' (add to the current workout), or 'picker'/'manage' (go back to that list).
let exFormAfter = 'picker';
function openExerciseForm({ id = null, name = '', after = 'picker' } = {}) {
  exFormAfter = after;
  const x = id ? exLibrary().find((e) => e.id === id) : null;
  const selected = new Set(x?.tags || (picker.tag ? [picker.tag] : []));
  const used = x ? state.workouts.filter((w) => w.type === 'strength' && w.exercises.some((e) => e.name === x.name)).length : 0;
  openSheet(`<h2>${x ? 'Edit exercise' : 'New exercise'}</h2>
  <form data-form="exercise" class="form">
    <input type="hidden" name="id" value="${x ? esc(x.id) : ''}">
    <label class="field"><span>Name</span><input name="name" required value="${esc(x?.name || name)}" placeholder="e.g. Cable Lateral Raise" autocomplete="off"></label>
    <div class="field"><span>Muscle groups</span>
      <div class="chips">${allTags().map((t) => `<label class="chip tag-chip"><input type="checkbox" name="tags" value="${esc(t)}" ${selected.has(t) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>
    </div>
    <label class="field"><span>Add your own tag <em>optional</em></span><input name="newtag" placeholder="e.g. Traps" autocomplete="off"></label>
    ${x && used ? `<p class="muted small">Used in ${used} workout${used === 1 ? '' : 's'}. Renaming updates them too.</p>` : ''}
    <button class="btn primary block" type="submit">${x ? 'Save exercise' : after === 'add' ? 'Create and add' : 'Create exercise'}</button>
    ${x ? `<button class="btn ghost danger block" type="button" data-action="delete-exercise" data-id="${esc(x.id)}">Delete exercise</button>` : ''}
  </form>`);
}

function saveExercise(f, fd) {
  const name = (f.name || '').trim().replace(/\s+/g, ' ');
  if (!name) { toast('Give the exercise a name'); return; }
  const tags = fd.getAll('tags');
  const extra = (f.newtag || '').trim().replace(/\s+/g, ' ');
  if (extra) tags.push(extra.charAt(0).toUpperCase() + extra.slice(1));
  const old = f.id ? exLibrary().find((e) => e.id === f.id) : null;
  const clash = findExercise(name);
  if (clash && clash.id !== old?.id) { toast(`“${clash.name}” already exists`); return; }
  const now = Date.now();
  const entry = { id: old ? old.id : `u:${uid()}`, name, tags: sortTags(tags), updatedAt: now };
  state.library = state.library.filter((e) => e.id !== entry.id);
  state.library.push(entry);
  // Renaming: carry the new name into every saved workout and any open session.
  if (old && old.name !== name) {
    for (const w of strength()) {
      if (!w.exercises.some((e) => e.name === old.name)) continue;
      w.exercises.forEach((e) => { if (e.name === old.name) e.name = name; });
      w.updatedAt = now;
    }
    [state.draft, editing].forEach((s) => s?.exercises.forEach((e) => { if (e.name === old.name) e.name = name; }));
  }
  save();
  if (exFormAfter === 'add') { closeSheet(); addExercise(name); return; }
  openPicker(exFormAfter === 'manage' ? 'manage' : 'add');
  render();
  toast(old ? 'Exercise saved' : 'Exercise created');
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
        `<span>${s.weight ? `${fmtNum(s.weight)} ${unit} × ` : ''}${s.reps}</span>`).join('')}</div></div>`).join('') +
      (w.notes ? `<p class="notes">${esc(w.notes)}</p>` : '');
  } else if (isClimb(w)) {
    body = `<div class="tiles">
        <div class="tile"><small>Style</small><b>${esc(w.climbStyle || 'Climbing')}</b></div>
        <div class="tile"><small>Duration</small><b>${fmtNum(w.duration)} min</b></div>
        <div class="tile"><small>Climbs</small><b>${w.climbs || '—'}</b></div>
        <div class="tile"><small>Hardest grade</small><b>${w.grade ? esc(w.grade) : '—'}</b></div>
      </div>${w.calories ? `<p class="muted small detail-extra">${fmtNum(w.calories)} kcal</p>` : ''}${w.notes ? `<p class="notes">${esc(w.notes)}</p>` : ''}`;
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
  const t = timeOf(w);
  openSheet(`<p class="eyebrow">${fmtDate(w.date)}${t ? ` · ${fmtTime(t)}` : ''}</p><h2>${esc(w.name)}</h2>
    ${w.type === 'strength' ? `<div class="detail-tags">${tagChips(workoutTags(w))}</div>` : ''}${body}
    <div class="sheet-actions">
      <button class="btn primary block" data-action="edit-workout" data-id="${w.id}">Edit</button>
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
    <div class="setting"><span>Exercise library</span>
      <button class="btn soft block" data-action="manage-exercises">Manage exercises &amp; tags</button></div>
    <h3 class="section">Cloud sync</h3>
    <div id="sync-panel"></div>
    <h3 class="section">Your data</h3>
    <p class="muted small">A copy is always kept on this device so the app works offline. Backups are a good idea even with sync on.</p>
    <div class="grid2"><button class="btn soft" data-action="export">Export backup</button><button class="btn soft" data-action="import">Import backup</button></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
    <button class="btn ghost danger block" data-action="reset">Reset all data</button>
    <p class="version">Gainer · version ${APP_VERSION}</p>`);
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
    id: uid(), name: tpl?.name || defaultName(), date: today(), time: hhmm(new Date()), start: Date.now(),
    exercises: tpl ? tpl.exercises.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ weight: s.weight || '', reps: s.reps, done: false })) })) : [],
  };
  save();
}

// The session the exercise cards are bound to: the workout being edited, or the live one.
const cur = () => (tab === 'edit' ? editing : state.draft);
// Live workouts persist on every change; edits stay in memory until Save.
const touch = () => { if (tab !== 'edit') save(); };

function addExercise(name) {
  const d = cur();
  if (!d) return;
  if (!findExercise(name)) state.library.push({ id: `u:${uid()}`, name, tags: [], updatedAt: Date.now() });
  const last = lastExercise(name);
  const sets = last ? last.e.sets.map((s) => ({ weight: s.weight || '', reps: s.reps, done: false })) : [{ weight: '', reps: '', done: false }];
  d.exercises.push({ name, sets });
  touch();
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

function endDraft(msg) {
  state.draft = null;
  save(); stopRest(); go('home');
  if (msg) toast(msg);
}

async function finishWorkout() {
  const d = state.draft;
  if (!d) return;
  const exercises = d.exercises
    .map((e) => ({ name: e.name, sets: e.sets.filter((s) => num(s.reps) > 0).map((s) => ({ weight: num(s.weight), reps: Math.round(num(s.reps)) })) }))
    .filter((e) => e.sets.length);
  if (!exercises.length) {
    if (await ask({ title: 'No sets logged', text: 'None of your sets have reps entered, so there is nothing to save. End this workout anyway?', ok: 'End workout', danger: true })) endDraft('Workout ended');
    return;
  }
  const w = {
    id: d.id, type: 'strength', name: d.name.trim() || 'Workout', date: d.date, time: d.time ?? hhmm(new Date(d.start)), ts: d.start, updatedAt: Date.now(),
    duration: clamp(Math.round((Date.now() - d.start) / 60000), 1, 300), exercises,
  };
  const prs = detectPRs(w);
  state.workouts.push(w);
  endDraft(prs.length ? `🏆 New PR: ${prs.join(', ')}` : 'Workout saved 💪');
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
  r.onload = async () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data.workouts) || !Array.isArray(data.weights)) throw new Error('bad');
      if (!await ask({ title: 'Restore backup?', text: `This replaces your current data with the backup (${data.workouts.length} workouts, ${data.weights.length} weigh-ins).`, ok: 'Restore', danger: true })) return;
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
const draftSet = (d) => cur()?.exercises[+d.ei]?.sets[+d.si];

const ACTIONS = {
  tab: (d) => go(d.tab),
  settings: openSettings,
  'close-sheet': closeSheet,
  'confirm-yes': () => { const f = confirmSettle; sheetOnClose = null; closeSheet(); f?.(true); },
  'confirm-no': closeSheet,
  'start-workout': () => { startDraft(); go('workout'); },
  'repeat-workout': async (d) => {
    const tpl = state.workouts.find((w) => w.id === d.id);
    if (state.draft) {
      if (!await ask({ title: 'Replace current workout?', text: 'You already have a workout in progress. It will be discarded.', ok: 'Replace', danger: true })) return;
      state.draft = null;
    }
    startDraft(tpl);
    closeSheet();
    go('workout');
  },
  'log-cardio': (d) => openCardio(null, d.date || null, d.activity || null),
  'log-weight': openWeight,
  'log-past': (d) => startEdit(null, d.date || today()),
  'add-on-day': (d) => openAddOnDay(d.date),
  'edit-workout': (d) => {
    const w = state.workouts.find((x) => x.id === d.id);
    if (!w) return;
    if (w.type === 'strength') startEdit(w); else openCardio(w);
  },
  'save-edit': saveEdit,
  'cancel-edit': () => { const back = editing?.returnTab || 'history'; editing = null; go(back); },
  'add-exercise': () => openPicker('add'),
  'manage-exercises': () => openPicker('manage'),
  'pick-exercise': (d) => { closeSheet(); addExercise(d.name); },
  'pick-tag': (d) => { picker.tag = d.tag || null; renderPicker(); },
  'new-exercise': (d) => openExerciseForm({ name: d.name, after: picker.mode === 'add' && cur() ? 'add' : 'manage' }),
  'edit-exercise': (d) => openExerciseForm({ id: d.id, after: picker.mode === 'manage' ? 'manage' : 'picker' }),
  'delete-exercise': async (d) => {
    const x = exLibrary().find((e) => e.id === d.id);
    if (!x) return;
    const back = exFormAfter === 'manage' ? 'manage' : 'add';
    if (!await ask({ title: `Delete ${x.name}?`, text: 'It is removed from your exercise list. Past workouts that used it keep their sets.', ok: 'Delete', danger: true })) { openPicker(back); return; }
    tombstone(x.id);
    state.library = state.library.filter((e) => e.id !== x.id);
    save(); openPicker(back); render(); toast('Exercise deleted');
  },
  'cal-prev': () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); render(); },
  'cal-next': () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); render(); },
  'cal-today': () => { const n = new Date(); calMonth = new Date(n.getFullYear(), n.getMonth(), 1); calDay = today(); render(); },
  'cal-day': (d) => {
    calDay = d.date;
    const dt = fromKey(d.date);
    if (dt.getMonth() !== calMonth.getMonth() || dt.getFullYear() !== calMonth.getFullYear()) calMonth = new Date(dt.getFullYear(), dt.getMonth(), 1);
    render();
  },
  'cal-tag': (d) => { calTag = d.tag || null; render(); },
  'add-set': (d) => {
    const sets = cur().exercises[+d.ei].sets;
    const last = sets.at(-1);
    sets.push({ weight: last?.weight ?? '', reps: last?.reps ?? '', done: false });
    touch(); render();
  },
  'remove-set': (d) => { cur().exercises[+d.ei].sets.pop(); touch(); render(); },
  'toggle-set': (d) => {
    const s = draftSet(d);
    if (!s) return;
    s.done = !s.done;
    if (s.done && !num(s.reps)) { s.done = false; toast('Enter reps first'); return; }
    if (s.done && state.settings.rest > 0) startRest();
    save(); render();
  },
  'remove-ex': async (d) => {
    const s = cur(), e = s.exercises[+d.ei];
    const hasData = e.sets.some((x) => x.done || num(x.reps) > 0);
    if (hasData && !await ask({ title: `Remove ${e.name}?`, text: 'Its sets will be removed from this workout.', ok: 'Remove', danger: true })) return;
    s.exercises.splice(+d.ei, 1);
    touch(); render();
  },
  'finish-workout': finishWorkout,
  'discard-workout': async () => {
    if (!state.draft) return;
    if (!await ask({ title: 'Discard workout?', text: 'Nothing from this session will be saved.', ok: 'Discard', danger: true })) return;
    endDraft('Workout discarded');
  },
  'open-workout': (d) => openWorkout(d.id),
  'delete-workout': async (d) => {
    if (!await ask({ title: 'Delete this entry?', text: 'This also removes it from your other devices.', ok: 'Delete', danger: true })) return;
    tombstone(d.id);
    state.workouts = state.workouts.filter((w) => w.id !== d.id);
    save(); closeSheet();
    if (tab === 'edit' && editing?.id === d.id) { const back = editing.returnTab; editing = null; go(back); } else render();
    toast('Deleted');
  },
  'delete-weight': async (d) => {
    if (!await ask({ title: 'Delete this weigh-in?', ok: 'Delete', danger: true })) return;
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
  reset: async () => {
    if (!await ask({ title: 'Reset all data?', text: 'This deletes ALL workouts, weigh-ins and settings, on every synced device. It cannot be undone.', ok: 'Continue', danger: true })) return;
    if (!await ask({ title: 'Are you absolutely sure?', text: 'Last chance. Consider exporting a backup first.', ok: 'Delete everything', danger: true })) return;
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
    const old = f.id ? state.workouts.find((w) => w.id === f.id) : null;
    const date = f.date || today(), time = f.time || null;
    const climb = a.id === 'climb';
    const style = climb ? (CLIMB_STYLES.includes(f.climbStyle) ? f.climbStyle : 'Bouldering') : null;
    const entry = {
      id: old ? old.id : uid(), type: 'cardio', activity: a.id, name: climb ? style : a.name, date, time,
      ts: time || !old ? tsFor(date, time) : old.ts, updatedAt: Date.now(),
      duration, distance: climb ? null : num(f.distance) || null, calories: Math.round(num(f.calories)) || null, notes: (f.notes || '').trim(),
      ...(climb ? { climbStyle: style, climbs: Math.round(num(f.climbs)) || null, grade: (f.grade || '').trim().slice(0, 12) || null } : {}),
    };
    state.workouts = state.workouts.filter((w) => w.id !== entry.id);
    state.workouts.push(entry);
    save(); closeSheet(); render(); toast(old ? 'Changes saved' : `${a.icon} ${a.name} logged`);
  },
  exercise: saveExercise,
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
    if (s) { s[t.dataset.set] = t.value; touch(); }
  } else if (t.dataset.draft && state.draft) {
    state.draft[t.dataset.draft] = t.value;
    save();
  } else if (t.dataset.edit && editing) {
    editing[t.dataset.edit] = t.value;
  } else if (t.id === 'ex-search') {
    picker.q = t.value;
    renderPicker();
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
  if (fn) { e.preventDefault(); const fd = new FormData(f); fn(Object.fromEntries(fd), fd); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Enter' && e.target.matches('.title-input, .set-row input, #ex-search')) e.target.blur();
});

document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#sheet').hidden) render(); });

setInterval(() => {
  const el = $('#elapsed');
  if (el && state.draft) el.textContent = fmtSecs((Date.now() - state.draft.start) / 1000);
}, 1000);

/* ---------- Boot ---------- */
render();
navigator.storage?.persist?.();

// Updates: check for a new version whenever the app comes back to the foreground, and
// reload into it once it's installed (deferred if you're mid-edit so nothing is lost).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloadPending = false;
  const busy = () => tab === 'edit' || !$('#sheet').hidden || !!document.activeElement?.matches?.('input, textarea');
  const applyUpdate = () => {
    if (busy()) { reloadPending = true; return; }
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) applyUpdate(); });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (reloadPending) location.reload(); }
      else reg.update().catch(() => {});
    });
  }).catch(() => {});
}
