const $ = id => document.getElementById(id);

let messages = {};
let state = {};

function t(key) {
  const m = messages[key];
  return m ? m.message : key;
}

async function loadMessages(lang) {
  const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('not found');
    messages = await res.json();
  } catch (e) {
    if (lang !== 'en') {
      const url2 = chrome.runtime.getURL(`_locales/en/messages.json`);
      const res2 = await fetch(url2);
      messages = await res2.json();
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
}

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

// ===== SIDEBAR NAVIGATION =====

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('section-' + btn.dataset.section).classList.add('active');
  });
});

// ===== RENDER STATE =====

function renderAll() {
  // Interval chips
  const knownIntervals = [20, 30, 45];
  document.querySelectorAll('#intervalRow .chip').forEach(chip => {
    const min = parseInt(chip.dataset.min);
    chip.classList.toggle('active', knownIntervals.includes(state.intervalMin) ? min === state.intervalMin : min === 0);
  });

  $('optStrictMode').classList.toggle('on', !!state.focusMode);
  $('optStrictMode').setAttribute('aria-checked', String(!!state.focusMode));

  $('optSnoozeMin').value = '5';

  $('optNotif').classList.toggle('on', !!state.notifEnabled);
  $('optNotif').setAttribute('aria-checked', String(!!state.notifEnabled));

  $('optSound').classList.toggle('on', !!state.soundEnabled);
  $('optSound').setAttribute('aria-checked', String(!!state.soundEnabled));
  $('optSoundLeadGroup').style.display = state.soundEnabled ? '' : 'none';
  $('optChimeSoundGroup').style.display = state.soundEnabled ? '' : 'none';
  $('optSoundLead').value = String(state.soundLeadSec ?? 10);

  document.querySelectorAll('#soundChipRow .chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.sound === (state.chimeSound || 'marimba'));
  });

  $('optDailySummary').classList.toggle('on', !!state.dailySummaryEnabled);
  $('optDailySummary').setAttribute('aria-checked', String(!!state.dailySummaryEnabled));
  $('optSummaryRow').style.display = state.workHoursEnabled ? '' : 'none';

  document.querySelectorAll('#themeGrid .theme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.theme === (state.theme || 'sage'));
  });

  $('optMaleModel').classList.toggle('on', !!state.maleModel);
  $('optMaleModel').setAttribute('aria-checked', String(!!state.maleModel));

  $('optAnim').classList.toggle('on', !!state.animEnabled);
  $('optAnim').setAttribute('aria-checked', String(!!state.animEnabled));

  const darkPref = state.darkMode || 'system';
  $('optDarkMode').value = darkPref;
  document.body.classList.remove('dark', 'force-light');
  if (darkPref === 'dark') document.body.classList.add('dark');
  if (darkPref === 'light') document.body.classList.add('force-light');

  $('optWorkHours').classList.toggle('on', !!state.workHoursEnabled);
  $('optWorkHours').setAttribute('aria-checked', String(!!state.workHoursEnabled));
  $('workHoursTimes').style.display = state.workHoursEnabled ? '' : 'none';
  $('optWorkStart').value = state.workStart || '09:00';
  $('optWorkEnd').value = state.workEnd || '17:00';

  const weekendDays = state.weekendDays || [];
  document.querySelectorAll('#weekdayGrid .day-card').forEach(card => {
    const day = parseInt(card.dataset.day);
    card.classList.toggle('paused', weekendDays.includes(day));
  });

  $('optLangSelect').value = state.language || 'auto';
}

// ===== EVENT HANDLERS =====

document.querySelectorAll('#intervalRow .chip').forEach(chip => {
  chip.addEventListener('click', async () => {
    let min = parseInt(chip.dataset.min);
    if (min === 0) {
      const v = parseInt(prompt(t('customPrompt'), '60'));
      if (isNaN(v) || v < 1) return;
      min = v;
    }
    state = await send({ type: 'SET_INTERVAL', intervalMin: min });
    renderAll();
  });
});

$('optStrictMode').addEventListener('click', async () => {
  state = await send({ type: 'SET_FOCUS', value: !state.focusMode });
  renderAll();
});

$('optNotif').addEventListener('click', async () => {
  state = await send({ type: 'SET_PREF', key: 'notifEnabled', value: !state.notifEnabled });
  renderAll();
});

$('optSound').addEventListener('click', async () => {
  state = await send({ type: 'SET_PREF', key: 'soundEnabled', value: !state.soundEnabled });
  renderAll();
});

$('optSoundLead').addEventListener('change', async (e) => {
  state = await send({ type: 'SET_PREF', key: 'soundLeadSec', value: parseInt(e.target.value) });
  renderAll();
});

const SOUND_FILES = {
  marimba: 'sounds/chime-marimba.mp3',
  bell: 'sounds/chime-bell.mp3',
  kalimba: 'sounds/chime-kalimba.mp3',
  windchime: 'sounds/chime-windchime.mp3',
};

document.querySelectorAll('#soundChipRow .chip').forEach(chip => {
  chip.addEventListener('click', async () => {
    const sound = chip.dataset.sound;
    state = await send({ type: 'SET_PREF', key: 'chimeSound', value: sound });
    renderAll();
    try {
      const audio = new Audio(chrome.runtime.getURL(SOUND_FILES[sound] || SOUND_FILES.marimba));
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (e) {}
  });
});

$('optDailySummary').addEventListener('click', async () => {
  state = await send({ type: 'SET_PREF', key: 'dailySummaryEnabled', value: !state.dailySummaryEnabled });
  renderAll();
});

document.querySelectorAll('#themeGrid .theme-card').forEach(card => {
  card.addEventListener('click', async () => {
    state = await send({ type: 'SET_PREF', key: 'theme', value: card.dataset.theme });
    renderAll();
  });
});

$('optDarkMode').addEventListener('change', async (e) => {
  state = await send({ type: 'SET_PREF', key: 'darkMode', value: e.target.value });
  renderAll();
});

$('optMaleModel').addEventListener('click', async () => {
  state = await send({ type: 'SET_PREF', key: 'maleModel', value: !state.maleModel });
  renderAll();
});

$('optAnim').addEventListener('click', async () => {
  state = await send({ type: 'SET_PREF', key: 'animEnabled', value: !state.animEnabled });
  renderAll();
});

$('optWorkHours').addEventListener('click', async () => {
  const enabled = !state.workHoursEnabled;
  state = await send({ type: 'SET_WORK_HOURS', enabled, start: state.workStart || '09:00', end: state.workEnd || '17:00' });
  renderAll();
});

async function pushWorkHours() {
  const enabled = state.workHoursEnabled;
  const start = $('optWorkStart').value || '09:00';
  const end = $('optWorkEnd').value || '17:00';
  state = await send({ type: 'SET_WORK_HOURS', enabled, start, end });
  renderAll();
}
$('optWorkStart').addEventListener('change', pushWorkHours);
$('optWorkEnd').addEventListener('change', pushWorkHours);

document.querySelectorAll('#weekdayGrid .day-card').forEach(card => {
  card.addEventListener('click', async () => {
    const day = parseInt(card.dataset.day);
    const current = new Set(state.weekendDays || []);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    state = await send({ type: 'SET_WEEKEND_DAYS', days: Array.from(current) });
    renderAll();
  });
});

$('optLangSelect').addEventListener('change', async (e) => {
  const langPref = e.target.value;
  state = await send({ type: 'SET_PREF', key: 'language', value: langPref });
  const langToLoad = langPref === 'auto' ? detectBrowserLang() : langPref;
  await loadMessages(langToLoad);
  applyI18n();
  renderAll();
});

// ===== INIT =====

async function init() {
  state = await send({ type: 'GET_STATE' });

  const langPref = state.language || 'auto';
  const langToLoad = langPref === 'auto' ? detectBrowserLang() : langPref;
  await loadMessages(langToLoad);
  applyI18n();

  const manifest = chrome.runtime.getManifest();
  $('aboutVersionVal').textContent = manifest.version;

  renderAll();
}

init();
