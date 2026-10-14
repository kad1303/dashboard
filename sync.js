'use strict';

/* ============================================================
   Abgleich zwischen Geräten über Supabase.
   Die Daten liegen weiterhin lokal (offline nutzbar). Ist man angemeldet,
   werden sie mit einer Zeile in der Tabelle "dashboards" abgeglichen.
   ============================================================ */

const SUPABASE_URL = 'https://ptvqvevtzcbdgtnnjzqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W6ZlrO3S2vu4A1NNter03g_p0FiLYkc'; // öffentlicher Schlüssel, darf im Code stehen

const AUTH_KEY = 'lebensdashboard:auth';
const LAST_SYNC_KEY = 'lebensdashboard:lastSync';
const SYNC_INTERVAL_MS = 30000;
const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const syncConfigured = () => !!(SUPABASE_URL && SUPABASE_KEY);

/* ---------- Sitzung ---------- */
let session = readSession();
const syncState = { status: 'idle', error: '', busy: false, pending: false, timer: null };

function readSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; }
}

function writeSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    else localStorage.removeItem(AUTH_KEY);
  } catch (e) {
    console.warn('Sitzung nicht gespeichert', e);
  }
}

function sessionFrom(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: { id: data.user.id, email: data.user.email },
  };
}

/* ---------- HTTP ---------- */
async function authRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(data.msg || data.error_description || data.message || `Fehler ${res.status}`, res.status, data.error_code || data.code);
  return data;
}

class AuthError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

function friendlyAuthError(e) {
  const msg = String(e.message || '').toLowerCase();
  if (e.code === 'invalid_credentials' || msg.includes('invalid login')) return 'E-Mail oder Passwort stimmt nicht.';
  if (e.code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'Bitte bestätige zuerst deine E-Mail über den Link in deinem Postfach.';
  if (e.code === 'user_already_exists' || msg.includes('already registered')) return 'Für diese E-Mail gibt es schon ein Konto – bitte „Anmelden“ nutzen.';
  if (e.code === 'weak_password' || msg.includes('password should')) return 'Das Passwort ist zu kurz (mindestens 6 Zeichen).';
  if (e.code === 'over_email_send_rate_limit' || msg.includes('rate limit')) return 'Zu viele Versuche – bitte in ein paar Minuten erneut probieren.';
  if (e.code === 'signup_disabled' || msg.includes('signups not allowed')) return 'Neue Konten sind deaktiviert.';
  if (e instanceof TypeError) return 'Keine Verbindung – bist du online?';
  return e.message || 'Unbekannter Fehler';
}

async function accessToken() {
  if (!session) throw new AuthError('Nicht angemeldet', 401);
  if (Date.now() < session.expires_at - 60000) return session.access_token;
  try {
    writeSession(sessionFrom(await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })));
    return session.access_token;
  } catch (e) {
    if (e instanceof AuthError && e.status >= 400 && e.status < 500) {
      writeSession(null);
      toast('Bitte melde dich erneut an');
      render();
    }
    throw e;
  }
}

async function rest(method, query, body, prefer, table = 'dashboards') {
  const doFetch = async () => fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let res = await doFetch();
  if (res.status === 401 && session) {
    session.expires_at = 0; // Token erneuern und einmal wiederholen
    res = await doFetch();
  }
  return res;
}

/* ---------- Zusammenführen ---------- */
// JSON mit sortierten Schlüsseln, damit gleiche Daten immer gleich aussehen
// (die Datenbank ändert die Reihenfolge der Schlüssel).
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

// Nur das, was zwischen Geräten geteilt wird (Hinweis-Einstellungen bleiben pro Gerät).
function sharedData(d) {
  return {
    version: d.version,
    name: d.name,
    nameUpdated: d.nameUpdated || 0,
    events: d.events,
    todos: d.todos,
    goals: d.goals,
    quotes: d.quotes,
    birthdays: d.birthdays || [],
    deleted: d.deleted || {},
  };
}

function mergeData(local, remote) {
  const now = Date.now();
  const deleted = {};
  for (const src of [remote.deleted || {}, local.deleted || {}]) {
    for (const [k, t] of Object.entries(src)) {
      if (now - t < TOMBSTONE_MAX_AGE_MS) deleted[k] = Math.max(t, deleted[k] || 0);
    }
  }

  const out = { ...local, deleted };
  for (const c of COLLECTIONS) {
    const byKey = new Map();
    // Neuere Version gewinnt; bei Gleichstand die lokale.
    for (const it of [...(remote[c] || []), ...(local[c] || [])]) {
      const cur = byKey.get(it.id);
      if (!cur || (it.updated || 0) >= (cur.updated || 0)) byKey.set(it.id, it);
    }
    // Entfernen, wenn die Löschung neuer ist als die letzte Änderung des Eintrags.
    out[c] = [...byKey.values()].filter((it) => {
      const deletedAt = deleted[`${c}:${it.id}`];
      return deletedAt === undefined || deletedAt < (it.updated || 0);
    });
  }

  // Gleiche Sprüche (z. B. die Beispiele, die jedes Gerät anfangs bekommt) nur einmal behalten.
  const seen = new Map();
  out.quotes = out.quotes.filter((q) => {
    const key = `${(q.text || '').trim()}|${(q.author || '').trim()}`;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, q); return true; }
    if (q.fav && !prev.fav) prev.fav = true;
    deleted[`quotes:${q.id}`] = now;
    return false;
  });

  if ((remote.nameUpdated || 0) > (local.nameUpdated || 0)) {
    out.name = remote.name || '';
    out.nameUpdated = remote.nameUpdated;
  }
  return out;
}

function applyMerged(merged) {
  if (stableStringify(sharedData(merged)) === stableStringify(sharedData(db))) return false;
  db = migrate(merged);
  writeLocal();
  takeSnapshot();
  render();
  return true;
}

/* ---------- Abgleich ---------- */
async function fetchRemote() {
  const res = await rest('GET', `?select=data,rev&user_id=eq.${session.user.id}`);
  if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
  const rows = await res.json();
  return rows[0] || null;
}

async function pushRemote(remote, payload) {
  if (!remote) {
    const res = await rest('POST', '', { user_id: session.user.id, data: payload, rev: 1 }, 'return=minimal');
    if (res.status === 409) return false; // anderes Gerät war schneller → neu zusammenführen
    if (!res.ok) throw new Error(`Speichern fehlgeschlagen (${res.status})`);
    return true;
  }
  // Nur speichern, wenn seit dem Laden niemand anderes gespeichert hat (rev unverändert).
  const res = await rest('PATCH', `?user_id=eq.${session.user.id}&rev=eq.${remote.rev}`,
    { data: payload, rev: remote.rev + 1, updated_at: new Date().toISOString() }, 'return=representation');
  if (!res.ok) throw new Error(`Speichern fehlgeschlagen (${res.status})`);
  return (await res.json()).length > 0;
}

async function syncNow() {
  if (!syncConfigured() || !session) return;
  if (syncState.busy) { syncState.pending = true; return; }
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  // Während ein Formular offen ist, keine Daten austauschen (sonst ginge die Eingabe verloren).
  if (!$('#sheet').hidden) { scheduleSync(3000); return; }

  syncState.busy = true;
  setSyncStatus('syncing');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await fetchRemote();
      if (remote) applyMerged(mergeData(db, remote.data || {}));
      const payload = sharedData(db);
      if (remote && stableStringify(payload) === stableStringify(sharedData(migrate(remote.data || {})))) break;
      if (await pushRemote(remote, payload)) break;
    }
    try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch {}
    setSyncStatus('ok');
  } catch (e) {
    console.warn('Abgleich fehlgeschlagen', e);
    setSyncStatus(session ? 'error' : 'idle', e instanceof TypeError ? 'Keine Verbindung' : e.message);
  } finally {
    syncState.busy = false;
    if (syncState.pending) { syncState.pending = false; scheduleSync(300); }
  }
}

function scheduleSync(delay = 1500) {
  if (!syncConfigured() || !session) return;
  clearTimeout(syncState.timer);
  syncState.timer = setTimeout(syncNow, delay);
}

// Wird von save() in app.js nach jeder lokalen Änderung aufgerufen.
function onDataSaved() { scheduleSync(); }

/* ---------- Anzeige ---------- */
function setSyncStatus(status, error = '') {
  syncState.status = status;
  syncState.error = error;
  updateSyncIndicator();
  if (ui.tab === 'settings' && $('#sheet').hidden && !document.activeElement?.closest?.('.sync-form')) render();
}

function updateSyncIndicator() {
  const el = $('#sync-ind');
  if (!el) return;
  el.hidden = !syncConfigured() || !session;
  el.dataset.status = syncState.status;
  el.setAttribute('aria-label', {
    ok: 'Abgeglichen', syncing: 'Wird abgeglichen …', error: 'Abgleich fehlgeschlagen', offline: 'Offline', idle: 'Abgleich',
  }[syncState.status] || 'Abgleich');
}

function lastSyncText() {
  const t = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
  if (!t) return 'noch nie';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  return new Date(t).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function syncSection() {
  if (!syncConfigured()) return '';
  if (session) {
    const statusText = {
      syncing: 'Wird abgeglichen …',
      error: `⚠️ Fehler: ${syncState.error || 'unbekannt'}`,
      offline: 'Offline – wird abgeglichen, sobald du wieder online bist.',
    }[syncState.status] || `✅ Abgeglichen ${lastSyncText()}`;
    return `<section>
      <div class="sec-head"><h2>Abgleich zwischen Geräten</h2></div>
      <div class="card setting" style="font-size:15px">
        Angemeldet als <b>${esc(session.user.email)}</b>
        <p class="small" style="margin:6px 0 0">${esc(statusText)}</p>
      </div>
      <div class="card list" style="margin-top:10px">
        <button class="btn-row" data-action="syncNow">${ICON.sync} Jetzt abgleichen</button>
        <button class="btn-row" data-action="syncLogout">${ICON.logout} Abmelden</button>
      </div>
      <p class="small">Melde dich auf jedem Gerät mit derselben E-Mail an. Änderungen erscheinen dann automatisch überall.</p>
    </section>`;
  }
  return `<section>
    <div class="sec-head"><h2>Abgleich zwischen Geräten</h2></div>
    <form class="card setting sync-form" id="sync-form" novalidate>
      <p style="margin:0 0 12px;font-size:15px">Melde dich an, um deine Daten auf Handy und Laptop gleich zu halten.</p>
      <div class="field"><label for="sync-email">E-Mail</label>
        <input id="sync-email" name="email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" required></div>
      <div class="field"><label for="sync-pw">Passwort</label>
        <input id="sync-pw" name="password" type="password" autocomplete="current-password" minlength="6" required></div>
      <button type="submit" class="primary-btn">Anmelden</button>
      <button type="button" class="link" data-action="syncSignup" style="width:100%;text-align:center;margin-top:4px">Noch kein Konto? Konto erstellen</button>
    </form>
    <p class="small">Deine Daten bleiben auch ohne Anmeldung auf diesem Gerät. Beim ersten Anmelden werden sie mit deinen anderen Geräten zusammengeführt – es geht nichts verloren.</p>
  </section>`;
}

/* ---------- Aktionen ---------- */
function syncFormValues() {
  const f = $('#sync-form');
  const email = f?.elements.email.value.trim() || '';
  const password = f?.elements.password.value || '';
  if (!email || !password) { toast('Bitte E-Mail und Passwort eingeben'); return null; }
  return { email, password };
}

async function login() {
  const v = syncFormValues();
  if (!v) return;
  try {
    writeSession(sessionFrom(await authRequest('token?grant_type=password', v)));
    toast('Angemeldet ✓');
    render();
    updateSyncIndicator();
    await syncNow();
  } catch (e) {
    toast(friendlyAuthError(e));
  }
}

async function signup() {
  const v = syncFormValues();
  if (!v) return;
  if (v.password.length < 6) { toast('Das Passwort braucht mindestens 6 Zeichen'); return; }
  try {
    const data = await authRequest(`signup?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, v);
    if (data.access_token) {
      writeSession(sessionFrom(data));
      toast('Konto erstellt ✓');
      render();
      updateSyncIndicator();
      await syncNow();
    } else {
      alert('Fast geschafft! Wir haben dir eine E-Mail geschickt. Tippe auf den Bestätigungslink darin und melde dich danach hier mit E-Mail und Passwort an.');
    }
  } catch (e) {
    toast(friendlyAuthError(e));
  }
}

Object.assign(actions, {
  syncSignup: signup,
  syncNow() { syncNow().then(() => { if (syncState.status === 'ok') toast('Abgeglichen ✓'); }); },
  async syncLogout() {
    if (!confirm('Abmelden? Deine Daten bleiben auf diesem Gerät, werden aber nicht mehr abgeglichen.')) return;
    const token = session?.access_token;
    writeSession(null);
    setSyncStatus('idle');
    render();
    if (token) fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } }).catch(() => {});
  },
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'sync-form') return;
  e.preventDefault();
  login();
});

/* ---------- Start ---------- */
// Nach dem Klick auf den Bestätigungslink aus der E-Mail landet man hier mit Tokens in der Adresse.
(function handleAuthRedirect() {
  if (!syncConfigured() || !location.hash.includes('access_token=')) return;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const access = p.get('access_token');
  try {
    const payload = JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    writeSession({
      access_token: access,
      refresh_token: p.get('refresh_token'),
      expires_at: Date.now() + Number(p.get('expires_in') || 3600) * 1000,
      user: { id: payload.sub, email: payload.email },
    });
    toast('E-Mail bestätigt – du bist angemeldet ✓');
  } catch (e) {
    console.warn('Anmelde-Link konnte nicht gelesen werden', e);
  }
})();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleSync(300);
});
window.addEventListener('online', () => scheduleSync(300));
window.addEventListener('offline', () => setSyncStatus('offline'));
setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, SYNC_INTERVAL_MS);

updateSyncIndicator();
scheduleSync(300);
