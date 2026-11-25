// Study Brain (phone version). Everything runs on the phone; data is saved in
// the browser's localStorage. Same rules as the Flask version (app.py).

// ---------- storage ----------
const STORAGE_KEY = "studyBrain.v1"; // same key as the first phone version, so old data carries over
const DEFAULT_GOAL_HOURS = 10;
const TIRED_SECONDS = 3 * 3600;
const MAX_BOOKS = 40;
const DEFAULT_THEME = { bg: "#fff6f1", card: "#ffffff", text: "#4a3a40", accent: "#ff7eb3", button: "#ff9a5a" };

function load() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* fresh start */ }
  // sessions: [{id, subject, start, end}] with times in milliseconds
  return Object.assign(
    { classes: [], sessions: [], goalHours: DEFAULT_GOAL_HOURS, running: null, nextId: 1, theme: null },
    data || {}
  );
}

let state = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

function weekStart() {
  // Monday 00:00 of the current week, local time
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function formatClock(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHM(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

function formatWhen(ms) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3500);
}

function brainState(weekHours, runningSeconds) {
  if (runningSeconds >= TIRED_SECONDS) return "tired";
  if (weekHours < 2) return "asleep";
  if (weekHours < 8) return "waking";
  if (weekHours < 15) return "happy";
  return "buff";
}

function bookCount(weekHours) {
  return Math.min(Math.floor(weekHours * 2), MAX_BOOKS);
}

// White or dark text, whichever reads better on a button color.
function readableTextOn(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (299 * r + 587 * g + 114 * b) / 1000 > 186 ? "#3a2a30" : "#ffffff";
}

function sortedClasses() {
  return [...state.classes].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function button(className, title, text, onClick) {
  const b = document.createElement("button");
  b.className = className;
  b.title = title;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

// ---------- theme ----------
function currentTheme() {
  return Object.assign({}, DEFAULT_THEME, state.theme || {});
}

function applyTheme(theme) {
  const root = document.documentElement.style;
  for (const [key, value] of Object.entries(theme)) root.setProperty(`--${key}`, value);
  root.setProperty("--button-text", readableTextOn(theme.button));
}

// ---------- pages (bottom tab bar) ----------
function showPage() {
  const page = (location.hash || "#timer").slice(1);
  const known = ["timer", "sessions", "settings"].includes(page) ? page : "timer";
  document.querySelectorAll(".page").forEach((p) => { p.hidden = p.dataset.page !== known; });
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === known));
  $("gear").classList.toggle("active", known === "settings");
  // Unsaved color previews are dropped when you switch pages.
  const theme = currentTheme();
  applyTheme(theme);
  document.querySelectorAll("[data-key]").forEach((input) => { input.value = theme[input.dataset.key]; });
  window.scrollTo(0, 0);
}

// ---------- rendering ----------
// User text is always inserted with textContent (never innerHTML).

function renderSubjectSelects() {
  document.querySelectorAll(".subject-select").forEach((select) => {
    const current = select.value;
    select.replaceChildren(new Option("No subject", ""));
    sortedClasses().forEach((name) => select.add(new Option(name, name)));
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  });
  $("no-classes-hint").hidden = state.classes.length > 0 || !!state.running;
}

function renderClasses() {
  const list = $("class-list");
  list.replaceChildren();
  sortedClasses().forEach((name) => {
    const li = document.createElement("li");
    li.className = "tag";
    li.append(name, button("tag-x", "Remove", "✕", () => {
      if (!confirm("Remove this class? Past sessions keep their subject.")) return;
      state.classes = state.classes.filter((c) => c !== name);
      save();
      renderAll();
    }));
    list.append(li);
  });
}

function renderLog() {
  const sessions = [...state.sessions].sort((a, b) => b.start - a.start);
  const body = $("log-body");
  body.replaceChildren();
  const ws = weekStart();
  sessions.forEach((s) => {
    const tr = document.createElement("tr");
    if (s.start < ws) tr.className = "old";
    for (const text of [formatWhen(s.start), s.subject || "—", formatHM((s.end - s.start) / 1000)]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    const td = document.createElement("td");
    td.append(button("delete", "Delete", "✕", () => {
      if (!confirm("Delete this session?")) return;
      state.sessions = state.sessions.filter((x) => x.id !== s.id);
      save();
      renderAll();
    }));
    tr.append(td);
    body.append(tr);
  });
  $("log").hidden = sessions.length === 0;
  $("log-hint").textContent = sessions.length
    ? "Grayed-out rows are from earlier weeks."
    : "No sessions yet. Start the timer to log your first one!";
}

// Hours per class, this week + all time (same as class_totals() in app.py).
function renderClassTable() {
  const totals = new Map(state.classes.map((name) => [name, { week: 0, all: 0 }]));
  const ws = weekStart();
  for (const s of state.sessions) {
    const name = s.subject || "No subject";
    if (!totals.has(name)) totals.set(name, { week: 0, all: 0 });
    const t = totals.get(name);
    const secs = (s.end - s.start) / 1000;
    t.all += secs;
    if (s.start >= ws) t.week += secs;
  }
  const rows = [...totals.entries()].sort((a, b) => b[1].all - a[1].all || a[0].localeCompare(b[0]));
  const body = $("class-table-body");
  body.replaceChildren();
  let week = 0, all = 0;
  for (const [name, t] of rows) {
    week += t.week;
    all += t.all;
    const tr = document.createElement("tr");
    [[name, ""], [formatHM(t.week), "num"], [formatHM(t.all), "num"]].forEach(([text, cls]) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (cls) td.className = cls;
      tr.append(td);
    });
    body.append(tr);
  }
  $("class-total-week").textContent = formatHM(week);
  $("class-total-all").textContent = formatHM(all);
  $("class-table").hidden = rows.length === 0;
  $("class-table-hint").textContent = rows.length
    ? "Times are hours:minutes. A running session is added when you press Stop."
    : "Add classes on the Timer tab and study to see your hours here.";
}

function renderTimerControls() {
  const running = !!state.running;
  $("start-form").hidden = running;
  $("stop-btn").hidden = !running;
  $("studying").hidden = !running;
  if (running) $("studying-subject").textContent = state.running.subject || "No subject";
}

// Called every second: clock, weekly hours, goal progress, brain mood, books.
function tick() {
  const runningSeconds = state.running ? Math.max(0, (Date.now() - state.running.start) / 1000) : 0;
  const ws = weekStart();
  const finishedSeconds = state.sessions
    .filter((s) => s.start >= ws)
    .reduce((sum, s) => sum + (s.end - s.start) / 1000, 0);
  const hours = (finishedSeconds + runningSeconds) / 3600;
  const goal = state.goalHours;
  const pct = Math.min((hours / goal) * 100, 100);

  $("clock").textContent = formatClock(runningSeconds);
  $("week-total").textContent = hours.toFixed(1);
  $("goal-hours-done").textContent = hours.toFixed(1);
  $("goal-of").textContent = goal;
  $("progress-fill").style.width = `${pct}%`;
  $("progress-pct").textContent = `${Math.round(pct)}%`;
  $("goal-reached").hidden = hours < goal;

  const mood = brainState(hours, runningSeconds);
  document.querySelectorAll("[data-brain]").forEach((el) => {
    el.style.display = el.dataset.brain === mood ? "" : "none";
  });
  const books = bookCount(hours);
  document.querySelectorAll("[data-book]").forEach((el) => {
    el.style.display = Number(el.dataset.book) < books ? "" : "none";
  });
  $("book-count").textContent = books;
  $("book-word").textContent = books === 1 ? "book" : "books";
}

function renderAll() {
  renderSubjectSelects();
  renderClasses();
  renderLog();
  renderClassTable();
  renderTimerControls();
  $("goal-input").value = state.goalHours;
  tick();
}

// ---------- actions ----------

$("start-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (state.running) return;
  state.running = { subject: $("start-subject").value || null, start: Date.now() };
  save();
  renderAll();
});

$("stop-btn").addEventListener("click", () => {
  if (!state.running) return;
  state.sessions.push({ id: state.nextId++, subject: state.running.subject, start: state.running.start, end: Date.now() });
  state.running = null;
  save();
  renderAll();
});

$("class-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("class-name").value.trim();
  if (!name) return;
  if (state.classes.some((c) => c.toLowerCase() === name.toLowerCase())) {
    toast(`“${name}” is already in your classes.`);
    return;
  }
  state.classes.push(name);
  save();
  $("class-name").value = "";
  renderAll();
});

$("goal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const hours = Number($("goal-input").value);
  if (!(hours >= 0.5 && hours <= 100)) {
    toast("Weekly goal must be between 0.5 and 100 hours.");
    return;
  }
  state.goalHours = hours;
  save();
  renderAll();
  toast("Goal saved!");
});

$("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const start = new Date(`${$("add-date").value}T${$("add-time").value}`).getTime();
  const minutes = Number($("add-minutes").value);
  if (Number.isNaN(start)) {
    toast("Please fill in a valid date and start time.");
    return;
  }
  if (!(Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440)) {
    toast("Minutes must be a whole number between 1 and 1440 (24 hours).");
    return;
  }
  state.sessions.push({ id: state.nextId++, subject: $("add-subject").value || null, start, end: start + minutes * 60000 });
  save();
  $("add-minutes").value = "";
  renderAll();
  toast("Session added.");
});

// Settings: live preview while picking, Save keeps it, Reset goes back to default.
document.querySelectorAll("[data-key]").forEach((input) => {
  input.addEventListener("input", () => {
    const root = document.documentElement.style;
    root.setProperty(input.dataset.var, input.value);
    if (input.dataset.key === "button") root.setProperty("--button-text", readableTextOn(input.value));
  });
});

$("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const theme = {};
  document.querySelectorAll("[data-key]").forEach((input) => { theme[input.dataset.key] = input.value.toLowerCase(); });
  state.theme = { ...theme, "button-text": readableTextOn(theme.button) };
  save();
  applyTheme(theme);
  toast("Colors saved!");
});

$("reset-colors").addEventListener("click", () => {
  if (!confirm("Go back to the default colors?")) return;
  state.theme = null;
  save();
  showPage(); // re-applies defaults and refreshes the pickers
  toast("Colors reset to the default.");
});

function setTodayDefault() {
  const d = new Date();
  $("add-date").value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Refresh when you come back to the app (e.g. after locking the phone).
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { state = load(); renderAll(); }
});
window.addEventListener("storage", () => { state = load(); renderAll(); });
window.addEventListener("hashchange", showPage);

// ---------- start ----------
applyTheme(currentTheme());
setTodayDefault();
renderAll();
showPage();
setInterval(tick, 1000);

// Offline support: cache the app files so it opens with no internet.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
