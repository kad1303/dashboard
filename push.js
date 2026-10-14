'use strict';

/* ============================================================
   Push-Erinnerungen. Das Gerät meldet sich mit einem Push-Abo bei Supabase an;
   die Edge Function "send-reminders" verschickt dann die Nachrichten.
   Benötigt die Anmeldung aus sync.js.
   ============================================================ */

const VAPID_PUBLIC_KEY = 'BGIRbYGJAb3PCeCg4hYKMu2knvPulU8tzcvkwcF-EO9gFLHga73k--lov5RILrJ372-ZMsyaHHqpthiSTEu8J-A';
const PUSH_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-reminders`;
const PUSH_PREFS_KEY = 'lebensdashboard:push';

const DAILY_TIMES = [['', 'Aus'], ...Array.from({ length: 11 }, (_, i) => {
  const min = 6 * 60 + i * 30; // 06:00 bis 11:00
  const v = `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  return [v, `${v} Uhr`];
})];
const EVENT_LEADS = [[0, 'Aus'], [10, '10 Min. vorher'], [15, '15 Min. vorher'], [30, '30 Min. vorher'], [60, '1 Std. vorher']];

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushState = { subscribed: false, checked: false, busy: false };

function pushPrefs() {
  try {
    return { daily_time: '07:30', event_lead_min: 30, ...JSON.parse(localStorage.getItem(PUSH_PREFS_KEY) || '{}') };
  } catch {
    return { daily_time: '07:30', event_lead_min: 30 };
  }
}

function setPushPrefs(p) {
  try { localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(p)); } catch {}
}

function base64UrlToBytes(s) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function savePushSubscription(sub) {
  const j = sub.toJSON();
  const prefs = pushPrefs();
  const res = await rest('POST', '?on_conflict=endpoint', {
    endpoint: j.endpoint,
    user_id: session.user.id,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    daily_time: prefs.daily_time,
    event_lead_min: Number(prefs.event_lead_min) || 0,
    updated_at: new Date().toISOString(),
  }, 'resolution=merge-duplicates,return=minimal', 'push_subscriptions');
  if (!res.ok) throw new Error(`Speichern fehlgeschlagen (${res.status})`);
}

async function enablePush() {
  if (!session) { toast('Bitte zuerst oben beim Abgleich anmelden'); return; }
  // Muss direkt im Klick passieren, sonst blockiert das iPhone die Abfrage.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast('Benachrichtigungen wurden nicht erlaubt');
    render();
    return;
  }
  pushState.busy = true;
  render();
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
    await savePushSubscription(sub);
    pushState.subscribed = true;
    toast('Erinnerungen aktiviert 🔔');
  } catch (e) {
    console.error(e);
    toast(`Aktivieren fehlgeschlagen: ${e.message}`);
  } finally {
    pushState.busy = false;
    render();
  }
}

async function disablePush() {
  const sub = await currentPushSubscription();
  if (sub) {
    if (session) await rest('DELETE', `?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, null, null, 'push_subscriptions').catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  pushState.subscribed = false;
  toast('Erinnerungen ausgeschaltet');
  render();
}

async function sendTestPush() {
  try {
    const res = await fetch(PUSH_FUNCTION_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
    toast(data.sent ? 'Test-Nachricht verschickt – kommt gleich an' : 'Kein Gerät gefunden – bitte Erinnerungen neu aktivieren');
  } catch (e) {
    toast(`Test fehlgeschlagen: ${e.message}`);
  }
}

function pushSection() {
  if (!syncConfigured()) return '';
  const head = '<div class="sec-head"><h2>🔔 Erinnerungen</h2></div>';
  const box = (html) => `<section>${head}<div class="card setting" style="font-size:15px">${html}</div></section>`;

  if (!session) return box('Melde dich zuerst oben beim <b>Abgleich</b> an. Dann kannst du hier Erinnerungen einschalten.');
  if (!pushSupported()) {
    return box(isIOS() && !isStandalone()
      ? 'Erinnerungen funktionieren auf dem iPhone nur in der <b>App vom Startbildschirm</b>, nicht in Safari.'
      : 'Dieser Browser unterstützt leider keine Benachrichtigungen.');
  }
  if (Notification.permission === 'denied') {
    return box('Benachrichtigungen sind blockiert. Am iPhone: <b>Einstellungen → Mitteilungen → Dashboard → Mitteilungen erlauben</b>. Danach hier erneut aktivieren.');
  }
  if (!pushState.checked) return box('Wird geprüft …');
  if (!pushState.subscribed) {
    return `<section>${head}
      <div class="card setting" style="font-size:15px">
        <p style="margin:0 0 12px">Jeden Morgen eine Übersicht (Geburtstage, Termine, To-Dos) und eine Erinnerung vor Terminen.</p>
        <button class="primary-btn" data-action="pushEnable" ${pushState.busy ? 'disabled' : ''}>${pushState.busy ? 'Wird aktiviert …' : 'Erinnerungen aktivieren'}</button>
      </div>
    </section>`;
  }
  const prefs = pushPrefs();
  const select = (name, options, value) => `<select data-push-pref="${name}" id="push-${name}">${options.map(([v, l]) =>
    `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<section>${head}
    <div class="card setting">
      <div class="field"><label for="push-daily_time">Morgen-Übersicht</label>${select('daily_time', DAILY_TIMES, prefs.daily_time)}</div>
      <div class="field" style="margin-bottom:0"><label for="push-event_lead_min">Erinnerung vor Terminen</label>${select('event_lead_min', EVENT_LEADS, prefs.event_lead_min)}</div>
    </div>
    <div class="card list" style="margin-top:10px">
      <button class="btn-row" data-action="pushTest">${ICON.bell} Test-Nachricht senden</button>
      <button class="btn-row" data-action="pushDisable">${ICON.bellOff} Erinnerungen ausschalten</button>
    </div>
    <p class="small">Gilt für dieses Gerät. Erinnerungen gibt es nur für Termine mit Uhrzeit.</p>
  </section>`;
}

Object.assign(actions, {
  pushEnable: enablePush,
  pushDisable: disablePush,
  pushTest: sendTestPush,
});

document.addEventListener('change', async (e) => {
  const name = e.target.dataset?.pushPref;
  if (!name) return;
  setPushPrefs({ ...pushPrefs(), [name]: name === 'event_lead_min' ? Number(e.target.value) : e.target.value });
  try {
    const sub = await currentPushSubscription();
    if (sub && session) await savePushSubscription(sub);
    toast('Gespeichert');
  } catch (err) {
    toast(`Speichern fehlgeschlagen: ${err.message}`);
  }
});

// Beim Start prüfen, ob dieses Gerät schon ein Abo hat, und es auffrischen (z. B. neue Zeitzone).
(async function initPush() {
  try {
    const sub = await currentPushSubscription();
    pushState.subscribed = !!sub && Notification.permission === 'granted';
    if (pushState.subscribed && session) savePushSubscription(sub).catch((e) => console.warn('Push-Abo nicht aktualisiert', e));
  } catch (e) {
    console.warn('Push-Status unbekannt', e);
  } finally {
    pushState.checked = true;
    if (ui.tab === 'settings') render();
  }
})();
