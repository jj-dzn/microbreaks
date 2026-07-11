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
      try {
        const url2 = chrome.runtime.getURL(`_locales/en/messages.json`);
        const res2 = await fetch(url2);
        messages = await res2.json();
      } catch (e2) {
        console.log('[MicroBreaks] Failed to load any locale messages');
        messages = {};
      }
    } else {
      messages = {};
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
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
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

// ===== SIDEBAR NAVIGATION =====

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('section-' + btn.dataset.section).classList.add('active');
    if (btn.dataset.section === 'stretches') renderStretchList();
  });
});

// ===== RENDER STATE =====

function renderAll() {
  if (!state || !Object.keys(state).length) return; // guard against null/empty state
  if (!messages || !Object.keys(messages).length) return; // guard against messages not yet loaded
  const knownIntervals = [20, 30, 45];
  document.querySelectorAll('#intervalRow .chip').forEach(chip => {
    const min = parseInt(chip.dataset.min);
    chip.classList.toggle('active', knownIntervals.includes(state.intervalMin) ? min === state.intervalMin : min === 0);
  });

  $('optStrictMode').classList.toggle('on', !!state.focusMode);
  $('optStrictMode').setAttribute('aria-checked', String(!!state.focusMode));


  $('optSnoozeMin').value = String(state.snoozeMin || 5);

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

  // Toggle is "Female model" — ON means female (maleModel=false), OFF means male (maleModel=true)
  $('optMaleModel').classList.toggle('on', !state.maleModel);
  $('optMaleModel').setAttribute('aria-checked', String(!state.maleModel));

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


$('optSnoozeMin').addEventListener('change', async (e) => {
  state = await send({ type: 'SET_PREF', key: 'snoozeMin', value: parseInt(e.target.value) });
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

// ===== STRETCH LIST =====

const STRETCH_EMOJIS = ["🔄","☝️","👁","🤲","🙆","🌀","🙇","🦋","↔️","😌","💪","👆","🦶","🖐","🧘"];
const STRETCH_DURATIONS = ["30 sec","30 sec","20 sec","20 sec","30 sec","30 sec","30 sec","30 sec","30 sec","20 sec","30 sec","20 sec","20 sec","20 sec","30 sec"];
const STRETCH_KEYS_OPT = ["stretchNeckRolls","stretchOverheadReach","stretch2020","stretchWristCircles","stretchShoulderRolls","stretchSpinalTwist","stretchForwardFold","stretchChestOpener","stretchSideStretch","stretchChinTucks","stretchUpperBackSqueeze","stretchTempleMassage","stretchAnkleCircles","stretchFingerSpreads","stretchHipStretch"];

let dragSrcIdx = null;

function renderStretchList() {
  const wrap = $('stretchListWrap');
  if (!wrap) return;
  const order = state.stretchOrder || [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const enabled = state.stretchEnabled || order.map(() => true);
  wrap.innerHTML = '';

  order.forEach((stretchIdx, pos) => {
    const isEnabled = enabled[pos] !== false;
    const name = t(STRETCH_KEYS_OPT[stretchIdx]) || STRETCH_KEYS_OPT[stretchIdx];
    const item = document.createElement('div');
    item.className = 'stretch-list-item' + (isEnabled ? '' : ' disabled-stretch');
    item.draggable = true;
    item.dataset.pos = pos;
    item.innerHTML = `
      <span class="stretch-drag-handle">⠿</span>
      <span class="stretch-list-emoji">${STRETCH_EMOJIS[stretchIdx]}</span>
      <span class="stretch-list-name">${name}</span>
      <span class="stretch-list-dur">${STRETCH_DURATIONS[stretchIdx]}</span>
      <button class="toggle ${isEnabled ? 'on' : ''}" role="switch" aria-checked="${isEnabled}" data-pos="${pos}"></button>
    `;

    // Toggle enable/disable — always fetch fresh state to avoid stale array mismatch
    item.querySelector('.toggle').addEventListener('click', async (e) => {
      e.stopPropagation();
      const fresh = await send({ type: 'GET_STATE' });
      if (!fresh) return;
      const freshOrder = fresh.stretchOrder || [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
      const newEnabled = [...(fresh.stretchEnabled || freshOrder.map(() => true))];
      newEnabled[pos] = !newEnabled[pos];
      state = await send({ type: 'SET_PREF', key: 'stretchEnabled', value: newEnabled });
      renderStretchList();
    });

    // Drag reorder
    item.addEventListener('dragstart', (e) => {
      dragSrcIdx = pos;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      wrap.querySelectorAll('.stretch-list-item').forEach(i => i.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      wrap.querySelectorAll('.stretch-list-item').forEach(i => i.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === pos) return;
      // Fetch fresh state to avoid stale enabled array if toggles happened during drag
      const fresh = await send({ type: 'GET_STATE' });
      if (!fresh) return;
      const newOrder = [...(fresh.stretchOrder || [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])];
      const newEnabled = [...(fresh.stretchEnabled || newOrder.map(() => true))];
      const [movedO] = newOrder.splice(dragSrcIdx, 1);
      const [movedE] = newEnabled.splice(dragSrcIdx, 1);
      newOrder.splice(pos, 0, movedO);
      newEnabled.splice(pos, 0, movedE);
      await send({ type: 'SET_PREF', key: 'stretchOrder', value: newOrder });
      state = await send({ type: 'SET_PREF', key: 'stretchEnabled', value: newEnabled });
      dragSrcIdx = null;
      renderStretchList();
    });

    wrap.appendChild(item);
  });
}

// ===== ONBOARDING REPLAY =====

$('replayOnboardingBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
});

$('shortcutsBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ===== INIT =====

async function init() {
  // Retry up to 5 times — service worker may be cold on fresh install
  let state_tmp = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    state_tmp = await send({ type: 'GET_STATE' });
    if (state_tmp) break;
    await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  state = state_tmp;
  if (!state) return;

  const langPref = state.language || 'auto';
  const langToLoad = langPref === 'auto' ? detectBrowserLang() : langPref;
  await loadMessages(langToLoad);
  applyI18n();

  const manifest = chrome.runtime.getManifest();
  $('aboutVersionVal').textContent = manifest.version;

  renderAll();
}

init();
