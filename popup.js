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
let syncTimer = null;
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

function renderHistory(st) {
  const list = $('historyList');
  const log = st.breakLogDate === new Date().toDateString() ? (st.breakLog || []) : [];
  if (log.length === 0) {
    list.innerHTML = `<div class="history-empty">${t('historyEmpty')}</div>`;
    return;
  }
  list.innerHTML = [...log].reverse().map(entry => {
    const d = new Date(entry.time);
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    const name = STRETCHES[entry.stretchIndex % STRETCHES.length]?.name || '';
    return `<div class="history-item">
      <span class="history-time">${hh}:${mm}</span>
      <span class="history-stretch">${name}</span>
    </div>`;
  }).join('');
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
  if (!st) return; // guard against null response from sleeping service worker
  state = st;
  const rem = computeRemSec(st);
  localRemSec = rem;
  clearInterval(tickTimer);
  clearInterval(syncTimer); // single clear — was duplicated below

  // Restore stretch area visibility unless a nudge is showing OR grid is open
  const gridIsOpen = $('stretchGridPanel').classList.contains('open');
  const nudgeIsOpen = $('nudgePanel').classList.contains('open') || $('supportPanel').classList.contains('open');
  if (!nudgeIsOpen && !gridIsOpen) {
    $('stretchAreaMain').style.display = '';
  }

  if (st.running) {
    tickTimer = setInterval(async () => {
      localRemSec = Math.max(0, localRemSec - 1);
      renderRing(localRemSec, st.intervalMin * 60);
      // When countdown hits 0, Chrome alarms can be delayed up to 60s.
      // Re-sync from background every second so the popup updates the moment
      // the break fires — but only when we're actually running, not paused.
      if (localRemSec === 0 && st.running) {
        const fresh = await send({ type: 'GET_STATE' });
        // Only apply if the break has actually fired (running changed to false)
        // or timer restarted (running still true). Avoid applying the transitional
        // stopped+unpaused state which would jump display to intervalMin * 60.
        if (fresh && (fresh.running || fresh.pausedRemainSec != null)) {
          applyState(fresh);
        }
      }
    }, 1000);
  }

  // Periodically re-sync the countdown to prevent setInterval drift
  if (st.running) {
    syncTimer = setInterval(async () => {
      const fresh = await send({ type: 'GET_STATE' });
      if (fresh && fresh.running) {
        localRemSec = computeRemSec(fresh);
      }
    }, 30000);
  }

  // Show work-hours banner only when timer was paused by the gate (not manual pause).
  // Deliberately NOT gated on st.workHoursEnabled — weekend pause applies (and
  // defaults to on) independently of the work-hours toggle, so gatePaused can be
  // true purely from weekend gating even with work hours off. Requiring
  // workHoursEnabled here used to hide the banner (and leave a dead Resume
  // button visible) for exactly that case.
  const isWorkHoursPaused = st.gatePaused && !st.running;
  const banner = $('workHoursBanner');
  if (isWorkHoursPaused) {
    banner.style.display = 'flex';
    // Show which restriction applies
    const now = new Date();
    const day = now.getDay();
    const paused = (st.weekendDays || []).includes(day);
    $('whBannerMsg').textContent = paused
      ? t('pausedWeekend') || 'Paused — weekend'
      : t('pausedWorkHours') || `Paused — outside ${st.workStart}–${st.workEnd}`;
  } else {
    banner.style.display = 'none';
  }
  // Snooze and Resume are both no-ops while gate-paused (by design — neither should
  // silently bypass the weekend/work-hours gate). Hide them so "Run anyway" in the
  // banner above is the one unambiguous action, instead of leaving a Resume button
  // that looks clickable but silently does nothing.
  $('ctrlRow').style.display = isWorkHoursPaused ? 'none' : '';

  // Idle-pause banner — purely informational. Unlike the work-hours gate, Resume
  // works normally here (it's not a policy boundary), so the ctrl-row stays visible.
  $('idleBanner').style.display = (st.idlePaused && !st.running) ? 'flex' : 'none';

  renderRing(rem, st.intervalMin * 60);
  renderInterval(st.intervalMin);
  renderGoBtn(st.running, st.pausedRemainSec != null && !st.running);
  renderFocus(st.focusMode);
  renderStats(st);
  renderHistory(st);
  renderBreathRing(st.running, false);
  renderStretch(st.stretchIndex ?? 0);
  viewStretchIndex = st.stretchIndex ?? 0;

  const prefs = ['tNotif','tAnim','tSound','tWorkHours','tDailySummary','tIdle'];
  const prefKeys = {
    tNotif:'notifEnabled', tAnim:'animEnabled',
    tSound:'soundEnabled', tWorkHours:'workHoursEnabled', tDailySummary:'dailySummaryEnabled',
    tIdle:'idleDetectionEnabled',
  };
  prefs.forEach(id => {
    const on = !!st[prefKeys[id]];
    const btn = $(id);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
  });
  // tMale is "Female model" toggle — ON means female (maleModel=false)
  $('tMale').classList.toggle('on', !st.maleModel);
  $('tMale').setAttribute('aria-checked', String(!st.maleModel));

  $('soundLeadSelect').value = String(st.soundLeadSec ?? 10);
  $('soundLeadRow').classList.toggle('show', !!st.soundEnabled);
  $('langSelect').value = st.language || 'auto';

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
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[MicroBreaks] sendMessage error:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

async function init() {
  // Retry up to 5 times with increasing delays — service worker may be cold on fresh install
  let st = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    st = await send({ type: 'GET_STATE' });
    if (st) break;
    await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  if (!st) {
    // Last resort: show a basic error state rather than blank popup
    document.body.innerHTML = '<div style="padding:24px;text-align:center;color:#5DB8A0;font-family:sans-serif;font-size:13px;">Starting up...<br><br><button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;background:#5DB8A0;color:#1D3D38;border:none;border-radius:8px;cursor:pointer;font-size:12px;">Retry</button></div>';
    return;
  }

  const langPref = st.language || 'auto';
  const langToLoad = langPref === 'auto' ? detectBrowserLang() : langPref;
  await loadMessages(langToLoad);
  applyI18n();
  STRETCHES = STRETCHES_LIVE();
  $('langSelect').value = langPref;

  // Don't auto-start timer if onboarding isn't done yet
  if (!st.running && st.pausedRemainSec == null && !st.pendingBreak && st.onboardingDone) {
    st = await send({ type: 'START' });
  }
  applyState(st);

  if (st.badgeCount > 0) {
    await send({ type: 'CLEAR_BADGE' });
  }

  if ((st.totalBreaksAllTime || 0) >= 10 && !st.ratingNudgeDone) {
    showNudge();
  } else if ((st.totalBreaksAllTime || 0) >= 40 && st.ratingNudgeDone && !st.supportNudgeDone) {
    // Only after the rating nudge has been resolved — never show both at once
    showSupportNudge();
  }
}

$('langSelect').addEventListener('change', async (e) => {
  const langPref = e.target.value;
  const st = await send({ type: 'SET_PREF', key: 'language', value: langPref });
  if (st) state = st;
  const langToLoad = langPref === 'auto' ? detectBrowserLang() : langPref;
  await loadMessages(langToLoad);
  applyI18n();
  STRETCHES = STRETCHES_LIVE(); // rebuild so stretch names update in new language
  renderStretch(viewStretchIndex);
  renderHistory(state);
  renderGoBtn(state.running, state.pausedRemainSec != null && !state.running);
});

$('whRunAnywayBtn').addEventListener('click', async () => {
  const st = await send({ type: 'START' }); // force=true in background bypasses work hours
  applyState(st);
});

$('goBtn').addEventListener('click', async () => {
  let st;
  if (state.running) {
    st = await send({ type: 'PAUSE' });
  } else if (state.pausedRemainSec != null) {
    st = await send({ type: 'RESUME' });
  } else if (!state.pendingBreak) {
    // Don't start if there's a pending overlay waiting to be shown —
    // START would clear pendingBreak and the overlay would never appear
    st = await send({ type: 'START' });
  } else {
    // Pending break exists — just refresh state so popup reflects reality
    st = await send({ type: 'GET_STATE' });
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
    // SET_INTERVAL internally calls startTimer — no need to also send START
    const st = await send({ type: 'SET_INTERVAL', intervalMin: min });
    applyState(st);
  });
});

$('settingsBtn').addEventListener('click', () => {
  const layer = $('settingsLayer');
  const lower = $('mainLower');
  const open = layer.classList.toggle('open');
  layer.setAttribute('aria-hidden', String(!open));
  lower.style.display = open ? 'none' : '';
  // Close history panel when settings opens
  if (open) {
    $('historyPanel').classList.remove('open');
    $('historyPanel').setAttribute('aria-hidden', 'true');
  }
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
    clearInterval(syncTimer); // stop polling during break display
    $('cdDisplay').textContent = t('moveNow');
    $('cdDisplay').classList.add('break-time');
    $('cdLbl').textContent = t('breakTime');
    $('progRing').classList.add('break-mode');
    renderBreathRing(false, true);
    renderGoBtn(false, false);
    // Hide the stretch card during break — it shows "up next" which would be confusing
    $('stretchAreaMain').style.display = 'none';
    // If a nudge is showing, dismiss it so break takes priority
    if ($('nudgePanel').classList.contains('open')) {
      $('nudgePanel').classList.remove('open');
      $('nudgePanel').setAttribute('aria-hidden', 'true');
    }
    if ($('supportPanel').classList.contains('open')) {
      $('supportPanel').classList.remove('open');
      $('supportPanel').setAttribute('aria-hidden', 'true');
    }
    setTimeout(async () => {
      $('cdDisplay').classList.remove('break-time');
      $('cdLbl').textContent = t('untilBreak');
      $('progRing').classList.remove('break-mode');
      const st = await send({ type: 'GET_STATE' });
      applyState(st); // applyState restores stretchAreaMain display
      if (st && (msg.totalBreaks || 0) >= 10 && !st.ratingNudgeDone) {
        showNudge();
      } else if (st && (msg.totalBreaks || 0) >= 40 && st.ratingNudgeDone && !st.supportNudgeDone) {
        showSupportNudge();
      }
    }, 4000);
  }
});

function showNudge() {
  // Close settings panel if open
  $('settingsLayer').classList.remove('open');
  $('settingsLayer').setAttribute('aria-hidden', 'true');
  $('mainLower').style.display = '';
  // Close both the stretch area and the grid panel before showing the nudge
  $('stretchAreaMain').style.display = 'none';
  $('stretchGridPanel').classList.remove('open');
  $('stretchGridPanel').setAttribute('aria-hidden', 'true');
  $('nudgePanel').classList.add('open');
  $('nudgePanel').setAttribute('aria-hidden', 'false');
}

function hideNudge() {
  $('nudgePanel').classList.remove('open');
  $('nudgePanel').setAttribute('aria-hidden', 'true');
  // Only restore stretchAreaMain — the grid stays closed
  $('stretchAreaMain').style.display = '';
  $('stretchGridPanel').classList.remove('open');
  $('stretchGridPanel').setAttribute('aria-hidden', 'true');
}

$('nudgeDismissBtn').addEventListener('click', async () => {
  hideNudge();
  await send({ type: 'SET_PREF', key: 'ratingNudgeDone', value: true });
});

$('nudgeReviewBtn').addEventListener('click', async () => {
  await send({ type: 'SET_PREF', key: 'ratingNudgeDone', value: true });
  setTimeout(hideNudge, 800);
});

function showSupportNudge() {
  $('settingsLayer').classList.remove('open');
  $('settingsLayer').setAttribute('aria-hidden', 'true');
  $('mainLower').style.display = '';
  $('stretchAreaMain').style.display = 'none';
  $('stretchGridPanel').classList.remove('open');
  $('stretchGridPanel').setAttribute('aria-hidden', 'true');
  $('supportPanel').classList.add('open');
  $('supportPanel').setAttribute('aria-hidden', 'false');
}

function hideSupportNudge() {
  $('supportPanel').classList.remove('open');
  $('supportPanel').setAttribute('aria-hidden', 'true');
  $('stretchAreaMain').style.display = '';
  $('stretchGridPanel').classList.remove('open');
  $('stretchGridPanel').setAttribute('aria-hidden', 'true');
}

$('supportDismissBtn').addEventListener('click', async () => {
  hideSupportNudge();
  await send({ type: 'SET_PREF', key: 'supportNudgeDone', value: true });
});

$('supportBtn').addEventListener('click', async () => {
  await send({ type: 'SET_PREF', key: 'supportNudgeDone', value: true });
  setTimeout(hideSupportNudge, 800);
});

$('historyToggle').addEventListener('click', () => {
  const panel = $('historyPanel');
  const open = panel.classList.toggle('open');
  panel.setAttribute('aria-hidden', String(!open));
  // Close settings if open
  if (open) {
    $('settingsLayer').classList.remove('open');
    $('settingsLayer').setAttribute('aria-hidden', 'true');
    $('mainLower').style.display = '';
  }
  if (open) renderHistory(state);
});

$('historyClose').addEventListener('click', () => {
  $('historyPanel').classList.remove('open');
  $('historyPanel').setAttribute('aria-hidden', 'true');
});

$('openOptionsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function renderStretchGrid() {
  const grid = $('stretchGrid');
  grid.innerHTML = '';
  const order = state.stretchOrder || STRETCHES.map((_, i) => i);
  const enabled = state.stretchEnabled || order.map(() => true);
  // Only show stretches that are enabled, in the user's custom order
  const activeOrder = order.filter((_, i) => enabled[i] !== false);
  const currentIdx = state.stretchIndex ?? 0;
  (activeOrder.length > 0 ? activeOrder : order).forEach((stretchId) => {
    const s = STRETCHES[stretchId];
    const card = document.createElement('div');
    card.className = 'grid-stretch-card' + (stretchId === currentIdx ? ' next-up' : '');
    card.innerHTML = `
      ${stretchId === currentIdx ? `<div class="grid-next-badge">${t('upNext')}</div>` : ''}
      <div class="grid-stretch-icon">${s.emoji}</div>
      <div class="grid-stretch-name">${s.name}</div>
      <div class="grid-stretch-dur">${s.dur}</div>
    `;
    card.addEventListener('click', () => {
      viewStretchIndex = stretchId;
      renderStretch(stretchId);
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
