// =====================================================================
//  НАСТРОЙКИ ПО УМОЛЧАНИЮ (потом их можно менять в приложении: «Ещё»)
// =====================================================================
const CONFIG = {
  // Отдых между подходами, в секундах, по типу упражнения
  REST: { big: 120, iso: 75, body: 90, time: 60, knee: 45 },
  BODY_TARGET: [83, 86],    // желаемый вес тела, кг (от и до)
  SOUND: true,              // звуковой сигнал в конце отдыха
  KEEP_AWAKE: true,         // не гасить экран во время тренировки
  BACKUP_REMIND_DAYS: 14,   // напоминать сохранить копию, если её не было столько дней
  STORAGE_KEY: 'trener.v1', // где хранятся данные в телефоне (не менять)
};
// =====================================================================

/* ---------- мелкие помощники ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : NaN; };
const fmt = (n) => (isFinite(n) ? String(Math.round(n * 100) / 100).replace('.', ',') : '');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = (o) => JSON.parse(JSON.stringify(o));
const DAY = 864e5;
const dayStart = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dateShort = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
const dateLong = (ts) => new Date(ts).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function plural(n, f) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return f[2]; if (n1 > 1 && n1 < 5) return f[1]; if (n1 === 1) return f[0]; return f[2]; }
function ago(ts) {
  const d = Math.round((dayStart(Date.now()) - dayStart(ts)) / DAY);
  if (d <= 0) return 'сегодня'; if (d === 1) return 'вчера';
  return `${d} ${plural(d, ['день', 'дня', 'дней'])} назад`;
}

/* ---------- данные ---------- */
function fresh() {
  return {
    v: 1,
    settings: { rest: { ...CONFIG.REST }, sound: CONFIG.SOUND, awake: CONFIG.KEEP_AWAKE, bodyTarget: [...CONFIG.BODY_TARGET] },
    program: clone(DEFAULT_PROGRAM), custom: {}, over: {}, sessions: [], body: [], active: null, timer: null, lastBackup: null,
  };
}
function load() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch (e) { return null; }
}
function normalize(d) {
  const f = fresh();
  const s = Object.assign(f, d);
  s.settings = Object.assign(fresh().settings, d.settings || {});
  s.settings.rest = Object.assign({ ...CONFIG.REST }, (d.settings || {}).rest || {});
  return s;
}
let S = load() || fresh();
let saveT = null;
function save() {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(S)); }
  catch (e) { toast('Не получилось сохранить: память телефона заполнена'); }
}
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 300); }

function ex(id) {
  const base = EXERCISES[id] || S.custom[id];
  if (!base) return null;
  return { id, ...base, ...(S.over[id] || {}) };
}
const restFor = (e) => e.rest ?? S.settings.rest[e.type] ?? 90;
const repsText = (e) => `${e.sets} × ${e.reps[0]}–${e.reps[1]}${e.type === 'time' ? ' с' : ''}`;
const placeName = (p) => (p === 'gym' ? 'зал' : p === 'home' ? 'дом' : 'зал или дом');

/* ---------- история и прогресс ---------- */
const finished = () => S.sessions.filter((s) => s.end).sort((a, b) => b.start - a.start);
function perfs(id) { // новые сверху
  const out = [];
  for (const s of finished()) for (const it of s.items) {
    if (it.ex !== id) continue;
    const d = it.sets.filter((x) => x.done);
    if (d.length) out.push({ ts: s.start, sets: d, sid: s.id });
  }
  return out;
}
const latestBody = () => (S.body.length ? S.body[S.body.length - 1].kg : 85);
// Чем меряем силу: расчётный максимум на 1 повтор (формула Эпли), а без веса — повторы или секунды
function metricKind(e, history) {
  if (e.type === 'time') return 'time';
  const anyW = history.some((p) => p.sets.some((x) => num(x.w) > 0));
  return anyW ? 'e1rm' : 'reps';
}
function metricVal(e, sets, kind) {
  if (kind === 'time' || kind === 'reps') return Math.max(...sets.map((x) => num(x.r) || 0));
  const bw = e.type === 'body' ? latestBody() : 0;
  return Math.max(...sets.map((x) => (bw + (num(x.w) || 0)) * (1 + Math.min(num(x.r) || 0, 15) / 30)));
}
const kindUnit = { time: 'с', reps: 'повт.', e1rm: 'кг' };
const kindLabel = { time: 'Лучшее время', reps: 'Лучший подход, повторов', e1rm: 'Сила: расчётный максимум на 1 раз' };

function fmtSet(e, s) {
  const w = num(s.w), r = s.r;
  if (e.type === 'time') return `${r} с`;
  return w > 0 ? `${fmt(w)}×${r}` : `${r}`;
}

// Что предложить сегодня: если в прошлый раз все подходы на верх диапазона — прибавить вес
function plan(id) {
  const e = ex(id);
  const p = perfs(id)[0];
  const zeroW = e.type === 'body' || e.type === 'time' || e.step === 0;
  if (!p) return { sets: Array.from({ length: e.sets }, () => ({ tw: zeroW ? '0' : '', tr: String(e.reps[0]) })), last: null, up: null };
  const ls = p.sets;
  const top = Math.max(...ls.map((x) => num(x.w) || 0));
  const hitAll = ls.length >= e.sets && ls.every((x) => (num(x.r) || 0) >= e.reps[1]);
  const inc = e.type === 'time' ? 5 : 1;
  let up = null;
  const sets = [];
  for (let i = 0; i < e.sets; i++) {
    const l = ls[Math.min(i, ls.length - 1)];
    let w = num(l.w) || 0, r = num(l.r) || 0;
    if (hitAll) {
      if (e.step > 0) { w = top + e.step; r = e.reps[0]; up = 'w'; }
      else { r = r + inc; up = 'r'; }
    } else {
      r = Math.min(e.reps[1], Math.max(e.reps[0], r + inc));
    }
    sets.push({ tw: fmt(w), tr: String(r) });
  }
  const heavy = !hitAll && ls.some((x) => (num(x.r) || 0) < e.reps[0] - 1);
  return { sets, last: p, up, heavy };
}

/* ---------- навигация ---------- */
const ui = { view: 'today', arg: null, tab: 'today', seg: 'ex', grp: 'all', confirm: null };
const TABS = ['today', 'program', 'progress', 'more'];
function go(view, arg = null) {
  ui.from = ui.view; ui.view = view; ui.arg = arg; ui.confirm = null;
  if (TABS.includes(view)) ui.tab = view;
  render();
  window.scrollTo(0, 0);
}
function render() {
  document.body.classList.toggle('in-workout', ui.view === 'workout');
  if (ui.view === 'workout' && !S.active) ui.view = 'today';
  $('#app').innerHTML = (VIEWS[ui.view] || VIEWS.today)(ui.arg);
  renderTabs();
  bindCharts();
  keepAwake(ui.view === 'workout');
}
const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M3.5 9.5v5M18 7v10M20.5 9.5v5M6 12h12"/></svg>',
  program: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M4 16l5-5 4 3 7-8"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
};
function renderTabs() {
  const names = { today: 'Сегодня', program: 'Программа', progress: 'Прогресс', more: 'Ещё' };
  $('#tabs').innerHTML = TABS.map((t) => `<button data-a="tab" data-v="${t}" class="${ui.tab === t ? 'on' : ''}" aria-label="${names[t]}">${ICONS[t]}<span>${names[t]}</span></button>`).join('');
}
const back = (v, arg = '') => `<button class="back" data-a="go" data-v="${v}" data-arg="${esc(arg)}" aria-label="Назад">‹</button>`;

/* ---------- экраны ---------- */
const VIEWS = {};

VIEWS.today = () => {
  const fin = finished();
  const last = fin[0];
  const order = S.program.map((w) => w.id);
  const nextIdx = last ? (order.indexOf(last.wid) + 1) % order.length : 0;
  const next = S.program[nextIdx] || S.program[0];
  let h = `<header class="top"><div style="flex:1"><h1>Сегодня</h1><div class="sub">${esc(dateLong(Date.now()))}</div></div></header>`;

  if (S.active) {
    const a = S.active;
    const total = a.items.reduce((n, it) => n + it.sets.length, 0);
    const done = a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
    h += `<div class="next"><div class="plate"></div><div class="label">Тренировка идёт · ${Math.round((Date.now() - a.start) / 60000)} мин</div>
      <div class="name">${esc(a.name)}</div><div class="what">Сделано ${done} из ${total} ${plural(total, ['подхода', 'подходов', 'подходов'])}</div>
      <button class="btn primary big wide" data-a="go" data-v="workout">Продолжить</button></div>`;
  } else if (next) {
    h += `<div class="next"><div class="plate"></div><div class="label">Следующая по плану</div>
      <div class="name">${esc(next.name)}</div><div class="what">${esc(next.subtitle || '')} · ~${estimate(next)} мин</div>
      <div class="groups">${groupsOf(next).map(([g, n]) => `<span><i style="background:${GROUPS[g].color}"></i>${GROUPS[g].name} ${n}</span>`).join('')}</div>
      <button class="btn primary big wide" data-a="start" data-v="${next.id}">Начать тренировку</button></div>
      <div class="others">${S.program.filter((w) => w.id !== next.id).map((w) => `<button data-a="start" data-v="${w.id}"><b>${esc(w.name)}</b><span>${esc(w.subtitle || '')}</span></button>`).join('')}</div>`;
  }
  if (last) h += `<p class="small muted" style="margin-top:12px">Прошлая: ${esc(last.name)}, ${ago(last.start)}</p>`;

  h += `<h2>Подходы за 7 дней</h2><div class="card">${volumeBars()}
    <p class="small muted" style="margin:8px 0 0">Рамка — сколько подходов в неделю нужно для роста мышц.</p></div>`;

  const bt = S.settings.bodyTarget;
  const lb = S.body[S.body.length - 1];
  h += `<h2>Вес тела</h2><div class="card"><div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:12px">
      <div style="flex:1"><div class="big-num">${lb ? fmt(lb.kg) : '—'}<span class="small muted"> кг</span></div>
      <div class="small muted">${lb ? `${ago(lb.ts)} · ` : ''}цель ${bt[0]}–${bt[1]} кг ${lb ? bodyStatus(lb.kg) : ''}</div></div></div>
      <div style="display:flex;gap:8px"><input id="bodyIn" class="num" inputmode="decimal" placeholder="Вес, кг" style="flex:1;height:48px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);padding:0 14px;font-size:18px">
      <button class="btn" data-a="addBody">Записать</button></div></div>`;

  const needBackup = S.sessions.length > 0 && (!S.lastBackup || Date.now() - S.lastBackup > CONFIG.BACKUP_REMIND_DAYS * DAY);
  if (needBackup) h += `<button class="row card" data-a="export" style="margin-top:12px"><div class="grow"><b>Сохрани копию тренировок</b><div class="small muted">Если телефон потеряется, записи останутся</div></div><span class="chev">›</span></button>`;
  return h;
};
function bodyStatus(kg) {
  const [a, b] = S.settings.bodyTarget;
  if (kg < a) return `· ниже на ${fmt(a - kg)}`;
  if (kg > b) return `· выше на ${fmt(kg - b)}`;
  return '· в норме ✓';
}
function groupsOf(w) {
  const m = {};
  w.exercises.forEach((id) => { const e = ex(id); if (e) m[e.group] = (m[e.group] || 0) + e.sets; });
  return Object.keys(GROUPS).filter((g) => m[g]).map((g) => [g, m[g]]);
}
function estimate(w) {
  const sec = w.exercises.reduce((t, id) => { const e = ex(id); return e ? t + e.sets * (restFor(e) + 40) : t; }, 0);
  return Math.round(sec / 60 / 5) * 5 + 5;
}
function weekVolume() {
  const from = Date.now() - 7 * DAY;
  const v = {};
  const add = (s) => s.items.forEach((it) => { const e = ex(it.ex); if (e) v[e.group] = (v[e.group] || 0) + it.sets.filter((x) => x.done).length; });
  S.sessions.filter((s) => s.start >= from).forEach(add);
  if (S.active) add(S.active);
  return v;
}
function volumeBars() {
  const v = weekVolume();
  return Object.entries(GROUPS).map(([g, G]) => {
    const n = v[g] || 0;
    const max = Math.max(G.target[1] * 1.25, n);
    const pct = (x) => (x / max) * 100;
    return `<div class="vol"><div class="g"><i style="background:${G.color}"></i>${G.name}</div>
      <div class="bar" role="img" aria-label="${G.name}: ${n} подходов, норма ${G.target[0]}–${G.target[1]}"><div class="fill" style="width:${pct(n)}%;background:${G.color}"></div>
      <div class="zone" style="left:${pct(G.target[0])}%;width:${pct(G.target[1] - G.target[0])}%"></div></div>
      <div class="n num">${n}</div></div>`;
  }).join('');
}

/* ----- тренировка ----- */
VIEWS.workout = () => {
  const a = S.active;
  const total = a.items.reduce((n, it) => n + it.sets.length, 0);
  const done = a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
  let h = `<div class="wk-head">${back('today')}<div class="t"><h1>${esc(a.name)}</h1><div class="clock num" id="clock">${mmss((Date.now() - a.start) / 1000)}</div></div>
    <button class="btn primary" data-a="finish" style="min-height:40px;padding:0 16px">Готово</button></div>
    <div class="progress"><div id="prog" style="width:${total ? (done / total) * 100 : 0}%"></div></div>`;
  if (done === 0) h += `<div class="warm"><b>Разминка 5–7 минут.</b> Велотренажёр или эллипс без нагрузки (если колено не против), вращения плечами, затем 1–2 лёгких подхода первого упражнения.</div>`;
  h += a.items.map((it, i) => cardHTML(it, i)).join('');
  h += `<button class="btn wide" data-a="pick" data-v="session" style="margin:4px 0 12px">+ Добавить упражнение</button>
    <button class="btn primary big wide" data-a="finish">Закончить тренировку</button>`;
  return h;
};
function cardHTML(it, i) {
  const e = ex(it.ex);
  if (!e) return '';
  const g = GROUPS[e.group];
  const p = plan(it.ex);
  const doneN = it.sets.filter((s) => s.done).length;
  let hint = '';
  if (p.last) {
    hint = `<span>Прошлый раз, ${dateShort(p.last.ts)}: <b class="num">${p.last.sets.map((s) => fmtSet(e, s)).join(' · ')}</b></span>`;
    if (p.up === 'w') hint += `<span class="badge">↑ +${fmt(e.step)} кг</span>`;
    else if (p.up === 'r') hint += `<span class="badge">↑ больше повторов</span>`;
    else if (p.heavy) hint += `<span class="badge soft">тяжеловато — вес не меняй</span>`;
  } else hint = `<span>Первый раз — подбери вес, с которым ${e.reps[0]}–${e.reps[1]} ${e.type === 'time' ? 'секунд' : 'повторов'} даются с трудом.</span>`;
  const wLabel = e.type === 'time' ? '' : e.type === 'body' ? 'Доп. кг' : 'Кг';
  const rLabel = e.type === 'time' ? 'Секунды' : 'Повторы';
  const rows = it.sets.map((s, j) => `<div style="display:contents" class="${s.done ? 'done' : ''}">
      <div class="i">${j + 1}</div>
      <input data-f="w" data-i="${i}" data-j="${j}" inputmode="decimal" enterkeyhint="done" value="${esc(s.w)}" placeholder="${e.type === 'time' ? '—' : esc(s.tw)}" ${e.type === 'time' ? 'disabled' : ''} aria-label="Вес, подход ${j + 1}">
      <input data-f="r" data-i="${i}" data-j="${j}" inputmode="numeric" enterkeyhint="done" value="${esc(s.r)}" placeholder="${esc(s.tr)}" aria-label="${rLabel}, подход ${j + 1}">
      <button class="ok ${s.done ? 'on' : ''}" data-a="toggleSet" data-i="${i}" data-j="${j}" aria-label="Подход ${j + 1} выполнен">✓</button></div>`).join('');
  return `<article class="ex ${doneN === it.sets.length && doneN ? 'done-all' : ''}" id="card-${i}" style="--g:${g.color}">
    <div class="ex-top"><div class="t"><div class="ex-name">${esc(e.name)}</div>
      <div class="ex-meta">${g.name} · ${repsText(e)} · отдых ${mmss(restFor(e))}</div></div>
      <button class="ex-more" data-a="exMenu" data-i="${i}" aria-label="Действия с упражнением">⋯</button></div>
    <div class="hint">${hint}</div>
    <div class="sets"><div></div><div class="h">${wLabel}</div><div class="h">${rLabel}</div><div></div>${rows}</div>
    <div class="set-tools"><button data-a="delSet" data-i="${i}">− подход</button><button data-a="addSet" data-i="${i}">+ подход</button></div>
  </article>`;
}
function refreshCard(i) {
  const el = document.getElementById('card-' + i);
  if (el) el.outerHTML = cardHTML(S.active.items[i], i);
  const a = S.active;
  const total = a.items.reduce((n, it) => n + it.sets.length, 0);
  const done = a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
  const pr = $('#prog'); if (pr) pr.style.width = (total ? (done / total) * 100 : 0) + '%';
}
function startWorkout(wid) {
  const w = S.program.find((x) => x.id === wid);
  if (!w) return;
  S.active = {
    id: uid(), wid, name: w.name, start: Date.now(),
    items: w.exercises.filter((id) => ex(id)).map((id) => newItem(id)),
  };
  save();
  go('workout');
}
const newItem = (id) => ({ ex: id, sets: plan(id).sets.map((s) => ({ ...s, w: '', r: '', done: false })) });

function toggleSet(i, j) {
  const it = S.active.items[i], s = it.sets[j], e = ex(it.ex);
  if (s.done) { s.done = false; save(); refreshCard(i); return; }
  if (s.w === '') s.w = e.type === 'time' ? '0' : s.tw;
  if (s.r === '') s.r = s.tr;
  if (s.r === '' || !isFinite(num(s.r))) { toast('Впиши, сколько сделал'); document.querySelector(`input[data-f="r"][data-i="${i}"][data-j="${j}"]`)?.focus(); return; }
  if (s.w === '') s.w = '0';
  s.done = true;
  // следующие подходы подхватывают введённый вес, если в них ещё ничего не вписано
  it.sets.slice(j + 1).forEach((n) => { if (!n.done && n.w === '' && s.w !== n.tw) n.tw = s.w; });
  save();
  refreshCard(i);
  const nextJ = it.sets.findIndex((x) => !x.done);
  let label;
  if (nextJ >= 0) label = `Дальше: подход ${nextJ + 1} из ${it.sets.length}`;
  else {
    const ni = S.active.items.findIndex((x, k) => k > i && x.sets.some((y) => !y.done));
    label = ni >= 0 ? `Дальше: ${ex(S.active.items[ni].ex).name}` : 'Последний подход позади';
    if (ni < 0 && S.active.items.every((x) => x.sets.every((y) => y.done))) { toast('Все подходы сделаны — жми «Готово»'); return; }
  }
  startRest(restFor(e), label);
}

/* ----- итог ----- */
function askFinish() {
  const a = S.active;
  const left = a.items.reduce((n, it) => n + it.sets.filter((s) => !s.done).length, 0);
  const any = a.items.some((it) => it.sets.some((s) => s.done));
  if (!any) {
    openSheet(`<h3>Ни один подход не отмечен</h3><p class="muted">Тренировка не сохранится.</p>
      <div class="btn-row"><button class="btn" data-a="closeSheet">Вернуться</button><button class="btn danger" data-a="discard">Выйти без сохранения</button></div>`);
    return;
  }
  openSheet(`<h3>Закончить тренировку?</h3>${left ? `<p class="muted">Не отмечено ещё ${left} ${plural(left, ['подход', 'подхода', 'подходов'])} — они не сохранятся.</p>` : '<p class="muted">Все подходы сделаны. Отличная работа.</p>'}
    <div class="btn-row"><button class="btn" data-a="closeSheet">Продолжить</button><button class="btn primary" data-a="commitFinish">Закончить</button></div>`);
}
function commitFinish() {
  const a = S.active;
  a.end = Date.now();
  a.items = a.items.map((it) => ({ ex: it.ex, sets: it.sets.filter((s) => s.done).map((s) => ({ w: s.w, r: s.r, done: true })) })).filter((it) => it.sets.length);
  const prs = [];
  a.items.forEach((it) => {
    const e = ex(it.ex);
    const hist = perfs(it.ex);
    if (!hist.length) return;
    const kind = metricKind(e, hist.concat([{ sets: it.sets }]));
    const best = Math.max(...hist.map((p) => metricVal(e, p.sets, kind)));
    const now = metricVal(e, it.sets, kind);
    if (now > best + 0.05) prs.push({ id: it.ex, now, kind, diff: now - best });
  });
  a.prs = prs;
  S.sessions.push(a);
  S.active = null;
  S.timer = null;
  save();
  closeSheet();
  runTimer();
  go('summary', a.id);
}
VIEWS.summary = (sid) => {
  const s = S.sessions.find((x) => x.id === sid);
  if (!s) return VIEWS.today();
  const sets = s.items.reduce((n, it) => n + it.sets.length, 0);
  const tonnage = s.items.reduce((t, it) => t + it.sets.reduce((u, x) => u + (num(x.w) || 0) * (ex(it.ex)?.type === 'time' ? 0 : num(x.r) || 0), 0), 0);
  const min = Math.round((s.end - s.start) / 60000);
  let h = `<div class="summary"><p class="muted">${esc(s.name)} — готово</p><div class="sum-big num">${min} мин</div>
    <div class="stats"><div><b>${sets}</b><span>${plural(sets, ['подход', 'подхода', 'подходов'])}</span></div>
    <div><b>${s.items.length}</b><span>${plural(s.items.length, ['упражнение', 'упражнения', 'упражнений'])}</span></div>
    <div><b>${fmt(Math.round(tonnage / 10) / 100)}</b><span>тонн поднято</span></div></div>`;
  if (s.prs && s.prs.length) {
    h += `<h2 style="text-align:left">Новые рекорды</h2>` + s.prs.map((p) => {
      const e = ex(p.id);
      return `<div class="pr"><div class="medal">↑</div><div><b>${esc(e?.name || '')}</b><div class="small muted">${p.kind === 'e1rm' ? `сила +${fmt(Math.round(p.diff * 10) / 10)} кг` : `+${fmt(p.diff)} ${kindUnit[p.kind]}`}</div></div></div>`;
    }).join('');
  } else h += `<p class="muted">Рекордов сегодня нет — это нормально. Рост идёт волнами, главное — регулярность.</p>`;
  h += `<button class="btn primary big wide" data-a="go" data-v="today" style="margin-top:24px">На главную</button></div>`;
  return h;
};

/* ----- программа ----- */
VIEWS.program = () => {
  let h = `<header class="top"><h1>Программа</h1></header>
    <p class="muted small">Тренировки идут по кругу: ${S.program.map((w) => esc(w.name)).join(' → ')}. Нажми на упражнение, чтобы поменять подходы, повторы или заменить его.</p>`;
  S.program.forEach((w, wi) => {
    h += `<h2>${esc(w.name)} <span class="muted small" style="font-weight:500">· ${esc(w.subtitle || '')}</span></h2><div class="list">`;
    w.exercises.forEach((id, k) => {
      const e = ex(id); if (!e) return;
      h += `<button class="row" data-a="editEx" data-w="${wi}" data-k="${k}"><span class="dot" style="background:${GROUPS[e.group].color}"></span>
        <div class="grow"><div>${esc(e.name)}</div><div class="small muted">${GROUPS[e.group].name} · ${repsText(e)}</div></div><span class="chev">›</span></button>`;
    });
    h += `<button class="row" data-a="pick" data-v="${wi}" style="color:var(--text-2);font-weight:600">+ Добавить упражнение</button></div>`;
  });
  h += `<h2>Как растёт нагрузка</h2><div class="card small">
    <p><b>Двойная прогрессия.</b> У каждого упражнения есть диапазон повторов, например 8–12. Работай с одним весом, пока не сделаешь верх диапазона во всех подходах. Тогда приложение предложит прибавить вес и снова начать с низа диапазона.</p>
    <p><b>Отказ.</b> Заканчивай подход, когда в запасе остаётся 1–2 повтора. До полного отказа — только в последнем подходе изолирующих упражнений.</p>
    <p><b>Разгрузка.</b> Раз в 6–8 недель или если сил нет совсем — неделя с теми же весами, но вдвое меньше подходов.</p>
    <p style="margin:0"><b>Колено и плечо.</b> Боль в суставе — сигнал остановиться и заменить упражнение. Мышечное жжение — норма, боль в суставе — нет.</p></div>
    <button class="btn ghost wide" data-a="resetProgram" style="margin-top:12px">Вернуть исходную программу</button>`;
  return h;
};

/* ----- прогресс ----- */
VIEWS.progress = () => {
  const segs = [['ex', 'Упражнения'], ['body', 'Вес тела'], ['log', 'Журнал']];
  let h = `<header class="top"><h1>Прогресс</h1></header><div class="chips">${segs.map(([k, n]) => `<button class="chip ${ui.seg === k ? 'on' : ''}" data-a="seg" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (ui.seg === 'body') return h + bodyView();
  if (ui.seg === 'log') return h + logView();
  const ids = new Set();
  finished().forEach((s) => s.items.forEach((it) => ids.add(it.ex)));
  if (!ids.size) return h + `<div class="empty"><b>Здесь появятся графики</b>После первой тренировки увидишь, как растут веса в каждом упражнении.</div>`;
  h += `<div class="chips"><button class="chip ${ui.grp === 'all' ? 'on' : ''}" data-a="grp" data-v="all">Все</button>${Object.entries(GROUPS).map(([g, G]) => `<button class="chip ${ui.grp === g ? 'on' : ''}" data-a="grp" data-v="${g}"><span class="dot" style="background:${G.color};box-shadow:none;width:8px;height:8px"></span>${G.name}</button>`).join('')}</div>`;
  const list = [...ids].map(ex).filter((e) => e && (ui.grp === 'all' || e.group === ui.grp));
  if (!list.length) return h + `<div class="empty">В этой группе пока нет записей.</div>`;
  h += `<div class="list">` + list.map((e) => {
    const hist = perfs(e.id);
    const kind = metricKind(e, hist);
    const cur = metricVal(e, hist[0].sets, kind);
    const prev = hist[1] ? metricVal(e, hist[1].sets, kind) : null;
    const tr = prev == null ? '' : cur > prev + 0.05 ? '<span class="trend up">↑</span>' : cur < prev - 0.05 ? '<span class="trend down">↓</span>' : '<span class="trend muted">=</span>';
    return `<button class="row" data-a="go" data-v="exercise" data-arg="${e.id}"><span class="dot" style="background:${GROUPS[e.group].color}"></span>
      <div class="grow"><div>${esc(e.name)}</div><div class="small muted">${hist.length} ${plural(hist.length, ['раз', 'раза', 'раз'])} · последний ${ago(hist[0].ts)}</div></div>
      <div style="text-align:right"><b class="num">${fmt(Math.round(cur))}</b> <span class="small muted">${kindUnit[kind]}</span> ${tr}</div></button>`;
  }).join('') + `</div>`;
  return h;
};
VIEWS.exercise = (id) => {
  const e = ex(id);
  if (!e) return VIEWS.progress();
  const hist = perfs(id);
  const kind = metricKind(e, hist);
  if (ui.from === 'workout' || ui.from === 'progress') ui.exBack = ui.from;
  let h = `<header class="top">${back(S.active && ui.exBack === 'workout' ? 'workout' : 'progress')}<div style="flex:1"><h1 style="font-size:24px">${esc(e.name)}</h1><div class="sub">${GROUPS[e.group].name} · ${placeName(e.place)}</div></div></header>`;
  if (!hist.length) return h + `<div class="empty"><b>Ещё не делал</b>Записи появятся после первой тренировки с этим упражнением.</div>`;
  const pts = hist.slice().reverse().map((p) => ({ x: p.ts, y: Math.round(metricVal(e, p.sets, kind) * 10) / 10 }));
  const first = pts[0].y, cur = pts[pts.length - 1].y, diff = cur - first;
  const weeks = Math.max(1, Math.round((pts[pts.length - 1].x - pts[0].x) / (7 * DAY)));
  h += `<div class="card"><div class="small muted">${kindLabel[kind]}</div>
    <div style="display:flex;align-items:baseline;gap:10px;margin:4px 0 12px"><div class="big-num">${fmt(cur)}<span class="small muted"> ${kindUnit[kind]}</span></div>
    ${pts.length > 1 ? `<span class="trend ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'muted'}">${diff > 0 ? '+' : ''}${fmt(Math.round(diff * 10) / 10)} за ${weeks} ${plural(weeks, ['неделю', 'недели', 'недель'])}</span>` : ''}</div>
    ${lineChart(pts, { unit: kindUnit[kind] })}</div>`;
  if (kind === 'e1rm') h += `<p class="small muted">Расчётный максимум — сколько ты поднял бы на 1 раз, судя по лучшему подходу. Удобно сравнивать разные веса и повторы.</p>`;
  h += `<h2>Все записи</h2><div class="card"><table class="hist">${hist.map((p) => `<tr><td>${dateShort(p.ts)}</td><td class="num">${p.sets.map((s) => fmtSet(e, s)).join(' · ')}</td></tr>`).join('')}</table></div>`;
  if (e.note) h += `<h2>Техника</h2><div class="card small">${esc(e.note)}</div>`;
  return h;
};
function bodyView() {
  const bt = S.settings.bodyTarget;
  const lb = S.body[S.body.length - 1];
  let h = `<div class="card"><div class="small muted">Вес тела · цель ${bt[0]}–${bt[1]} кг</div>
    <div class="big-num" style="margin:4px 0 12px">${lb ? fmt(lb.kg) : '—'}<span class="small muted"> кг ${lb ? bodyStatus(lb.kg) : ''}</span></div>
    ${S.body.length ? lineChart(S.body.map((b) => ({ x: b.ts, y: b.kg })), { unit: 'кг', band: bt }) : ''}
    <div style="display:flex;gap:8px;margin-top:12px"><input id="bodyIn" class="num" inputmode="decimal" placeholder="Вес, кг" style="flex:1;height:48px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);padding:0 14px;font-size:18px">
    <button class="btn" data-a="addBody">Записать</button></div></div>
    <p class="small muted">Зелёная полоса на графике — твоя цель. Взвешивайся утром натощак, 1–2 раза в неделю.</p>`;
  if (S.body.length) h += `<div class="card"><table class="hist">${S.body.slice().reverse().map((b) => `<tr><td>${dateShort(b.ts)}</td><td class="num">${fmt(b.kg)} кг</td></tr>`).join('')}</table></div>`;
  return h;
}
function logView() {
  const fin = finished();
  if (!fin.length) return `<div class="empty"><b>Журнал пуст</b>Здесь будут все прошедшие тренировки.</div>`;
  return `<div class="list">` + fin.map((s) => {
    const sets = s.items.reduce((n, it) => n + it.sets.length, 0);
    return `<button class="row" data-a="go" data-v="session" data-arg="${s.id}"><div class="grow"><div><b>${esc(s.name)}</b></div>
      <div class="small muted">${dateShort(s.start)} · ${Math.round((s.end - s.start) / 60000)} мин · ${sets} ${plural(sets, ['подход', 'подхода', 'подходов'])}</div></div><span class="chev">›</span></button>`;
  }).join('') + `</div>`;
}
VIEWS.session = (sid) => {
  const s = S.sessions.find((x) => x.id === sid);
  if (!s) return VIEWS.progress();
  let h = `<header class="top">${back('progress')}<div style="flex:1"><h1>${esc(s.name)}</h1><div class="sub">${esc(dateLong(s.start))} · ${Math.round((s.end - s.start) / 60000)} мин</div></div></header>`;
  h += s.items.map((it) => {
    const e = ex(it.ex) || { name: '(удалённое упражнение)', group: 'abs', type: 'iso' };
    return `<div class="card" style="border-left:4px solid ${GROUPS[e.group].color}"><b>${esc(e.name)}</b><div class="num" style="margin-top:4px">${it.sets.map((x) => fmtSet(e, x)).join(' · ')}</div></div>`;
  }).join('');
  h += `<button class="btn ghost danger wide" data-a="delSession" data-v="${s.id}" style="margin-top:12px">Удалить эту тренировку</button>`;
  return h;
};

/* ----- ещё: настройки и копия ----- */
VIEWS.more = () => {
  const st = S.settings;
  const restRow = (k, name) => `<div class="field"><span>${name}</span><div class="stepper"><button data-a="rest" data-k="${k}" data-d="-15" aria-label="Меньше">−</button><b class="num">${mmss(st.rest[k])}</b><button data-a="rest" data-k="${k}" data-d="15" aria-label="Больше">+</button></div></div>`;
  return `<header class="top"><h1>Ещё</h1></header>
    <h2 style="margin-top:0">Отдых между подходами</h2><div class="card" style="padding:4px 16px">
      ${restRow('big', 'Базовые (жимы, тяги)')}${restRow('iso', 'Изолирующие')}${restRow('body', 'Своим весом')}${restRow('time', 'На время')}${restRow('knee', 'Для колена')}</div>
    <h2>Во время тренировки</h2><div class="card" style="padding:4px 16px">
      <div class="field"><span>Сигнал в конце отдыха</span><button class="switch ${st.sound ? 'on' : ''}" data-a="toggle" data-k="sound" aria-pressed="${st.sound}" aria-label="Звук"></button></div>
      <div class="field"><span>Не гасить экран</span><button class="switch ${st.awake ? 'on' : ''}" data-a="toggle" data-k="awake" aria-pressed="${st.awake}" aria-label="Не гасить экран"></button></div></div>
    <p class="small muted">Если звука нет — проверь, что телефон не в беззвучном режиме.</p>
    <h2>Цель по весу тела</h2><div class="card" style="padding:4px 16px">
      <div class="field"><span>От, кг</span><input class="num" inputmode="decimal" data-a2="bt" data-k="0" value="${fmt(st.bodyTarget[0])}"></div>
      <div class="field"><span>До, кг</span><input class="num" inputmode="decimal" data-a2="bt" data-k="1" value="${fmt(st.bodyTarget[1])}"></div></div>
    <h2>Копия данных</h2><div class="card">
      <p class="small muted">Все записи хранятся только в этом телефоне. Сохраняй копию раз в пару недель — в «Файлы» или себе в почту.${S.lastBackup ? ` Последняя копия: ${ago(S.lastBackup)}.` : ''}</p>
      <div class="btn-row"><button class="btn primary" data-a="export">Сохранить копию</button><button class="btn" data-a="import">Загрузить копию</button></div>
      <input type="file" id="importFile" accept="application/json,.json" hidden></div>
    <p class="small muted" style="margin-top:24px;text-align:center">Тренер · тренировок записано: ${finished().length}</p>`;
};

/* ---------- всплывающие панели ---------- */
function openSheet(html) {
  $('#sheet').innerHTML = `<div class="grab"></div>${html}`;
  $('#sheet').hidden = false; $('#sheet-backdrop').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true; $('#sheet').innerHTML = ''; }
let toastT = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}

// Меню упражнения во время тренировки
function exMenu(i) {
  const it = S.active.items[i], e = ex(it.ex);
  const inSession = new Set(S.active.items.map((x) => x.ex));
  const alts = allExercises().filter((x) => x.group === e.group && !inSession.has(x.id));
  alts.sort((a, b) => (a.place === e.place ? -1 : 1) - (b.place === e.place ? -1 : 1));
  openSheet(`<h3>${esc(e.name)}</h3><div class="note">${esc(e.note || 'Без подсказки.')}</div>
    <div class="list" style="margin-bottom:12px">
      <button class="row" data-a="go" data-v="exercise" data-arg="${e.id}" data-close="1"><div class="grow">История и график</div><span class="chev">›</span></button>
      <button class="row" data-a="removeToday" data-i="${i}"><div class="grow" style="color:var(--danger)">Убрать на сегодня</div></button></div>
    <p class="small muted" style="margin:16px 0 8px">Заменить на сегодня (${GROUPS[e.group].name.toLowerCase()}):</p>
    <div class="list">${alts.map((a) => `<button class="row" data-a="swapToday" data-i="${i}" data-v="${a.id}"><div class="grow">${esc(a.name)}<div class="small muted">${placeName(a.place)} · ${repsText(a)}</div></div></button>`).join('') || '<div class="row muted">Нет других упражнений этой группы</div>'}</div>`);
}
const allExercises = () => Object.keys(EXERCISES).concat(Object.keys(S.custom)).map(ex).filter(Boolean);

// Редактирование упражнения в программе
function editEx(wi, k) {
  const w = S.program[wi], id = w.exercises[k], e = ex(id);
  const alts = allExercises().filter((x) => x.group === e.group && !w.exercises.includes(x.id));
  alts.sort((a, b) => (a.place === w.place ? -1 : 1) - (b.place === w.place ? -1 : 1));
  const st = (f, label, val) => `<div class="field"><span>${label}</span><div class="stepper"><button data-a="adj" data-f="${f}" data-w="${wi}" data-k="${k}" data-d="-1" aria-label="Меньше">−</button><b class="num">${val}</b><button data-a="adj" data-f="${f}" data-w="${wi}" data-k="${k}" data-d="1" aria-label="Больше">+</button></div></div>`;
  openSheet(`<h3>${esc(e.name)}</h3><p class="small muted">${esc(w.name)} · ${GROUPS[e.group].name}</p>
    <div class="note">${esc(e.note || 'Без подсказки.')}</div>
    <div class="card" style="padding:4px 16px">${st('sets', 'Подходов', e.sets)}${st('r0', e.type === 'time' ? 'Секунд от' : 'Повторов от', e.reps[0])}${st('r1', e.type === 'time' ? 'Секунд до' : 'Повторов до', e.reps[1])}${st('rest', 'Отдых', mmss(restFor(e)))}</div>
    <div class="btn-row"><button class="btn" data-a="move" data-w="${wi}" data-k="${k}" data-d="-1">↑ Выше</button><button class="btn" data-a="move" data-w="${wi}" data-k="${k}" data-d="1">↓ Ниже</button></div>
    <p class="small muted" style="margin:16px 0 8px">Заменить в программе на:</p>
    <div class="list">${alts.map((a) => `<button class="row" data-a="swapProg" data-w="${wi}" data-k="${k}" data-v="${a.id}"><div class="grow">${esc(a.name)}<div class="small muted">${placeName(a.place)} · ${repsText(a)}</div></div></button>`).join('') || '<div class="row muted">Нет других упражнений этой группы</div>'}</div>
    <button class="btn ghost danger wide" data-a="removeProg" data-w="${wi}" data-k="${k}" style="margin-top:12px">${ui.confirm === 'rm' + wi + k ? 'Точно убрать? Нажми ещё раз' : 'Убрать из тренировки'}</button>`);
}

// Выбор упражнения для добавления
function pick(target, grp) {
  const place = target === 'session' ? (S.program.find((w) => w.id === S.active.wid)?.place) : S.program[target].place;
  const have = new Set(target === 'session' ? S.active.items.map((x) => x.ex) : S.program[target].exercises);
  const g = grp || 'chest';
  const list = allExercises().filter((x) => x.group === g && !have.has(x.id));
  list.sort((a, b) => (a.place === place ? -1 : 1) - (b.place === place ? -1 : 1));
  openSheet(`<h3>Добавить упражнение</h3><div class="chips" style="margin-top:12px">${Object.entries(GROUPS).map(([k, G]) => `<button class="chip ${k === g ? 'on' : ''}" data-a="pick" data-v="${target}" data-g="${k}">${G.name}</button>`).join('')}</div>
    <div class="list">${list.map((a) => `<button class="row" data-a="addEx" data-v="${target}" data-id="${a.id}"><div class="grow">${esc(a.name)}<div class="small muted">${placeName(a.place)} · ${repsText(a)}</div></div><span class="chev">+</span></button>`).join('') || '<div class="row muted">Все упражнения этой группы уже есть</div>'}</div>
    <button class="btn wide" data-a="customForm" data-v="${target}" data-g="${g}" style="margin-top:12px">Своё упражнение…</button>`);
}
function customForm(target, g) {
  openSheet(`<h3>Своё упражнение</h3>
    <div class="card" style="padding:4px 16px;margin-top:12px">
      <div class="field col"><span class="small muted">Название</span><input class="text" id="cName" placeholder="Например: жим Арнольда"></div>
      <div class="field"><span>Группа</span><select id="cGroup">${Object.entries(GROUPS).map(([k, G]) => `<option value="${k}" ${k === g ? 'selected' : ''}>${G.name}</option>`).join('')}</select></div>
      <div class="field"><span>Тип</span><select id="cType" style="width:160px"><option value="big">Базовое</option><option value="iso" selected>Изолирующее</option><option value="body">Своим весом</option><option value="time">На время</option><option value="knee">Для колена</option></select></div>
      <div class="field"><span>Подходов</span><input id="cSets" inputmode="numeric" value="3"></div>
      <div class="field"><span>Повторов от</span><input id="cR0" inputmode="numeric" value="8"></div>
      <div class="field"><span>Повторов до</span><input id="cR1" inputmode="numeric" value="12"></div>
      <div class="field"><span>Шаг веса, кг</span><input id="cStep" inputmode="decimal" value="2,5"></div></div>
    <button class="btn primary wide" data-a="saveCustom" data-v="${target}" style="margin-top:12px">Добавить</button>`);
}

/* ---------- таймер отдыха ---------- */
let tickT = null, audioCtx = null;
function buildTimer() {
  $('#timer').innerHTML = `<svg class="ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="bgc" cx="28" cy="28" r="24"/><circle class="fg" id="tRing" cx="28" cy="28" r="24" stroke-dasharray="150.8" stroke-dashoffset="0"/></svg>
    <div class="tt"><div class="big" id="tBig">0:00</div><div class="lbl" id="tLbl"></div></div>
    <button data-a="tAdd" data-d="-15" aria-label="Минус 15 секунд">−15</button><button data-a="tAdd" data-d="15" aria-label="Плюс 15 секунд">+15</button><button data-a="tStop" aria-label="Закрыть таймер">✕</button>`;
}
function startRest(sec, label) {
  S.timer = { end: Date.now() + sec * 1000, total: sec, label, fired: false };
  save();
  runTimer();
}
function runTimer() {
  clearInterval(tickT);
  renderTimer();
  tickT = setInterval(renderTimer, 250);
}
function renderTimer() {
  const clk = $('#clock');
  if (clk && S.active) clk.textContent = mmss((Date.now() - S.active.start) / 1000);
  const el = $('#timer'), t = S.timer;
  if (!t) { el.hidden = true; return; }
  const left = (t.end - Date.now()) / 1000;
  if (left <= 0 && !t.fired) { t.fired = true; save(); beep(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
  if (left < -90) { S.timer = null; save(); el.hidden = true; return; }
  el.hidden = false;
  el.classList.toggle('over', left <= 0);
  $('#tBig').textContent = left > 0 ? mmss(left) : 'Пора!';
  $('#tLbl').textContent = left > 0 ? t.label : t.label.replace('Дальше: ', 'Начинай: ');
  $('#tRing').style.strokeDashoffset = String(150.8 * (1 - Math.max(0, left) / t.total));
}
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'transient';
    if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* звук не обязателен */ }
}
function beep() {
  if (!S.settings.sound || !audioCtx) return;
  try {
    [0, 0.3, 0.6].forEach((d, k) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = k === 2 ? 1320 : 880;
      const t0 = audioCtx.currentTime + d;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + 0.3);
    });
  } catch (e) { /* ничего */ }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && S.settings.awake && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if ((!on || !S.settings.awake) && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

/* ---------- графики ---------- */
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function lineChart(pts, { unit = '', band = null } = {}) {
  if (!pts.length) return '';
  const W = 340, H = 180, L = 36, R = 16, T = 22, B = 24;
  const ys = pts.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]); }
  const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
  lo -= pad; hi += pad;
  const step = niceStep((hi - lo) / 3);
  const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Math.round(v * 100) / 100);
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const X = (x) => (x1 === x0 ? (L + W - R) / 2 : L + ((x - x0) / (x1 - x0)) * (W - L - R));
  const Y = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const P = pts.map((p) => ({ px: X(p.x), py: Y(p.y), t: `${dateShort(p.x)}: ${fmt(p.y)} ${unit}` }));
  const last = P[P.length - 1];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="График: от ${fmt(pts[0].y)} до ${fmt(pts[pts.length - 1].y)} ${unit}">`;
  if (band) s += `<rect class="band" x="${L}" y="${Y(band[1])}" width="${W - L - R}" height="${Y(band[0]) - Y(band[1])}" rx="4"/>`;
  s += `<g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>`;
  s += `<g class="axis">${ticks.map((v) => `<text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`).join('')}
    <text x="${L}" y="${H - 4}">${dateShort(x0)}</text>${x1 !== x0 ? `<text x="${W - R}" y="${H - 4}" text-anchor="end">${dateShort(x1)}</text>` : ''}</g>`;
  if (P.length > 1) s += `<path class="line" d="${P.map((p, i) => (i ? 'L' : 'M') + p.px.toFixed(1) + ' ' + p.py.toFixed(1)).join(' ')}"/>`;
  s += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
  s += P.map((p, i) => `<circle class="pt ${i === P.length - 1 ? 'last' : ''}" cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="${i === P.length - 1 ? 5 : 4}"/>`).join('');
  s += `<text x="${last.px}" y="${last.py - 12}" text-anchor="${P.length > 1 ? 'end' : 'middle'}" style="fill:var(--text);font-size:13px;font-weight:700">${fmt(pts[pts.length - 1].y)}</text>`;
  s += `</svg>`;
  return `<div class="chart" data-pts='${esc(JSON.stringify(P))}' data-w="${W}">${s}<div class="tip" hidden></div></div>`;
}
function bindCharts() {
  document.querySelectorAll('.chart').forEach((c) => {
    const P = JSON.parse(c.dataset.pts), W = +c.dataset.w;
    const svg = c.querySelector('svg'), tip = c.querySelector('.tip'), cross = c.querySelector('.cross');
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * W;
      let best = P[0]; P.forEach((p) => { if (Math.abs(p.px - x) < Math.abs(best.px - x)) best = p; });
      cross.setAttribute('x1', best.px); cross.setAttribute('x2', best.px); cross.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.textContent = best.t;
      const left = (best.px / W) * r.width;
      tip.style.left = Math.min(r.width - 60, Math.max(60, left)) + 'px';
      tip.style.top = '-28px';
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerleave', hide);
  });
}

/* ---------- копия данных ---------- */
async function exportData() {
  const json = JSON.stringify({ ...S, timer: null }, null, 1);
  const name = `trener-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Копия тренировок' });
      S.lastBackup = Date.now(); save(); render(); toast('Копия сохранена'); return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  S.lastBackup = Date.now(); save(); render(); toast('Копия сохранена');
}
let pendingImport = null;
function importFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.program)) throw new Error('bad');
      pendingImport = d;
      openSheet(`<h3>Загрузить копию?</h3><p class="muted">В копии ${d.sessions.length} ${plural(d.sessions.length, ['тренировка', 'тренировки', 'тренировок'])}. Текущие записи в телефоне (${S.sessions.length}) будут заменены копией.</p>
        <div class="btn-row"><button class="btn" data-a="closeSheet">Отмена</button><button class="btn primary" data-a="doImport">Заменить</button></div>`);
    } catch (e) { toast('Это не файл копии Тренера'); }
  };
  rd.readAsText(file);
}

/* ---------- обработка нажатий ---------- */
const A = {
  tab: (t) => go(t.dataset.v),
  go: (t) => { if (t.dataset.close) closeSheet(); go(t.dataset.v, t.dataset.arg || null); },
  start: (t) => { unlockAudio(); startWorkout(t.dataset.v); },
  toggleSet: (t) => { unlockAudio(); toggleSet(+t.dataset.i, +t.dataset.j); },
  addSet: (t) => { const it = S.active.items[+t.dataset.i]; const l = it.sets[it.sets.length - 1] || { tw: '', tr: '' }; it.sets.push({ tw: l.w || l.tw, tr: l.r || l.tr, w: '', r: '', done: false }); save(); refreshCard(+t.dataset.i); },
  delSet: (t) => { const it = S.active.items[+t.dataset.i]; const k = it.sets.map((s) => s.done).lastIndexOf(false); if (k < 0 || it.sets.length <= 1) { toast('Неотмеченных подходов нет'); return; } it.sets.splice(k, 1); save(); refreshCard(+t.dataset.i); },
  exMenu: (t) => exMenu(+t.dataset.i),
  removeToday: (t) => { S.active.items.splice(+t.dataset.i, 1); save(); closeSheet(); render(); },
  swapToday: (t) => { S.active.items[+t.dataset.i] = newItem(t.dataset.v); save(); closeSheet(); render(); },
  finish: () => askFinish(),
  commitFinish: () => commitFinish(),
  discard: () => { S.active = null; S.timer = null; save(); closeSheet(); runTimer(); go('today'); },
  closeSheet: () => closeSheet(),
  tAdd: (t) => { if (!S.timer) return; const d = +t.dataset.d; if (S.timer.end < Date.now()) S.timer.end = Date.now(); S.timer.end += d * 1000; S.timer.total = Math.max(S.timer.total + d, 15); S.timer.fired = false; save(); renderTimer(); },
  tStop: () => { S.timer = null; save(); renderTimer(); },
  addBody: () => {
    const v = num($('#bodyIn').value);
    if (!(v > 30 && v < 250)) { toast('Впиши вес в килограммах, например 86,5'); return; }
    const today = dayStart(Date.now());
    S.body = S.body.filter((b) => dayStart(b.ts) !== today);
    S.body.push({ ts: Date.now(), kg: v }); S.body.sort((a, b) => a.ts - b.ts);
    save(); render(); toast('Записал');
  },
  seg: (t) => { ui.seg = t.dataset.v; render(); },
  grp: (t) => { ui.grp = t.dataset.v; render(); },
  editEx: (t) => editEx(+t.dataset.w, +t.dataset.k),
  adj: (t) => {
    const wi = +t.dataset.w, k = +t.dataset.k, id = S.program[wi].exercises[k], e = ex(id), d = +t.dataset.d;
    const o = S.over[id] = S.over[id] || {};
    const reps = [...e.reps];
    const big = e.type === 'time' ? 5 : 1;
    if (t.dataset.f === 'sets') o.sets = Math.min(8, Math.max(1, e.sets + d));
    if (t.dataset.f === 'r0') { reps[0] = Math.max(1, Math.min(reps[1], reps[0] + d * big)); o.reps = reps; }
    if (t.dataset.f === 'r1') { reps[1] = Math.max(reps[0], reps[1] + d * big); o.reps = reps; }
    if (t.dataset.f === 'rest') o.rest = Math.max(15, restFor(e) + d * 15);
    save(); editEx(wi, k); render();
  },
  move: (t) => {
    const wi = +t.dataset.w, k = +t.dataset.k, d = +t.dataset.d, arr = S.program[wi].exercises, n = k + d;
    if (n < 0 || n >= arr.length) return;
    [arr[k], arr[n]] = [arr[n], arr[k]]; save(); editEx(wi, n); render();
  },
  swapProg: (t) => { S.program[+t.dataset.w].exercises[+t.dataset.k] = t.dataset.v; save(); closeSheet(); render(); toast('Заменил'); },
  removeProg: (t) => {
    const key = 'rm' + t.dataset.w + t.dataset.k;
    if (ui.confirm !== key) { ui.confirm = key; editEx(+t.dataset.w, +t.dataset.k); return; }
    ui.confirm = null; S.program[+t.dataset.w].exercises.splice(+t.dataset.k, 1); save(); closeSheet(); render(); toast('Убрал из тренировки');
  },
  pick: (t) => pick(t.dataset.v, t.dataset.g),
  addEx: (t) => {
    const target = t.dataset.v, id = t.dataset.id;
    if (target === 'session') S.active.items.push(newItem(id)); else S.program[+target].exercises.push(id);
    save(); closeSheet(); render(); toast('Добавил');
  },
  customForm: (t) => customForm(t.dataset.v, t.dataset.g),
  saveCustom: (t) => {
    const name = $('#cName').value.trim();
    if (!name) { toast('Впиши название'); return; }
    const r0 = Math.max(1, parseInt($('#cR0').value) || 8), r1 = Math.max(r0, parseInt($('#cR1').value) || 12);
    const id = 'c_' + uid();
    S.custom[id] = { name, group: $('#cGroup').value, place: 'any', type: $('#cType').value, sets: Math.max(1, parseInt($('#cSets').value) || 3), reps: [r0, r1], step: Math.max(0, num($('#cStep').value) || 0), note: '' };
    const target = t.dataset.v;
    if (target === 'session') S.active.items.push(newItem(id)); else S.program[+target].exercises.push(id);
    save(); closeSheet(); render(); toast('Добавил');
  },
  resetProgram: () => openSheet(`<h3>Вернуть исходную программу?</h3><p class="muted">Упражнения, подходы и повторы станут как в начале. Записи тренировок останутся.</p>
    <div class="btn-row"><button class="btn" data-a="closeSheet">Отмена</button><button class="btn primary" data-a="doReset">Вернуть</button></div>`),
  doReset: () => { S.program = clone(DEFAULT_PROGRAM); S.over = {}; save(); closeSheet(); render(); toast('Программа как в начале'); },
  delSession: (t) => openSheet(`<h3>Удалить тренировку?</h3><p class="muted">Её подходы пропадут из графиков. Вернуть будет нельзя.</p>
    <div class="btn-row"><button class="btn" data-a="closeSheet">Отмена</button><button class="btn danger" data-a="doDelSession" data-v="${t.dataset.v}">Удалить</button></div>`),
  doDelSession: (t) => { S.sessions = S.sessions.filter((s) => s.id !== t.dataset.v); save(); closeSheet(); go('progress'); toast('Удалил'); },
  rest: (t) => { const k = t.dataset.k; S.settings.rest[k] = Math.max(15, S.settings.rest[k] + +t.dataset.d); save(); render(); },
  toggle: (t) => { const k = t.dataset.k; S.settings[k] = !S.settings[k]; save(); render(); },
  export: () => exportData(),
  import: () => $('#importFile').click(),
  doImport: () => { S = normalize(pendingImport); pendingImport = null; save(); closeSheet(); go('today'); runTimer(); toast('Копия загружена'); },
};
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-a]');
  if (!t) return;
  const f = A[t.dataset.a];
  if (f) f(t, ev);
});
$('#sheet-backdrop').addEventListener('click', closeSheet);
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset.f && S.active) { S.active.items[+t.dataset.i].sets[+t.dataset.j][t.dataset.f] = t.value.trim(); saveSoon(); }
  if (t.dataset.a2 === 'bt') { const v = num(t.value); if (v > 30) { S.settings.bodyTarget[+t.dataset.k] = v; saveSoon(); } }
});
document.addEventListener('change', (ev) => { if (ev.target.id === 'importFile' && ev.target.files[0]) { importFile(ev.target.files[0]); ev.target.value = ''; } });
document.addEventListener('focusin', (ev) => { if (ev.target.matches('.sets input')) setTimeout(() => ev.target.select(), 0); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('input')) ev.target.blur(); });
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { save(); renderTimer(); keepAwake(ui.view === 'workout'); } else save(); });

/* ---------- запуск ---------- */
buildTimer();
if (S.active) ui.view = 'workout';
render();
runTimer();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
