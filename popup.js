const STRETCH_KEYS = [
  { emoji: "🔄", key: "stretchNeckRolls" },
  { emoji: "☝️", key: "stretchOverheadReach" },
  { emoji: "👁", key: "stretch2020" },
  { emoji: "🤲", key: "stretchWristCircles" },
  { emoji: "🙆", key: "stretchShoulderRolls" },
  { emoji: "🌀", key: "stretchSpinalTwist" },
  { emoji: "🙇", key: "stretchForwardFold" },
  { emoji: "🦋", key: "stretchChestOpener" },
  { emoji: "↔️", key: "stretchSideStretch" },
  { emoji: "😌", key: "stretchChinTucks" },
  { emoji: "💪", key: "stretchUpperBackSqueeze" },
  { emoji: "👆", key: "stretchTempleMassage" },
  { emoji: "🦶", key: "stretchAnkleCircles" },
  { emoji: "🖐", key: "stretchFingerSpreads" },
  { emoji: "🧘", key: "stretchHipStretch" },
];

const DUR_KEYS = ["30 sec","30 sec","20 sec","20 sec","30 sec","30 sec","30 sec","30 sec","30 sec","20 sec","30 sec","20 sec","20 sec","20 sec","30 sec"];

let messages = {};
let currentLang = 'en';

function t(key, sub) {
  const m = messages[key];
  if (!m) return key;
  let text = m.message;
  if (sub) text = text.replace('$MINUTES$', sub);
  return text;
}

function STRETCHES_LIVE() {
  return STRETCH_KEYS.map((s, i) => ({
    emoji: s.emoji,
    name: t(s.key),
    desc: t(s.key + 'Desc'),
    dur: DUR_KEYS[i],
  }));
}

async function loadMessages(lang) {
  const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('not found');
    messages = await res.json();
    currentLang = lang;
  } catch (e) {
    if (lang !== 'en') {
      await loadMessages('en');
    }
  }
}

function detectBrowserLang() {
  const supported = ['en','es','fr','de','hi','ml','ta','te'];
  const navLang = (navigator.language || 'en').split('-')[0].toLowerCase();
  return supported.includes(navLang) ? navLang : 'en';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text && text !== key) el.textContent = text;
  });
  document.title = t('brandName');
}

let STRETCHES = STRETCHES_LIVE();


const CIRC = 389.6;
let state = {};
let localRemSec = null;
let tickTimer = null;
let viewStretchIndex = 0;

const $ = id => document.getElementById(id);

function fmt(s) {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function computeRemSec(st) {
  if (!st.running || !st.startedAt) {
    return st.pausedRemainSec ?? st.intervalMin * 60;
  }
  const elapsed = (Date.now() - st.startedAt) / 1000;
  return Math.max(0, st.intervalMin * 60 - elapsed);
}

function renderStretch(idx) {
  const s = STRETCHES[idx % STRETCHES.length];
  $('sIcon').textContent = s.emoji;
  $('sName').textContent = s.name;
  $('sDesc').textContent = s.desc;
  $('sDur').textContent = s.dur;
  $('pips').innerHTML = STRETCHES.map((_, i) =>
    `<div class="pip${i === idx % STRETCHES.length ? ' on' : ''}"></div>`).join('');
}

function renderStats(st) {
  $('stBreaks').textContent = st.breaksToday ?? 0;
  $('stStreak').textContent = st.streakDays ?? 0;
  $('stMins').textContent = st.minsMoved ?? 0;
}

function renderRing(remSec, totalSec) {
  const pct = Math.min(1, remSec / totalSec);
  $('progRing').style.strokeDashoffset = (CIRC * (1 - pct)).toFixed(1);
  $('cdDisplay').textContent = fmt(remSec);
}

function renderInterval(min) {
  document.querySelectorAll('.iv-btn').forEach(b => b.classList.remove('active'));
  const known = [20, 30, 45];
  if (known.includes(min)) {
    $('iv' + min).classList.add('active');
  } else {
    $('ivcustom').classList.add('active');
  }
}

function renderFocus(on) {
  const btn = $('focusBtn');
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
  $('focusLbl').textContent = on ? t('strictModeOn') : t('strictModeOff');
}

function renderGoBtn(running, paused) {
  const btn = $('goBtn');
  const icon = $('goIcon');
  const lbl = $('goLbl');
  if (running) {
    btn.className = 'btn-go pause-mode';
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    lbl.textContent = t('pause');
  } else if (paused) {
    btn.className = 'btn-go';
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    lbl.textContent = t('resume');
  } else {
    btn.className = 'btn-go';
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    lbl.textContent = t('start');
  }
}

function renderBreathRing(running, isBreak) {
  const ring = $('breathRing');
  ring.classList.toggle('paused', !running);
  ring.classList.toggle('break-glow', isBreak);
}

function applyState(st) {
  state = st;
  const rem = computeRemSec(st);
  localRemSec = rem;
  clearInterval(tickTimer);

  if (st.running) {
    tickTimer = setInterval(() => {
      localRemSec = Math.max(0, localRemSec - 1);
      renderRing(localRemSec, st.intervalMin * 60);
    }, 1000);
  }

  renderRing(rem, st.intervalMin * 60);
  renderInterval(st.intervalMin);
  renderGoBtn(st.running, st.pausedRemainSec != null && !st.running);
  renderFocus(st.focusMode);
  renderStats(st);
  renderBreathRing(st.running, false);
  renderStretch(st.stretchIndex ?? 0);
  viewStretchIndex = st.stretchIndex ?? 0;

  const prefs = ['tNotif','tAnim','tMale','tSound','tWorkHours','tDailySummary'];
  const prefKeys = {
    tNotif:'notifEnabled', tAnim:'animEnabled', tMale:'maleModel',
    tSound:'soundEnabled', tWorkHours:'workHoursEnabled', tDailySummary:'dailySummaryEnabled',
  };
  prefs.forEach(id => {
    const on = !!st[prefKeys[id]];
    const btn = $(id);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
  });

  $('soundLeadSelect').value = String(st.soundLeadSec ?? 10);
  $('soundLeadRow').classList.toggle('show', !!st.soundEnabled);

  $('workStartInput').value = st.workStart || '09:00';
  $('workEndInput').value = st.workEnd || '17:00';
  const whOn = !!st.workHoursEnabled;
  $('workHoursRow').classList.toggle('show', whOn);
  $('workHoursRow2').classList.toggle('show', whOn);
  $('dailySummaryRow').classList.toggle('show', whOn);

  const weekendDays = st.weekendDays || [];
  document.querySelectorAll('.day-btn').forEach(btn => {
    const day = parseInt(btn.dataset.day);
    btn.classList.toggle('paused', weekendDays.includes(day));
  });

  const activeTheme = st.theme || 'sage';
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === activeTheme);
  });
  document.body.classList.remove('theme-dusk', 'theme-ocean');
  if (activeTheme === 'dusk') document.body.classList.add('theme-dusk');
  if (activeTheme === 'ocean') document.body.classList.add('theme-ocean');

  const darkPref = st.darkMode || 'system';
  document.body.classList.remove('dark', 'force-light');
  if (darkPref === 'dark') document.body.classList.add('dark');
  if (darkPref === 'light') document.body.classList.add('force-light');
  $('darkModeSelect').value = darkPref;

  const activeSound = st.chimeSound || 'marimba';
  document.querySelectorAll('.sound-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sound === activeSound);
  });
}

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

async function init() {
  let st = await send({ type: 'GET_STATE' });

  const langPref = st.language || 'auto';
  const langToLoad = langPref === 'auto' ? detectBrowserLang() : langPref;
  await loadMessages(langToLoad);
  applyI18n();
  STRETCHES = STRETCHES_LIVE();
  $('langSelect').value = langPref;

  if (!st.running && st.pausedRemainSec == null) {
    st = await send({ type: 'START', intervalMin: st.intervalMin });
  }
  applyState(st);

  if (st.badgeCount > 0) {
    await send({ type: 'CLEAR_BADGE' });
  }

  if ((st.totalBreaksAllTime || 0) >= 10 && !st.ratingNudgeDone) {
    showNudge();
  }
}

$('langSelect').addEventListener('change', async (e) => {
  const langPref = e.target.value;
  await send({ type: 'SET_PREF', key: 'language', value: langPref });
  const langToLoad = langPref === 'auto' ? detectBrowserLang() : langPref;
  await loadMessages(langToLoad);
  applyI18n();
  STRETCHES = STRETCHES_LIVE();
  renderStretch(viewStretchIndex);
  renderGoBtn(state.running, state.pausedRemainSec != null && !state.running);
});

$('goBtn').addEventListener('click', async () => {
  let st;
  if (state.running) {
    st = await send({ type: 'PAUSE' });
  } else if (state.pausedRemainSec != null) {
    st = await send({ type: 'RESUME' });
  } else {
    st = await send({ type: 'START', intervalMin: state.intervalMin });
  }
  applyState(st);
});

$('snoozeBtn').addEventListener('click', async () => {
  const st = await send({ type: 'SNOOZE' });
  applyState(st);
});

$('focusBtn').addEventListener('click', async () => {
  const st = await send({ type: 'SET_FOCUS', value: !state.focusMode });
  applyState(st);
});

document.querySelectorAll('.iv-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    let min = parseInt(btn.dataset.min);
    if (min === 0) {
      const v = parseInt(prompt(t('customPrompt'), '60'));
      if (isNaN(v) || v < 1) return;
      min = v;
    }
    const st = await send({ type: 'SET_INTERVAL', intervalMin: min });
    if (state.running) {
      const st2 = await send({ type: 'START', intervalMin: min });
      applyState(st2);
    } else {
      applyState(st);
    }
  });
});

$('settingsBtn').addEventListener('click', () => {
  const layer = $('settingsLayer');
  const lower = $('mainLower');
  const open = layer.classList.toggle('open');
  layer.setAttribute('aria-hidden', String(!open));
  lower.style.display = open ? 'none' : '';
});

document.querySelectorAll('.tog').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.pref;
    const newVal = !state[key];
    const st = await send({ type: 'SET_PREF', key, value: newVal });
    applyState(st);
  });
});

$('darkModeSelect').addEventListener('change', async (e) => {
  const st = await send({ type: 'SET_PREF', key: 'darkMode', value: e.target.value });
  applyState(st);
});

$('soundLeadSelect').addEventListener('change', async (e) => {
  const st = await send({ type: 'SET_PREF', key: 'soundLeadSec', value: parseInt(e.target.value) });
  applyState(st);
});

async function pushWorkHours() {
  const enabled = state.workHoursEnabled;
  const start = $('workStartInput').value || '09:00';
  const end = $('workEndInput').value || '17:00';
  const st = await send({ type: 'SET_WORK_HOURS', enabled, start, end });
  applyState(st);
}

$('workStartInput').addEventListener('change', pushWorkHours);
$('workEndInput').addEventListener('change', pushWorkHours);

document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const day = parseInt(btn.dataset.day);
    const current = new Set(state.weekendDays || []);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    const st = await send({ type: 'SET_WEEKEND_DAYS', days: Array.from(current) });
    applyState(st);
  });
});

document.querySelectorAll('.theme-swatch').forEach(btn => {
  btn.addEventListener('click', async () => {
    const theme = btn.dataset.theme;
    const st = await send({ type: 'SET_PREF', key: 'theme', value: theme });
    applyState(st);
  });
});

const SOUND_FILES = {
  marimba: 'sounds/chime-marimba.mp3',
  bell: 'sounds/chime-bell.mp3',
  kalimba: 'sounds/chime-kalimba.mp3',
  windchime: 'sounds/chime-windchime.mp3',
};

document.querySelectorAll('.sound-chip').forEach(btn => {
  btn.addEventListener('click', async () => {
    const sound = btn.dataset.sound;
    const st = await send({ type: 'SET_PREF', key: 'chimeSound', value: sound });
    applyState(st);
    try {
      const audio = new Audio(chrome.runtime.getURL(SOUND_FILES[sound] || SOUND_FILES.marimba));
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (e) {}
  });
});

$('nextBtn').addEventListener('click', () => {
  viewStretchIndex = (viewStretchIndex + 1) % STRETCHES.length;
  renderStretch(viewStretchIndex);
});
$('prevBtn').addEventListener('click', () => {
  viewStretchIndex = (viewStretchIndex - 1 + STRETCHES.length) % STRETCHES.length;
  renderStretch(viewStretchIndex);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'BREAK_FIRED') {
    clearInterval(tickTimer);
    $('cdDisplay').textContent = t('moveNow');
    $('cdDisplay').classList.add('break-time');
    $('cdLbl').textContent = t('breakTime');
    $('progRing').classList.add('break-mode');
    renderBreathRing(false, true);
    renderGoBtn(false, false);
    renderStretch(msg.stretchIndex);
    viewStretchIndex = msg.stretchIndex;
    setTimeout(async () => {
      $('cdDisplay').classList.remove('break-time');
      $('cdLbl').textContent = t('untilBreak');
      $('progRing').classList.remove('break-mode');
      const st = await send({ type: 'GET_STATE' });
      applyState(st);
      if ((msg.totalBreaks || 0) >= 10 && !st.ratingNudgeDone) {
        showNudge();
      }
    }, 4000);
  }
});

function showNudge() {
  $('stretchAreaMain').style.display = 'none';
  $('stretchGridPanel').classList.remove('open');
  $('nudgePanel').classList.add('open');
  $('nudgePanel').setAttribute('aria-hidden', 'false');
}

function hideNudge() {
  $('nudgePanel').classList.remove('open');
  $('nudgePanel').setAttribute('aria-hidden', 'true');
  $('stretchAreaMain').style.display = '';
}

$('nudgeDismissBtn').addEventListener('click', async () => {
  hideNudge();
  await send({ type: 'SET_PREF', key: 'ratingNudgeDone', value: true });
});

$('nudgeReviewBtn').addEventListener('click', async () => {
  await send({ type: 'SET_PREF', key: 'ratingNudgeDone', value: true });
  setTimeout(hideNudge, 800);
});

$('openOptionsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function renderStretchGrid() {
  const grid = $('stretchGrid');
  grid.innerHTML = '';
  const currentIdx = (state.stretchIndex ?? 0) % STRETCHES.length;
  STRETCHES.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'grid-stretch-card' + (i === currentIdx ? ' next-up' : '');
    card.innerHTML = `
      ${i === currentIdx ? `<div class="grid-next-badge">${t('upNext')}</div>` : ''}
      <div class="grid-stretch-icon">${s.emoji}</div>
      <div class="grid-stretch-name">${s.name}</div>
      <div class="grid-stretch-dur">${s.dur}</div>
    `;
    card.addEventListener('click', () => {
      viewStretchIndex = i;
      renderStretch(i);
      toggleStretchGrid(false);
    });
    grid.appendChild(card);
  });
}

function toggleStretchGrid(open) {
  $('stretchGridPanel').classList.toggle('open', open);
  $('stretchGridPanel').setAttribute('aria-hidden', String(!open));
  $('stretchAreaMain').style.display = open ? 'none' : '';
  if (open) renderStretchGrid();
}

$('browseAllBtn').addEventListener('click', () => toggleStretchGrid(true));
$('closeGridBtn').addEventListener('click', () => toggleStretchGrid(false));

init();
