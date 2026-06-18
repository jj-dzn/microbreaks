const STRETCHES = [
  { emoji: "🔄", name: "Neck rolls", desc: "Slowly circle your head three times each direction. Let your jaw go soft.", dur: "30 sec" },
  { emoji: "☝️", name: "Overhead reach", desc: "Interlace fingers, press palms toward the ceiling. Take two deep breaths.", dur: "30 sec" },
  { emoji: "👁", name: "20-20-20 rule", desc: "Find something 20 feet away. Look at it for 20 seconds without blinking.", dur: "20 sec" },
  { emoji: "🤲", name: "Wrist circles", desc: "Extend arms forward. Rotate wrists in wide circles — five each direction.", dur: "20 sec" },
  { emoji: "🙆", name: "Shoulder rolls", desc: "Roll shoulders slowly backward five times, then forward five. Release the day.", dur: "30 sec" },
];

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
  $('focusLbl').textContent = on ? 'focus on' : 'focus mode';
}

function renderGoBtn(running, paused) {
  const btn = $('goBtn');
  const icon = $('goIcon');
  const lbl = $('goLbl');
  if (running) {
    btn.className = 'btn-go pause-mode';
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    lbl.textContent = 'pause';
  } else if (paused) {
    btn.className = 'btn-go';
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    lbl.textContent = 'resume';
  } else {
    btn.className = 'btn-go';
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    lbl.textContent = 'start';
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

  const prefs = ['tNotif','tAnim','tMale'];
  const prefKeys = { tNotif:'notifEnabled', tAnim:'animEnabled', tMale:'maleModel' };
  prefs.forEach(id => {
    const on = !!st[prefKeys[id]];
    const btn = $(id);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
  });
}

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

async function init() {
  let st = await send({ type: 'GET_STATE' });
  if (!st.running && st.pausedRemainSec == null) {
    st = await send({ type: 'START', intervalMin: st.intervalMin });
  }
  applyState(st);
}

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
      const v = parseInt(prompt('Minutes between breaks?', '60'));
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
    $('cdDisplay').textContent = 'move!';
    $('cdDisplay').classList.add('break-time');
    $('cdLbl').textContent = 'time to stretch';
    $('progRing').classList.add('break-mode');
    renderBreathRing(false, true);
    renderGoBtn(false, false);
    renderStretch(msg.stretchIndex);
    viewStretchIndex = msg.stretchIndex;
    setTimeout(async () => {
      $('cdDisplay').classList.remove('break-time');
      $('cdLbl').textContent = 'until break';
      $('progRing').classList.remove('break-mode');
      const st = await send({ type: 'GET_STATE' });
      applyState(st);
    }, 4000);
  }
});

init();
