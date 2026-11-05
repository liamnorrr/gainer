// Cloud sync via Firebase (Auth + Firestore).
// Each user's data is one Firestore document: users/{uid} = { json, updatedAt }.
// Local storage stays the source of truth on each device (so the app works offline);
// this module merges local and cloud copies whenever either side changes.
import { firebaseConfig } from './firebase-config.js';

const V = '10.14.1';
const SDK = `https://www.gstatic.com/firebasejs/${V}`;
const FT = window.FT;

const status = { state: firebaseConfig ? 'loading' : 'unconfigured', email: '', lastSync: 0, error: '', busy: false };
let fb = null;          // loaded SDK functions + instances
let user = null;
let ref = null;
let ready = false;      // true once we've seen the cloud copy for this user
let unsub = null;
let pushTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function set(p) { Object.assign(status, p); renderPanel(); }

function friendly(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/email-already-in-use': 'An account with that email already exists — sign in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/network-request-failed': "You're offline. Try again when connected.",
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase yet.',
    'auth/admin-restricted-operation': 'New sign-ups are turned off for this app.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase config in firebase-config.js is not valid.',
    'permission-denied': 'Firestore rules blocked access — check the security rules.',
  };
  return map[code] || e?.message || 'Something went wrong.';
}

function renderPanel() {
  const el = document.getElementById('sync-panel');
  if (!el) return;
  const s = status;
  let html;
  if (s.state === 'unconfigured') {
    html = `<p class="muted small">Cloud sync isn't set up yet. Add your Firebase config to <code>firebase-config.js</code> (see the README) to sync between your phone and laptop.</p>`;
  } else if (s.state === 'loading') {
    html = `<p class="muted small">Connecting…</p>`;
  } else if (s.state === 'unavailable') {
    html = `<p class="muted small">Sync couldn't load (are you offline?). Your data is safe on this device and will sync next time.</p>`;
  } else if (s.state === 'signedout') {
    html = `<p class="muted small">Sign in on each device with the same account to keep your data in sync.</p>
    <form data-sync-form="signin" class="form sync-form">
      <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
      ${s.error ? `<p class="sync-error">${esc(s.error)}</p>` : ''}
      <div class="grid2">
        <button class="btn primary" type="submit" ${s.busy ? 'disabled' : ''}>Sign in</button>
        <button class="btn soft" type="button" data-sync="signup" ${s.busy ? 'disabled' : ''}>Create account</button>
      </div>
      <button class="link" type="button" data-sync="reset">Forgot password?</button>
    </form>`;
  } else {
    const offline = !navigator.onLine;
    const when = s.lastSync ? new Date(s.lastSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    html = `<div class="sync-row">
      <span class="sync-dot ${offline || s.error ? 'warn' : 'ok'}"></span>
      <div class="sync-text"><b>${esc(s.email)}</b>
        <small>${offline ? "Offline — changes will sync when you're back online" : s.error ? esc(s.error) : when ? `Synced · ${when}` : 'Syncing…'}</small></div>
      <button class="btn ghost sm" data-sync="signout">Sign out</button>
    </div>`;
  }
  const typed = formValues();
  el.innerHTML = html;
  const f = el.querySelector('[data-sync-form="signin"]');
  if (f && typed.email !== undefined) { f.email.value = typed.email; f.password.value = typed.password; }
}

/* ---------- Cloud read / write ---------- */
function schedulePush(delay = 1200) {
  if (!ready || !user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, delay);
}

async function push() {
  if (!ready || !user || !navigator.onLine) return;
  const { runTransaction, serverTimestamp } = fb;
  try {
    // Read-merge-write in a transaction so two devices saving at once never clobber each other.
    await runTransaction(fb.db, async (tx) => {
      const snap = await tx.get(ref);
      const local = FT.getState();
      const merged = snap.exists() ? FT.merge(local, JSON.parse(snap.data().json)) : local;
      tx.set(ref, { json: JSON.stringify(merged), updatedAt: serverTimestamp() });
    });
    set({ lastSync: Date.now(), error: '' });
  } catch (e) {
    set({ error: navigator.onLine ? friendly(e) : '' });
  }
}

function listen() {
  unsub?.();
  ready = false;
  ref = fb.doc(fb.db, 'users', user.uid);
  unsub = fb.onSnapshot(ref, (snap) => {
    ready = true;
    if (snap.metadata.hasPendingWrites) return;
    if (!snap.exists()) { schedulePush(0); return; }      // first device: upload what we have
    const remote = JSON.parse(snap.data().json);
    FT.applyRemote(remote);
    // If this device has anything the cloud doesn't, send it up.
    if (JSON.stringify(FT.merge(FT.getState(), remote)) !== JSON.stringify(FT.merge(remote, remote))) schedulePush(0);
    set({ lastSync: Date.now(), error: '' });
  }, (e) => set({ error: friendly(e) }));
}

/* ---------- Auth actions ---------- */
function formValues() {
  const f = document.querySelector('[data-sync-form="signin"]');
  return f ? { email: f.email.value.trim(), password: f.password.value } : {};
}

async function run(fn) {
  set({ busy: true, error: '' });
  try { await fn(); } catch (e) { set({ error: friendly(e) }); } finally { set({ busy: false }); }
}

document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-sync-form="signin"]')) return;
  e.preventDefault();
  const { email, password } = formValues();
  run(() => fb.signInWithEmailAndPassword(fb.auth, email, password));
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-sync]');
  if (!t || !fb) return;
  e.preventDefault();
  const { email, password } = formValues();
  if (t.dataset.sync === 'signup') {
    if (!email || (password || '').length < 6) { set({ error: 'Enter an email and a password of at least 6 characters.' }); return; }
    run(() => fb.createUserWithEmailAndPassword(fb.auth, email, password));
  } else if (t.dataset.sync === 'reset') {
    if (!email) { set({ error: 'Enter your email above first.' }); return; }
    run(async () => { await fb.sendPasswordResetEmail(fb.auth, email); set({ error: `Password reset email sent to ${email}.` }); });
  } else if (t.dataset.sync === 'signout') {
    if (confirm('Sign out? Your data stays on this device but will stop syncing.')) fb.signOut(fb.auth);
  }
});

window.addEventListener('ft:saved', () => schedulePush());
window.addEventListener('online', () => { renderPanel(); schedulePush(0); });
window.addEventListener('offline', renderPanel);

/* ---------- Boot ---------- */
async function init() {
  if (!firebaseConfig) return;
  try {
    const [app, auth, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const fbApp = app.initializeApp(firebaseConfig);
    fb = { ...auth, ...fs, auth: auth.getAuth(fbApp), db: fs.getFirestore(fbApp) };
  } catch (e) {
    set({ state: 'unavailable' });
    window.addEventListener('online', () => location.reload(), { once: true });
    return;
  }
  fb.onAuthStateChanged(fb.auth, (u) => {
    user = u;
    if (u) { set({ state: 'signedin', email: u.email, error: '' }); listen(); }
    else { unsub?.(); unsub = null; ready = false; set({ state: 'signedout', lastSync: 0 }); }
  });
}

window.FTSync = { renderPanel, status };
renderPanel();
init();
