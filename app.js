'use strict';

/* ============================================================
   Lebens-Dashboard – alle Daten bleiben lokal auf dem Gerät.
   ============================================================ */

const STORAGE_KEY = 'lebensdashboard:v1';
const DATA_VERSION = 1;
// Bei jeder Änderung hochzählen – und gleich in version.json eintragen.
const APP_VERSION = '11';

const CATEGORIES = ['Gesundheit', 'Beruf', 'Finanzen', 'Beziehungen', 'Persönlich', 'Lernen', 'Freizeit'];
const PRIOS = { 3: 'Hoch', 2: 'Normal', 1: 'Niedrig' };
const AREAS = { arbeit: 'Arbeit', privat: 'Privat' };
const REPEATS = { '': 'Einmalig', daily: 'Täglich', weekdays: 'Werktags (Mo–Fr)' };
const REPEAT_CHIPS = { daily: '↻ Täglich', weekdays: '↻ Mo–Fr' };
const TITLES = { heute: 'Heute', termine: 'Termine', todos: 'To-Dos', ziele: 'Ziele', motivation: 'Motivation', settings: 'Einstellungen', geburtstage: 'Geburtstage' };
// Unterseiten, die in der Tab-Leiste zu einem Haupt-Tab gehören
const PARENT_TAB = { geburtstage: 'termine' };

const SEED_QUOTES = [
  { text: 'Kleine Schritte jeden Tag führen zu großen Veränderungen.', author: '' },
  { text: 'Du musst nicht großartig sein, um anzufangen. Aber du musst anfangen, um großartig zu sein.', author: 'Zig Ziglar' },
  { text: 'Disziplin ist die Brücke zwischen Zielen und Erfolg.', author: 'Jim Rohn' },
  { text: 'Konzentriere dich auf das, was du beeinflussen kannst.', author: '' },
  { text: 'Fortschritt, nicht Perfektion.', author: '' },
];

/* ---------- Helfer ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };

function fmtDate(s, long = false) {
  return parseDate(s).toLocaleDateString('de-DE', long
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
}

function relDay(s, long = false) {
  const t = today();
  if (s === t) return 'Heute';
  if (s === addDays(t, 1)) return 'Morgen';
  if (s === addDays(t, -1)) return 'Gestern';
  return fmtDate(s, long);
}

const ICON = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.6L20 9.3l-4.4 3.9L17 19l-5-3-5 3 1.4-5.8L4 9.3l5.8-.7z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  todo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/></svg>',
  goal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18 3v4.5h-4.5M6 21v-4.5h4.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 3.4A6 6 0 0 1 18 8c0 3.2.6 5.4 1.3 6.8M17 17H3s3-2 3-9c0-.8.1-1.5.4-2.2M10.3 21a1.9 1.9 0 0 0 3.4 0M3 3l18 18"/></svg>',
  logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/></svg>',
};

/* ---------- Speicher ---------- */
const COLLECTIONS = ['events', 'todos', 'goals', 'quotes', 'birthdays'];

function defaults() {
  return {
    version: DATA_VERSION,
    name: '',
    nameUpdated: 0,
    events: [],
    todos: [],
    goals: [],
    // Feste IDs, damit die Beispielsprüche auf mehreren Geräten nicht doppelt auftauchen.
    birthdays: [],
    quotes: SEED_QUOTES.map((q, i) => ({ id: `seed-${i + 1}`, ...q, fav: false })),
    deleted: {}, // "sammlung:id" -> Zeitpunkt der Löschung (für den Abgleich zwischen Geräten)
    hideInstallHint: false,
  };
}

function migrate(data) {
  const out = { ...defaults(), ...data };
  for (const k of COLLECTIONS) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.deleted || typeof out.deleted !== 'object') out.deleted = {};
  out.goals.forEach((g) => { if (!Array.isArray(g.steps)) g.steps = []; });
  out.todos.forEach((t) => {
    if (!AREAS[t.area]) t.area = 'privat';
    if (!REPEATS[t.repeat]) t.repeat = '';
  });
  out.version = DATA_VERSION;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : defaults();
  } catch (e) {
    console.error('Laden fehlgeschlagen', e);
    return defaults();
  }
}

/* Änderungsverfolgung: Statt jede Bearbeitung einzeln zu markieren, vergleichen wir beim
   Speichern mit dem letzten Stand. Geänderte Einträge bekommen einen Zeitstempel ("updated"),
   gelöschte einen Eintrag in db.deleted. Damit kann der Abgleich zwischen Geräten
   entscheiden, welche Version die neuere ist. */
let snapshot = new Map();

function itemFingerprint(item) {
  const { updated, ...rest } = item;
  return JSON.stringify(rest);
}

function takeSnapshot() {
  snapshot = new Map([['meta:name', db.name]]);
  for (const c of COLLECTIONS) for (const it of db[c]) snapshot.set(`${c}:${it.id}`, itemFingerprint(it));
}

function stampChanges() {
  const now = Date.now();
  const seen = new Set();
  for (const c of COLLECTIONS) {
    for (const it of db[c]) {
      const key = `${c}:${it.id}`;
      seen.add(key);
      if (snapshot.get(key) !== itemFingerprint(it)) it.updated = now;
    }
  }
  for (const key of snapshot.keys()) {
    if (key !== 'meta:name' && !seen.has(key)) db.deleted[key] = now;
  }
  if (snapshot.get('meta:name') !== db.name) db.nameUpdated = now;
  takeSnapshot();
}

function writeLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
    toast('Speichern fehlgeschlagen');
  }
}

let db = load();
takeSnapshot();

function save() {
  stampChanges();
  writeLocal();
  if (typeof onDataSaved === 'function') onDataSaved();
}

/* ---------- Abfragen ---------- */
const byId = (list, id) => list.find((x) => x.id === id);

function sortedEvents() {
  return [...db.events].sort((a, b) => (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')));
}

// Wiederkehrende To-Dos gelten als erledigt, wenn sie heute abgehakt wurden –
// am nächsten Tag sind sie automatisch wieder offen.
const isDone = (t) => (t.repeat ? t.doneOn === today() : !!t.done);

function activeToday(t) {
  if (t.repeat !== 'weekdays') return true;
  const wd = new Date().getDay();
  return wd >= 1 && wd <= 5;
}

const byPriority = (a, b) =>
  (a.due || '9999').localeCompare(b.due || '9999') || (b.prio || 2) - (a.prio || 2) || a.created - b.created;

// Alles, was heute noch offen ist: wiederkehrende zuerst, dann einmalige nach Fälligkeit.
function openTodosSorted(area) {
  const inArea = db.todos.filter((t) => !area || t.area === area);
  const recurring = inArea.filter((t) => t.repeat && activeToday(t) && !isDone(t)).sort((a, b) => a.created - b.created);
  const once = inArea.filter((t) => !t.repeat && !t.done).sort(byPriority);
  return [...recurring, ...once];
}

function goalProgress(g) {
  if (!g.steps.length) return 0;
  return Math.round((g.steps.filter((s) => s.done).length / g.steps.length) * 100);
}

function quoteOfDay() {
  const favs = db.quotes.filter((q) => q.fav);
  const pool = favs.length ? favs : db.quotes;
  if (!pool.length) return null;
  const t = today();
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/* ---------- Geburtstage ---------- */
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// Datum des Geburtstags in einem bestimmten Jahr (29. Februar → 28. Februar in Nicht-Schaltjahren).
function birthdayInYear(b, y) {
  const day = b.month === 2 && b.day === 29 && !isLeap(y) ? 28 : b.day;
  return `${y}-${pad(b.month)}-${pad(day)}`;
}

function nextBirthday(b, from = today()) {
  const y = Number(from.slice(0, 4));
  const ds = birthdayInYear(b, y);
  return ds >= from ? ds : birthdayInYear(b, y + 1);
}

const ageOn = (b, ds) => (b.year ? Number(ds.slice(0, 4)) - b.year : null);
const birthdaysOn = (ds) => db.birthdays.filter((b) => birthdayInYear(b, Number(ds.slice(0, 4))) === ds);
const daysUntil = (ds) => Math.round((parseDate(ds) - parseDate(today())) / 86400000);

function upcomingBirthdays(limitDays = 366) {
  return db.birthdays
    .map((b) => ({ b, date: nextBirthday(b) }))
    .filter((x) => daysUntil(x.date) <= limitDays)
    .sort((a, c) => a.date.localeCompare(c.date) || a.b.name.localeCompare(c.b.name, 'de'));
}

const validDayMonth = (d, m) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(2024, m, 0).getDate();

// Erkennt Zeilen wie "Anna Müller 12.03.1990", "Tom: 5.7.", "1990-03-12 Lisa" oder "Max – 3. März 1985".
function parseBirthdayLines(text) {
  const monthNames = { jan: 1, feb: 2, mär: 3, maer: 3, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12 };
  const found = [];
  const failed = [];
  const fixYear = (y) => {
    if (!y) return null;
    y = Number(y);
    if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
    return y >= 1900 && y <= new Date().getFullYear() ? y : null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    let day; let month; let year; let rest;
    if ((m = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      [, year, month, day] = m;
    } else if ((m = line.match(/(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*(\d{2,4}))?/))) {
      [, day, month, year] = m;
    } else if ((m = line.match(/(\d{1,2})\.?\s*(jan|feb|mär|maer|mar|apr|mai|jun|jul|aug|sep|okt|nov|dez)[a-zä]*\.?(?:\s*(\d{4}))?/i))) {
      day = m[1]; month = monthNames[m[2].toLowerCase()]; year = m[3];
    }
    if (m) rest = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).replace(/[\t|;,:–—-]+/g, ' ').replace(/\s+/g, ' ').trim();
    day = Number(day); month = Number(month);
    if (!m || !rest || !validDayMonth(day, month)) { failed.push(line); continue; }
    found.push({ name: rest, day, month, year: fixYear(year) });
  }
  return { found, failed };
}

function birthdayRow(b, ds) {
  const n = daysUntil(ds);
  const age = ageOn(b, ds);
  const parts = [`${b.day}. ${MONTHS[b.month - 1]}`];
  if (age) parts.push(n < 0 ? `wurde ${age}` : `wird ${age}`);
  if (n >= 0) parts.push(n === 0 ? 'Heute! 🎉' : n === 1 ? 'Morgen' : `in ${n} Tagen`);
  return `<button class="row bday-row ${n === 0 ? 'is-today' : ''}" data-action="editBirthday" data-id="${b.id}">
    <div class="bday-icon" aria-hidden="true">🎂</div>
    <div class="main">
      <div class="t">${esc(b.name)}</div>
      <div class="sub">${esc(parts.join(' · '))}</div>
    </div>
  </button>`;
}

const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- Bausteine ---------- */
function empty(text, action, label) {
  return `<div class="empty">${esc(text)}${action ? `<br><button class="link" data-action="${action}">${esc(label)}</button>` : ''}</div>`;
}

function eventRow(e, showDay) {
  const time = e.time ? `<span class="time">${esc(e.time)}</span>` : '<span class="allday">ganztägig</span>';
  const when = showDay
    ? `<div class="when"><span class="day">${esc(relDay(e.date))}</span>${time}</div>`
    : `<div class="when only-time">${time}</div>`;
  const sub = [e.location, e.note].filter(Boolean).map(esc).join(' · ');
  return `<button class="row" data-action="editEvent" data-id="${e.id}">
    ${when}
    <div class="main"><div class="t">${esc(e.title)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
  </button>`;
}

function dueChip(due) {
  if (!due) return '';
  const t = today();
  const cls = due < t ? 'overdue' : due === t ? 'today' : '';
  return `<span class="chip ${cls}">${due < t ? 'überfällig · ' : ''}${esc(relDay(due))}</span>`;
}

function todoRow(t, showArea = false) {
  const prio = t.prio || 2;
  const done = isDone(t);
  return `<div class="row ${done ? 'done' : ''}">
    <button class="check ${done ? 'on' : ''}" data-action="toggleTodo" data-id="${t.id}" role="checkbox" aria-checked="${done}" aria-label="Erledigt: ${esc(t.title)}"></button>
    <button class="main" data-action="editTodo" data-id="${t.id}">
      <div class="t">${esc(t.title)}</div>
      <div class="sub">
        ${showArea ? `<span class="chip area-${t.area}">${AREAS[t.area]}</span>` : ''}
        ${t.repeat ? `<span class="chip repeat">${REPEAT_CHIPS[t.repeat]}</span>` : ''}
        <span><span class="prio prio-${prio}"></span> ${PRIOS[prio]}</span>
        ${done || t.repeat ? '' : dueChip(t.due)}
      </div>
    </button>
  </div>`;
}

function goalMeta(g) {
  const done = g.steps.filter((s) => s.done).length;
  const parts = [`${goalProgress(g)} %`];
  if (g.steps.length) parts.push(`${done}/${g.steps.length} Schritte`);
  if (g.target) parts.push(`bis ${parseDate(g.target).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`);
  return parts.join(' · ');
}

function goalMini(g) {
  return `<button class="goal-mini" data-action="go" data-id="ziele">
    <div class="t">${esc(g.title)}</div>
    <div class="bar"><span style="width:${goalProgress(g)}%"></span></div>
    <div class="meta">${esc(goalMeta(g))}</div>
  </button>`;
}

function installHint() {
  if (isStandalone() || db.hideInstallHint || !isIOS()) return '';
  return `<div class="notice">
    <strong>Als App installieren</strong>
    Tippe in Safari auf <b>Teilen</b> und dann <b>„Zum Home-Bildschirm“</b>. Wichtig: Die installierte App hat ihren eigenen Speicher. Trage deine Daten also erst dort ein.
    <div class="actions"><button class="link" data-action="hideInstallHint">Ausblenden</button></div>
  </div>`;
}

/* ---------- Ansichten ---------- */
const views = {
  heute() {
    const t = today();
    const h = new Date().getHours();
    const greet = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
    const q = quoteOfDay();
    const events = sortedEvents().filter((e) => e.date >= t).slice(0, 4);
    const allOpen = openTodosSorted();
    const todos = allOpen.slice(0, 6);
    const openCount = allOpen.length;
    const goals = [...db.goals].sort((a, b) => goalProgress(a) - goalProgress(b)).slice(0, 3);

    return `${installHint()}
    <div class="hero">
      <p class="eyebrow">${esc(fmtDate(t, true))}</p>
      <h2>${greet}${db.name ? ', ' + esc(db.name) : ''}</h2>
    </div>
    ${q ? `<blockquote class="quote" data-action="go" data-id="motivation">
      <span class="label">Gedanke des Tages</span>
      <p>${esc(q.text)}</p>${q.author ? `<footer>— ${esc(q.author)}</footer>` : ''}
    </blockquote>` : ''}
    <section>
      <div class="sec-head"><h2>Nächste Termine</h2><button class="link" data-action="go" data-id="termine">Alle</button></div>
      <div class="card list">${events.length ? events.map((e) => eventRow(e, true)).join('') : empty('Keine anstehenden Termine.', 'addEvent', 'Termin eintragen')}</div>
    </section>
    <section>
      <div class="sec-head"><h2>To-Dos${openCount ? ` <span class="meta">(${openCount} offen)</span>` : ''}</h2><button class="link" data-action="go" data-id="todos">Alle</button></div>
      <div class="card list">${todos.length ? todos.map((x) => todoRow(x, true)).join('') : empty('Alles erledigt. 🎉', 'addTodo', 'To-Do hinzufügen')}</div>
    </section>
    <section>
      <div class="sec-head"><h2>Ziele</h2><button class="link" data-action="go" data-id="ziele">Alle</button></div>
      <div class="card list">${goals.length ? goals.map(goalMini).join('') : empty('Noch keine Ziele.', 'addGoal', 'Ziel festlegen')}</div>
    </section>`;
  },

  termine() {
    const t = today();
    const sel = ui.selDay;
    const [y, m] = ui.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // Woche beginnt am Montag
    const weeks = Math.ceil((offset + daysInMonth) / 7);

    const evCount = {};
    for (const e of db.events) evCount[e.date] = (evCount[e.date] || 0) + 1;
    const todoDue = new Set(db.todos.filter((x) => !x.repeat && !x.done && x.due).map((x) => x.due));

    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const ds = dateStr(new Date(y, m - 1, 1 - offset + i));
      const d = parseDate(ds);
      const cls = ['cal-day'];
      if (d.getMonth() !== m - 1) cls.push('out');
      if (ds === t) cls.push('today');
      if (ds === sel) cls.push('sel');
      const n = Math.min(evCount[ds] || 0, 3);
      const dots = '<span class="dot"></span>'.repeat(n)
        + (todoDue.has(ds) ? '<span class="dot todo"></span>' : '')
        + (birthdaysOn(ds).length ? '<span class="dot bday"></span>' : '');
      cells.push(`<button class="${cls.join(' ')}" data-action="pickDay" data-id="${ds}" aria-pressed="${ds === sel}" aria-label="${esc(fmtDate(ds, true))}${evCount[ds] ? `, ${evCount[ds]} Termin(e)` : ''}">
        <span class="num">${d.getDate()}</span><span class="dots">${dots}</span>
      </button>`);
    }

    const dayEvents = sortedEvents().filter((e) => e.date === sel);
    const dayTodos = db.todos.filter((x) => !x.repeat && !x.done && x.due === sel);
    const dayBdays = birthdaysOn(sel);
    const nextBdays = upcomingBirthdays().slice(0, 4);
    const upcoming = sortedEvents().filter((e) => e.date > sel && e.date >= t).slice(0, 5);
    const monthLabel = first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const showTodayBtn = sel !== t || ui.calMonth !== t.slice(0, 7);

    return `<div class="card cal" id="cal">
      <div class="cal-head">
        <button class="icon-btn" data-action="calNav" data-id="-1" aria-label="Voriger Monat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
        <h2>${esc(monthLabel)}</h2>
        <button class="icon-btn" data-action="calNav" data-id="1" aria-label="Nächster Monat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>
      <div class="cal-grid">
        ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<div class="cal-wd">${w}</div>`).join('')}
        ${cells.join('')}
      </div>
    </div>
    <p class="small cal-legend"><span class="dot"></span> Termin <span class="dot todo"></span> To-Do fällig <span class="dot bday"></span> Geburtstag · Tippe einen Tag zweimal an, um direkt einzutragen.</p>

    <section>
      <div class="sec-head">
        <h2>${esc(relDay(sel, true))}${[t, addDays(t, 1), addDays(t, -1)].includes(sel) ? `<span class="meta"> · ${esc(fmtDate(sel))}</span>` : ''}</h2>
        ${showTodayBtn ? '<button class="link" data-action="calToday">Heute</button>' : ''}
      </div>
      <div class="card list">
        ${dayBdays.map((b) => birthdayRow(b, sel)).join('')}
        ${dayEvents.map((e) => eventRow(e, false)).join('')}
        ${dayTodos.map((x) => todoRow(x, true)).join('')}
        <button class="row add-row" data-action="addEvent">${ICON.plus}<span>Termin eintragen</span></button>
      </div>
    </section>

    ${upcoming.length ? `<section>
      <div class="sec-head"><h2>Danach</h2></div>
      <div class="card list">${upcoming.map((e) => eventRow(e, true)).join('')}</div>
    </section>` : ''}

    <section>
      <div class="sec-head"><h2>🎂 Geburtstage</h2><button class="link" data-action="go" data-id="geburtstage">${db.birthdays.length ? `Alle (${db.birthdays.length})` : 'Öffnen'}</button></div>
      <div class="card list">${nextBdays.length
        ? nextBdays.map(({ b, date }) => birthdayRow(b, date)).join('')
        : '<div class="empty">Noch keine Geburtstage eingetragen.<br><button class="link" data-action="go" data-id="geburtstage">Geburtstage anlegen</button></div>'}</div>
    </section>`;
  },

  geburtstage() {
    const list = upcomingBirthdays();
    const byMonth = new Map();
    for (const x of list) {
      const key = x.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(x);
    }
    const actionsBar = `<div class="card list" style="margin-bottom:18px">
      <button class="btn-row" data-action="addBirthday">${ICON.plus} Geburtstag hinzufügen</button>
      <button class="btn-row" data-action="bulkBirthdays">${ICON.upload} Liste einfügen</button>
    </div>`;
    if (!list.length) {
      return actionsBar + '<p class="small">Tipp: Mit „Liste einfügen“ kannst du viele Geburtstage auf einmal eintragen – eine Person pro Zeile, z. B. „Anna Müller 12.03.1990“.</p>';
    }
    return actionsBar + [...byMonth.entries()].map(([key, items]) => `
      <div class="day-head">${esc(parseDate(`${key}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))}</div>
      <div class="card list">${items.map(({ b, date }) => birthdayRow(b, date)).join('')}</div>`).join('');
  },

  todos() {
    const area = ui.todoArea;
    const inArea = db.todos.filter((t) => t.area === area);
    const recurring = inArea.filter((t) => t.repeat).sort((a, b) => a.created - b.created);
    const recurringToday = recurring.filter(activeToday);
    const pausedCount = recurring.length - recurringToday.length;
    const once = inArea.filter((t) => !t.repeat);
    const openOnce = once.filter((t) => !t.done).sort(byPriority);
    const doneOnce = once.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const showDone = ui.todoFilter === 'done';
    const openCount = (a) => openTodosSorted(a).length;
    const recurringDone = recurringToday.filter(isDone).length;

    const areaSwitch = `<div class="segment area-switch" role="tablist" aria-label="Bereich">
      ${Object.entries(AREAS).map(([k, label]) => `<button class="${area === k ? 'on' : ''}" data-action="todoArea" data-id="${k}" role="tab" aria-selected="${area === k}">${label}${openCount(k) ? ` (${openCount(k)})` : ''}</button>`).join('')}
    </div>`;

    const dailySection = recurring.length ? `<section>
      <div class="sec-head"><h2>Wiederkehrend</h2>${recurringToday.length ? `<span class="meta">${recurringDone}/${recurringToday.length} heute erledigt</span>` : ''}</div>
      ${recurringToday.length ? `<div class="bar slim"><span style="width:${Math.round((recurringDone / recurringToday.length) * 100)}%"></span></div>` : ''}
      <div class="card list">${recurringToday.length ? recurringToday.map((t) => todoRow(t)).join('') : empty('Heute ist Wochenende – deine Werktags-Aufgaben pausieren.')}</div>
      ${pausedCount && recurringToday.length ? `<p class="small">${pausedCount} Werktags-Aufgabe(n) pausieren am Wochenende.</p>` : ''}
    </section>` : '';

    const onceSection = `<section>
      ${recurring.length ? '<div class="sec-head"><h2>Einmalig</h2></div>' : ''}
      <div class="segment" role="tablist">
        <button class="${!showDone ? 'on' : ''}" data-action="todoFilter" data-id="open" role="tab" aria-selected="${!showDone}">Offen (${openOnce.length})</button>
        <button class="${showDone ? 'on' : ''}" data-action="todoFilter" data-id="done" role="tab" aria-selected="${showDone}">Erledigt (${doneOnce.length})</button>
      </div>
      <div class="card list">${showDone
        ? (doneOnce.length ? doneOnce.map((t) => todoRow(t)).join('') : empty('Noch nichts erledigt.'))
        : (openOnce.length ? openOnce.map((t) => todoRow(t)).join('') : empty(`Keine offenen To-Dos im Bereich ${AREAS[area]}.`, 'addTodo', 'To-Do hinzufügen'))}</div>
      ${showDone && doneOnce.length ? '<p style="text-align:center"><button class="link" data-action="clearDone">Erledigte entfernen</button></p>' : ''}
    </section>`;

    const hint = !recurring.length && area === 'arbeit'
      ? '<p class="small" style="margin:-4px 4px 16px">Tipp: Lege ein To-Do mit „Wiederholen: Täglich“ oder „Werktags“ an. Es ist jeden Tag wieder offen.</p>'
      : '';

    return areaSwitch + hint + dailySection + onceSection;
  },

  ziele() {
    if (!db.goals.length) return `<div class="card">${empty('Was möchtest du erreichen? Lege dein erstes Ziel mit Teilschritten an.', 'addGoal', 'Ziel festlegen')}</div>`;
    return db.goals.map((g) => `<article class="card goal">
      <div class="goal-head">
        <div><span class="cat">${esc(g.category || 'Ziel')}</span><h3>${esc(g.title)}</h3></div>
        <button class="icon-btn" data-action="editGoal" data-id="${g.id}" aria-label="Ziel bearbeiten">${ICON.edit}</button>
      </div>
      ${g.why ? `<p class="why">${esc(g.why)}</p>` : ''}
      <div class="bar"><span style="width:${goalProgress(g)}%"></span></div>
      <div class="meta">${esc(goalMeta(g))}</div>
      ${g.steps.length ? `<ul class="steps">${g.steps.map((s) => `<li class="${s.done ? 'done' : ''}">
        <button class="check ${s.done ? 'on' : ''}" data-action="toggleStep" data-id="${g.id}:${s.id}" role="checkbox" aria-checked="${!!s.done}" aria-label="${esc(s.text)}"></button>
        <span>${esc(s.text)}</span></li>`).join('')}</ul>` : '<p class="small">Tipp: Teile dein Ziel in Schritte auf, dann siehst du hier deinen Fortschritt.</p>'}
    </article>`).join('');
  },

  motivation() {
    const list = [...db.quotes].sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
    if (!list.length) return `<div class="card">${empty('Sammle hier Sprüche, Affirmationen und Texte, die dich antreiben.', 'addQuote', 'Text hinzufügen')}</div>`;
    return `<p class="small" style="margin:0 4px 12px">Mit ★ markierte Texte erscheinen bevorzugt als „Gedanke des Tages“.</p>
    ${list.map((q) => `<div class="card q-card">
      <button class="main" data-action="editQuote" data-id="${q.id}">
        <p>${esc(q.text)}</p>${q.author ? `<div class="author">— ${esc(q.author)}</div>` : ''}
      </button>
      <button class="star ${q.fav ? 'on' : ''}" data-action="toggleFav" data-id="${q.id}" aria-pressed="${!!q.fav}" aria-label="Favorit">${ICON.star}</button>
    </div>`).join('')}`;
  },

  settings() {
    const stats = `${db.events.length} Termine · ${db.todos.length} To-Dos · ${db.goals.length} Ziele · ${db.quotes.length} Texte`;
    return `<section>
      <div class="card setting">
        <label for="set-name">Dein Name (für die Begrüßung)</label>
        <input id="set-name" data-bind="name" value="${esc(db.name)}" placeholder="Vorname" autocomplete="given-name">
      </div>
    </section>
    ${typeof syncSection === 'function' ? syncSection() : ''}
    ${typeof pushSection === 'function' ? pushSection() : ''}
    <section>
      <div class="sec-head"><h2>Datensicherung</h2></div>
      <div class="card list">
        <button class="btn-row" data-action="exportData">${ICON.download} Backup exportieren</button>
        <button class="btn-row" data-action="importData">${ICON.upload} Backup importieren</button>
      </div>
      <p class="small">Exportiere ab und zu ein Backup und speichere es z. B. in der „Dateien“-App oder in iCloud Drive. ${esc(stats)}.</p>
    </section>
    <section>
      <div class="sec-head"><h2>Installation</h2></div>
      <div class="card setting" style="font-size:15px">
        ${isStandalone() ? '✅ Läuft als installierte App.' : 'Öffne diese Seite in Safari und tippe auf <b>Teilen → „Zum Home-Bildschirm“</b>.'}
        <p class="small" style="margin:8px 0 0">Die installierte App und Safari haben getrennte Speicher. Mit dem Abgleich (oben) oder Export/Import kannst du Daten übertragen.</p>
      </div>
    </section>
    <section>
      <div class="card list">
        <button class="btn-row danger" data-action="resetAll">${ICON.trash} Alle Daten löschen</button>
      </div>
    </section>`;
  },
};

/* ---------- Rendern ---------- */
const ui = { tab: 'heute', todoFilter: 'open', todoArea: 'arbeit', selDay: today(), calMonth: today().slice(0, 7) };

function selectDay(ds) {
  ui.selDay = ds;
  ui.calMonth = ds.slice(0, 7);
}

function shiftMonth(dir) {
  const [y, m] = ui.calMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  ui.calMonth = dateStr(d).slice(0, 7);
  // Ausgewählten Tag in den neuen Monat mitnehmen (heute, falls es der aktuelle Monat ist, sonst der 1.)
  ui.selDay = ui.calMonth === today().slice(0, 7) ? today() : dateStr(d);
  render();
}

// Wischen nach links/rechts im Kalender wechselt den Monat.
let touchX = null;
document.addEventListener('touchstart', (e) => {
  touchX = e.target.closest('#cal') ? e.touches[0].clientX : null;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 60) shiftMonth(dx < 0 ? 1 : -1);
}, { passive: true });

function render() {
  $('#view').innerHTML = views[ui.tab]();
  $('#title').textContent = TITLES[ui.tab];
  document.title = `${TITLES[ui.tab]} · Lebens-Dashboard`;
  $('#fab').hidden = ui.tab === 'settings';
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === (PARENT_TAB[ui.tab] || ui.tab);
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function commit() { save(); render(); }

/* ---------- Bottom-Sheet ---------- */
let sheetSubmit = null;
let sheetCloseTimer = null;

function openSheet(html) {
  const sheet = $('#sheet');
  const backdrop = $('#backdrop');
  clearTimeout(sheetCloseTimer);
  sheet.innerHTML = `<div class="grab"></div>${html}`;
  sheet.hidden = false;
  backdrop.hidden = false;
  void sheet.offsetHeight; // Layout erzwingen, damit die Einblend-Animation startet
  sheet.classList.add('open');
  backdrop.classList.add('open');
}

function closeSheet() {
  const sheet = $('#sheet');
  const backdrop = $('#backdrop');
  sheet.classList.remove('open');
  backdrop.classList.remove('open');
  sheetSubmit = null;
  clearTimeout(sheetCloseTimer);
  sheetCloseTimer = setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; sheet.innerHTML = ''; }, 260);
}

function fieldHtml(f, v) {
  const id = `f-${f.name}`;
  const req = f.required ? 'required' : '';
  const val = v ?? '';
  let input;
  if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" placeholder="${esc(f.placeholder || '')}" ${req}>${esc(val)}</textarea>`;
  } else if (f.type === 'select') {
    input = `<select id="${id}" name="${f.name}">${f.options.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  } else {
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${req} autocomplete="off">`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}

function openForm({ title, fields, values = {}, onSave, onDelete, deleteLabel = 'Löschen' }) {
  const rows = fields.map((f) => Array.isArray(f)
    ? `<div class="field-row">${f.map((x) => fieldHtml(x, values[x.name])).join('')}</div>`
    : fieldHtml(f, values[f.name])).join('');
  openSheet(`<form id="sheet-form" novalidate>
    <div class="sheet-head">
      <button type="button" data-action="closeSheet">Abbrechen</button>
      <h2 id="sheet-title">${esc(title)}</h2>
      <button type="submit" class="save">Sichern</button>
    </div>
    ${rows}
    ${onDelete ? `<button type="button" class="delete-btn" data-action="sheetDelete">${esc(deleteLabel)}</button>` : ''}
  </form>`);
  sheetSubmit = { onSave, onDelete, fields: fields.flat() };
}

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'sheet-form' || !sheetSubmit) return;
  e.preventDefault();
  const form = e.target;
  const data = {};
  for (const f of sheetSubmit.fields) data[f.name] = (form.elements[f.name]?.value ?? '').trim();
  const missing = sheetSubmit.fields.find((f) => f.required && !data[f.name]);
  if (missing) {
    form.elements[missing.name].focus();
    toast(`Bitte „${missing.label}“ ausfüllen`);
    return;
  }
  if (sheetSubmit.onSave(data) === false) return; // Formular bleibt offen, z. B. bei ungültigem Datum
  closeSheet();
  commit();
});

/* ---------- Formulare ---------- */
function eventForm(ev, date) {
  openForm({
    title: ev ? 'Termin bearbeiten' : 'Neuer Termin',
    values: ev || { date: date || today() },
    fields: [
      { name: 'title', label: 'Titel', required: true, placeholder: 'z. B. Zahnarzt' },
      [{ name: 'date', label: 'Datum', type: 'date', required: true }, { name: 'time', label: 'Uhrzeit', type: 'time' }],
      { name: 'location', label: 'Ort', placeholder: 'optional' },
      { name: 'note', label: 'Notiz', type: 'textarea', placeholder: 'optional' },
    ],
    onSave(d) {
      if (ev) Object.assign(ev, d);
      else db.events.push({ id: uid(), ...d });
      selectDay(d.date);
    },
    onDelete: ev && (() => { db.events = db.events.filter((x) => x !== ev); }),
  });
}

function todoForm(t) {
  openForm({
    title: t ? 'To-Do bearbeiten' : 'Neues To-Do',
    values: t || { prio: 2, area: ui.tab === 'todos' ? ui.todoArea : 'privat', repeat: '' },
    fields: [
      { name: 'title', label: 'Was ist zu tun?', required: true, placeholder: 'z. B. E-Mails beantworten' },
      [
        { name: 'area', label: 'Bereich', type: 'select', options: Object.entries(AREAS) },
        { name: 'repeat', label: 'Wiederholen', type: 'select', options: Object.entries(REPEATS) },
      ],
      [
        { name: 'due', label: 'Fällig am', type: 'date', hint: 'Nur bei einmaligen To-Dos' },
        { name: 'prio', label: 'Priorität', type: 'select', options: [[3, 'Hoch'], [2, 'Normal'], [1, 'Niedrig']] },
      ],
    ],
    onSave(d) {
      d.prio = Number(d.prio) || 2;
      if (d.repeat) d.due = '';
      if (t) {
        if (t.repeat !== d.repeat) { t.done = false; t.doneAt = null; t.doneOn = null; }
        Object.assign(t, d);
      } else {
        db.todos.push({ id: uid(), ...d, done: false, doneOn: null, created: Date.now() });
      }
      ui.todoArea = d.area;
    },
    onDelete: t && (() => { db.todos = db.todos.filter((x) => x !== t); }),
  });
}

function goalForm(g) {
  openForm({
    title: g ? 'Ziel bearbeiten' : 'Neues Ziel',
    values: g ? { ...g, steps: g.steps.map((s) => s.text).join('\n') } : { category: 'Persönlich' },
    fields: [
      { name: 'title', label: 'Ziel', required: true, placeholder: 'z. B. 10 km laufen' },
      [{ name: 'category', label: 'Bereich', type: 'select', options: CATEGORIES.map((c) => [c, c]) }, { name: 'target', label: 'Zieldatum', type: 'date' }],
      { name: 'why', label: 'Warum ist mir das wichtig?', type: 'textarea', placeholder: 'Dein Antrieb, für schwierige Tage' },
      { name: 'steps', label: 'Teilschritte', type: 'textarea', placeholder: 'Ein Schritt pro Zeile', hint: 'Ein Schritt pro Zeile. Abgehakte Schritte bleiben erhalten.' },
    ],
    onSave(d) {
      const old = g ? g.steps : [];
      const steps = d.steps.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => {
        const prev = old.find((s) => s.text === text);
        return prev || { id: uid(), text, done: false };
      });
      const rec = { title: d.title, category: d.category, target: d.target, why: d.why, steps };
      if (g) Object.assign(g, rec);
      else db.goals.push({ id: uid(), ...rec, created: Date.now() });
    },
    onDelete: g && (() => { db.goals = db.goals.filter((x) => x !== g); }),
  });
}

function quoteForm(q) {
  openForm({
    title: q ? 'Text bearbeiten' : 'Neuer Text',
    values: q || {},
    fields: [
      { name: 'text', label: 'Spruch, Affirmation oder Text', type: 'textarea', required: true, placeholder: 'Was motiviert dich?' },
      { name: 'author', label: 'Von (optional)', placeholder: 'z. B. Autor oder Quelle' },
    ],
    onSave(d) {
      if (q) Object.assign(q, d);
      else db.quotes.unshift({ id: uid(), ...d, fav: false });
    },
    onDelete: q && (() => { db.quotes = db.quotes.filter((x) => x !== q); }),
  });
}

function birthdayForm(b) {
  openForm({
    title: b ? 'Geburtstag bearbeiten' : 'Neuer Geburtstag',
    values: b ? { ...b, year: b.year || '' } : { day: '', month: '' },
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'z. B. Anna Müller' },
      [
        { name: 'day', label: 'Tag', type: 'select', required: true, options: [['', '–'], ...Array.from({ length: 31 }, (_, i) => [i + 1, i + 1])] },
        { name: 'month', label: 'Monat', type: 'select', required: true, options: [['', '–'], ...MONTHS.map((mn, i) => [i + 1, mn])] },
      ],
      { name: 'year', label: 'Geburtsjahr (optional)', type: 'number', placeholder: 'z. B. 1990', hint: 'Mit Jahr zeigt die App an, wie alt die Person wird.' },
    ],
    onSave(d) {
      const day = Number(d.day);
      const month = Number(d.month);
      const year = d.year ? Number(d.year) : null;
      if (!validDayMonth(day, month)) { toast('Dieses Datum gibt es nicht'); return false; }
      if (year && (year < 1900 || year > new Date().getFullYear())) { toast('Bitte ein gültiges Geburtsjahr eingeben'); return false; }
      const rec = { name: d.name, day, month, year };
      if (b) Object.assign(b, rec);
      else db.birthdays.push({ id: uid(), ...rec });
    },
    onDelete: b && (() => { db.birthdays = db.birthdays.filter((x) => x !== b); }),
  });
}

function bulkBirthdaysSheet() {
  openSheet(`<form id="bulk-form" novalidate>
    <div class="sheet-head">
      <button type="button" data-action="closeSheet">Abbrechen</button>
      <h2 id="sheet-title">Liste einfügen</h2>
      <button type="submit" class="save">Hinzufügen</button>
    </div>
    <div class="field">
      <label for="bulk-text">Eine Person pro Zeile</label>
      <textarea id="bulk-text" name="text" rows="10" placeholder="Anna Müller 12.03.1990&#10;Tom Becker 5.7.&#10;Oma Inge – 3. März 1941"></textarea>
      <div class="hint">Name und Datum in beliebiger Reihenfolge. Das Jahr ist optional. Bereits vorhandene Einträge werden übersprungen.</div>
    </div>
  </form>`);
}

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'bulk-form') return;
  e.preventDefault();
  const { found, failed } = parseBirthdayLines(e.target.elements.text.value);
  if (!found.length) { toast(failed.length ? 'Keine Zeile erkannt – Format prüfen' : 'Bitte eine Liste einfügen'); return; }
  const key = (b) => `${b.name.toLowerCase()}|${b.day}|${b.month}`;
  const existing = new Set(db.birthdays.map(key));
  let added = 0;
  for (const b of found) {
    if (existing.has(key(b))) continue;
    existing.add(key(b));
    db.birthdays.push({ id: uid(), ...b });
    added++;
  }
  closeSheet();
  commit();
  const skipped = found.length - added;
  let msg = `${added} Geburtstag${added === 1 ? '' : 'e'} hinzugefügt.`;
  if (skipped) msg += `\n${skipped} waren schon vorhanden.`;
  if (failed.length) msg += `\n\nDiese Zeilen konnte ich nicht lesen:\n${failed.slice(0, 15).join('\n')}${failed.length > 15 ? '\n…' : ''}`;
  if (failed.length || skipped) alert(msg); else toast(msg);
});

function chooser() {
  openSheet(`<div class="sheet-head"><span></span><h2 id="sheet-title">Hinzufügen</h2><button type="button" data-action="closeSheet">Fertig</button></div>
  <div class="chooser">
    <button data-action="addEvent">${ICON.cal}Termin</button>
    <button data-action="addTodo">${ICON.todo}To-Do</button>
    <button data-action="addGoal">${ICON.goal}Ziel</button>
    <button data-action="addQuote">${ICON.star}Motivation</button>
    <button data-action="addBirthday"><span class="chooser-emoji" aria-hidden="true">🎂</span>Geburtstag</button>
  </div>`);
}

/* ---------- Export / Import ---------- */
async function exportData() {
  const json = JSON.stringify({ ...db, exportedAt: new Date().toISOString() }, null, 2);
  const name = `lebens-dashboard-backup-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Lebens-Dashboard Backup' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup heruntergeladen');
}

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !COLLECTIONS.some((k) => Array.isArray(data[k]))) {
      throw new Error('Kein gültiges Backup');
    }
    if (!confirm('Backup importieren? Deine aktuellen Daten werden dabei ersetzt.')) return;
    delete data.exportedAt;
    db = migrate(data);
    commit();
    toast('Backup importiert');
  } catch (err) {
    console.error(err);
    toast('Datei konnte nicht gelesen werden');
  }
});

/* ---------- Aktionen ---------- */
const actions = {
  go(id) {
    closeSheet();
    ui.tab = id;
    render();
    window.scrollTo(0, 0);
  },
  add() {
    ({ termine: () => eventForm(null, ui.selDay), todos: () => todoForm(), ziele: () => goalForm(), motivation: () => quoteForm(), geburtstage: () => birthdayForm() }[ui.tab] || chooser)();
  },
  addBirthday: () => birthdayForm(),
  editBirthday: (id) => birthdayForm(byId(db.birthdays, id)),
  bulkBirthdays: bulkBirthdaysSheet,
  addEvent: () => eventForm(null, ui.tab === 'termine' ? ui.selDay : today()),
  addTodo: () => todoForm(),
  addGoal: () => goalForm(),
  addQuote: () => quoteForm(),
  editEvent: (id) => eventForm(byId(db.events, id)),
  editTodo: (id) => todoForm(byId(db.todos, id)),
  editGoal: (id) => goalForm(byId(db.goals, id)),
  editQuote: (id) => quoteForm(byId(db.quotes, id)),
  closeSheet,
  sheetDelete() {
    if (!sheetSubmit?.onDelete || !confirm('Wirklich löschen?')) return;
    sheetSubmit.onDelete();
    closeSheet();
    commit();
  },
  toggleTodo(id) {
    const t = byId(db.todos, id);
    if (!t) return;
    if (t.repeat) {
      t.doneOn = isDone(t) ? null : today();
    } else {
      t.done = !t.done;
      t.doneAt = t.done ? Date.now() : null;
    }
    commit();
    if (isDone(t)) toast(t.repeat ? 'Für heute erledigt ✓' : 'Erledigt ✓');
  },
  toggleStep(key) {
    const [gid, sid] = key.split(':');
    const s = byId(byId(db.goals, gid)?.steps || [], sid);
    if (!s) return;
    s.done = !s.done;
    commit();
  },
  toggleFav(id) {
    const q = byId(db.quotes, id);
    if (q) { q.fav = !q.fav; commit(); }
  },
  todoFilter(id) { ui.todoFilter = id; render(); },
  todoArea(id) { ui.todoArea = id; ui.todoFilter = 'open'; render(); },
  pickDay(ds) {
    if (ds === ui.selDay) { eventForm(null, ds); return; }
    selectDay(ds);
    render();
  },
  calNav(dir) { shiftMonth(Number(dir)); },
  calToday() { selectDay(today()); render(); },
  clearDone() {
    const isClearable = (t) => !t.repeat && t.done && t.area === ui.todoArea;
    const n = db.todos.filter(isClearable).length;
    if (!confirm(`${n} erledigte To-Dos entfernen?`)) return;
    db.todos = db.todos.filter((t) => !isClearable(t));
    commit();
  },
  hideInstallHint() { db.hideInstallHint = true; commit(); },
  exportData,
  importData() { $('#import-file').click(); },
  resetAll() {
    if (!confirm('Wirklich ALLE Daten löschen? Ist der Abgleich aktiv, werden sie auch auf deinen anderen Geräten gelöscht. Das kann nicht rückgängig gemacht werden – exportiere vorher ein Backup!')) return;
    db = defaults();
    commit();
    toast('Alle Daten gelöscht');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el.dataset.id, el); }
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.bind === 'name') {
    db.name = e.target.value.trim();
    save();
    toast('Gespeichert');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
});

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ---------- Updates ---------- */
// Bei jedem Öffnen prüfen, ob online eine neuere Version liegt, und dann neu laden.
async function checkForUpdate() {
  if (location.protocol === 'file:' || !navigator.onLine) return;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json();
    if (version === APP_VERSION || !$('#sheet').hidden) return;
    // Schutz vor Endlos-Schleife, falls der Cache noch die alte Version liefert
    if (sessionStorage.getItem('ld-update-tried') === version) return;
    sessionStorage.setItem('ld-update-tried', version);
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    location.reload();
  } catch (e) {
    console.warn('Update-Prüfung fehlgeschlagen', e);
  }
}

/* ---------- Netlify-Plakette ---------- */
// Netlify fügt unten rechts ein "Powered by Netlify"-Element ein. Solange es da ist,
// bekommt die Tab-Leiste mehr Abstand nach unten (siehe .has-nl-badge in styles.css).
function syncBadgeSpace() {
  document.body.classList.toggle('has-nl-badge', !!document.getElementById('nl-badge-frame'));
}
new MutationObserver(syncBadgeSpace).observe(document.body, { childList: true });
syncBadgeSpace();

/* ---------- Start ---------- */
// Beim Zurückkehren in die App neu zeichnen (z. B. nach Mitternacht) und nach Updates schauen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if ($('#sheet').hidden) { db = load(); takeSnapshot(); render(); }
  checkForUpdate();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch((e) => console.warn('Service Worker nicht registriert', e));
}

if (sessionStorage.getItem('ld-update-tried') === APP_VERSION) {
  sessionStorage.removeItem('ld-update-tried');
  setTimeout(() => toast('App aktualisiert ✨'), 400);
}

if (!localStorage.getItem(STORAGE_KEY)) save();
render();
checkForUpdate();
