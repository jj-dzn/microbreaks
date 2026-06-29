const ALARM_NAME = "microbreak";
const CHIME_ALARM_NAME = "microbreak-chime";
const SUMMARY_ALARM_NAME = "microbreak-summary";

let bgMessages = null;
let bgLang = null;

async function loadBgMessages(lang) {
  if (bgLang === lang && bgMessages) return bgMessages;
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    bgMessages = await res.json();
    bgLang = lang;
  } catch (e) {
    if (lang !== 'en') {
      const url = chrome.runtime.getURL(`_locales/en/messages.json`);
      const res = await fetch(url);
      bgMessages = await res.json();
      bgLang = 'en';
    }
  }
  return bgMessages;
}

function detectBgLang() {
  const supported = ['en','es','fr','de','hi','ml','ta','te'];
  const navLang = (chrome.i18n.getUILanguage() || 'en').split('-')[0].toLowerCase();
  return supported.includes(navLang) ? navLang : 'en';
}

async function bgT(key, sub) {
  if (!bgMessages) {
    const state = await getState();
    const lang = (state.language === 'auto' || !state.language) ? detectBgLang() : state.language;
    await loadBgMessages(lang);
  }
  const m = bgMessages[key];
  if (!m) return key;
  let text = m.message;
  if (sub) text = text.replace('$MINUTES$', sub);
  return text;
}

// ===== STORAGE SPLIT =====
// chrome.storage.sync holds small, cross-device data: streak, totals, and user prefs.
// chrome.storage.local holds session-only / high-churn data: timer state, alarms bookkeeping.
// sync has a strict 8KB per-item / 100KB total quota, so only compact fields go there.

const SYNC_DEFAULTS = {
  intervalMin: 20,
  focusMode: false,
  notifEnabled: true,
  animEnabled: true,
  maleModel: false,
  language: "auto",
  streakDays: 0,
  lastBreakDate: null,
  totalBreaksAllTime: 0,
  soundEnabled: true,
  soundLeadSec: 10,
  workHoursEnabled: false,
  workStart: "09:00",
  workEnd: "17:00",
  weekendDays: [0, 6],          // 0=Sun ... 6=Sat ; default both off
  dailySummaryEnabled: true,
};

const LOCAL_DEFAULTS = {
  running: false,
  startedAt: null,
  pausedRemainSec: null,
  breaksToday: 0,
  minsMoved: 0,
  stretchIndex: 0,
  summaryShownDate: null,
  badgeCount: 0,
};

async function getState() {
  const sync = await chrome.storage.sync.get(SYNC_DEFAULTS);
  const local = await chrome.storage.local.get(LOCAL_DEFAULTS);
  return { ...SYNC_DEFAULTS, ...sync, ...LOCAL_DEFAULTS, ...local };
}

const SYNC_KEYS = new Set(Object.keys(SYNC_DEFAULTS));

async function setState(patch) {
  const syncPatch = {};
  const localPatch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (SYNC_KEYS.has(k)) syncPatch[k] = v;
    else localPatch[k] = v;
  }
  if (Object.keys(syncPatch).length) await chrome.storage.sync.set(syncPatch);
  if (Object.keys(localPatch).length) await chrome.storage.local.set(localPatch);
}

// ===== WORK HOURS / WEEKEND HELPERS =====

function parseHM(str) {
  const [h, m] = (str || "09:00").split(":").map(Number);
  return { h, m };
}

function isWithinWorkHours(state, now = new Date()) {
  if (!state.workHoursEnabled) return true;
  const { h: sh, m: sm } = parseHM(state.workStart);
  const { h: eh, m: em } = parseHM(state.workEnd);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // overnight range (e.g. 22:00 - 06:00) — not expected for work hours but handled safely
  return nowMin >= startMin || nowMin < endMin;
}

function isWeekendPaused(state, now = new Date()) {
  const day = now.getDay(); // 0=Sun ... 6=Sat
  return (state.weekendDays || []).includes(day);
}

function minutesUntilWorkStart(state, now = new Date()) {
  const { h, m } = parseHM(state.workStart);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  return Math.max(1, Math.round((start - now) / 60000));
}

// ===== TIMER CORE =====

async function startTimer(intervalMin) {
  const state = await getState();
  if (intervalMin == null) intervalMin = state.intervalMin || 20;

  if (isWeekendPaused(state) || !isWithinWorkHours(state)) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    await setState({ running: false, startedAt: null, pausedRemainSec: intervalMin * 60, intervalMin });
    return;
  }

  const startedAt = Date.now();
  await setState({ running: true, startedAt, pausedRemainSec: null, intervalMin });
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(CHIME_ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: intervalMin });

  const leadSec = state.soundEnabled ? (state.soundLeadSec || 0) : 0;
  if (leadSec > 0 && intervalMin * 60 > leadSec) {
    const chimeDelayMin = intervalMin - (leadSec / 60);
    chrome.alarms.create(CHIME_ALARM_NAME, { delayInMinutes: chimeDelayMin });
  }
}

async function pauseTimer() {
  const state = await getState();
  if (!state.running || !state.startedAt) return;
  const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
  const totalSec = state.intervalMin * 60;
  const remainSec = Math.max(0, totalSec - elapsedSec);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(CHIME_ALARM_NAME);
  await setState({ running: false, pausedRemainSec: remainSec, startedAt: null });
}

async function resumeTimer() {
  const state = await getState();

  if (isWeekendPaused(state) || !isWithinWorkHours(state)) {
    return;
  }

  const remainSec = state.pausedRemainSec ?? state.intervalMin * 60;
  const delayInMinutes = remainSec / 60;
  const startedAt = Date.now();
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(CHIME_ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes });

  const leadSec = state.soundEnabled ? (state.soundLeadSec || 0) : 0;
  if (leadSec > 0 && remainSec > leadSec) {
    const chimeDelayMin = (remainSec - leadSec) / 60;
    chrome.alarms.create(CHIME_ALARM_NAME, { delayInMinutes: chimeDelayMin });
  }

  await setState({ running: true, startedAt, pausedRemainSec: null });
}

async function stopTimer() {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(CHIME_ALARM_NAME);
  await setState({ running: false, startedAt: null, pausedRemainSec: null });
}

async function snoozeTimer() {
  const state = await getState();
  const SNOOZE_MIN = 5;
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(CHIME_ALARM_NAME);

  let newRemainSec;
  if (state.running) {
    const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
    const totalSec = state.intervalMin * 60;
    newRemainSec = Math.max(0, totalSec - elapsedSec) + SNOOZE_MIN * 60;
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: newRemainSec / 60 });
    await setState({ startedAt: Date.now(), pausedRemainSec: null });
  } else if (state.pausedRemainSec != null) {
    newRemainSec = state.pausedRemainSec + SNOOZE_MIN * 60;
    await setState({ pausedRemainSec: newRemainSec });
    return;
  } else {
    return;
  }

  const leadSec = state.soundEnabled ? (state.soundLeadSec || 0) : 0;
  if (leadSec > 0 && newRemainSec > leadSec) {
    chrome.alarms.create(CHIME_ALARM_NAME, { delayInMinutes: (newRemainSec - leadSec) / 60 });
  }
}

// ===== SOUND (offscreen document) =====

let creatingOffscreen = null;

async function ensureOffscreen() {
  let has = false;
  try {
    has = await chrome.offscreen.hasDocument?.();
  } catch (e) {
    has = false;
  }

  if (has) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play a short chime before a scheduled stretch break.',
      });
    } catch (e) {
      // A stale/orphaned offscreen document can cause "already exists" or
      // "Page failed to load" errors. Close it and retry once.
      console.log('[MicroBreaks] First offscreen create attempt failed:', e.message, '— retrying');
      try {
        await chrome.offscreen.closeDocument();
      } catch (_) { /* nothing to close */ }
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play a short chime before a scheduled stretch break.',
      });
    }
  })();

  await creatingOffscreen;
  creatingOffscreen = null;

  // Give the offscreen document a brief moment to finish executing offscreen.js
  // and attach its onMessage listener before we send PLAY_CHIME.
  await new Promise(r => setTimeout(r, 120));
}

async function playChime() {
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: 'PLAY_CHIME' });
  } catch (e) {
    console.log('[MicroBreaks] Could not play chime:', e && e.message);
  }
}

// ===== NOTIFICATIONS =====

async function fireNotification(message, stretchIndex) {
  const title = await bgT('timeToMove');
  const snoozeLbl = await bgT('snoozeBtn');
  const restartLbl = await bgT('restartBtn');
  chrome.notifications.create("microbreak-" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    buttons: [{ title: snoozeLbl }, { title: restartLbl }],
    requireInteraction: true,
  });
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toDateString();
}

// Finds the active tab in whichever Chrome window is genuinely focused on screen
// right now. chrome.tabs.query({currentWindow:true}) is unreliable here because it
// resolves relative to the service worker's own notion of "current", which can be
// stale or point at a background/minimized window — not what the user is looking at.
function getActiveVisibleTab(callback) {
  chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] }, (win) => {
    if (chrome.runtime.lastError || !win) {
      // Fall back to querying any active tab across all windows.
      chrome.tabs.query({ active: true }, (tabs) => callback(tabs && tabs[0]));
      return;
    }
    const tab = (win.tabs || []).find(t => t.active) || (win.tabs || [])[0];
    if (tab) {
      callback(tab);
    } else {
      chrome.tabs.query({ active: true }, (tabs) => callback(tabs && tabs[0]));
    }
  });
}

async function fireBreak() {
  const state = await getState();

  if (isWeekendPaused(state) || !isWithinWorkHours(state)) {
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    return;
  }

  const today = new Date().toDateString();
  let { breaksToday, minsMoved, streakDays, lastBreakDate, stretchIndex, totalBreaksAllTime } = state;

  if (lastBreakDate !== today) {
    breaksToday = 0;
    minsMoved = 0;
    if (lastBreakDate === yesterday()) {
      streakDays += 1;
    } else {
      streakDays = 1;
    }
  }

  breaksToday += 1;
  minsMoved += 1;
  totalBreaksAllTime = (totalBreaksAllTime || 0) + 1;
  stretchIndex = (stretchIndex + 1) % 15;

  await setState({
    breaksToday, minsMoved, streakDays, lastBreakDate: today, totalBreaksAllTime,
    stretchIndex, running: false, startedAt: null, pausedRemainSec: null,
  });

  const stretchKeys = [
    "stretchNeckRolls", "stretchOverheadReach", "stretch2020", "stretchWristCircles", "stretchShoulderRolls",
    "stretchSpinalTwist", "stretchForwardFold", "stretchChestOpener", "stretchSideStretch", "stretchChinTucks",
    "stretchUpperBackSqueeze", "stretchTempleMassage", "stretchAnkleCircles", "stretchFingerSpreads", "stretchHipStretch",
  ];
  const stretchName = await bgT(stretchKeys[stretchIndex]);
  const stretchDesc = await bgT(stretchKeys[stretchIndex] + "Desc");
  const notifText = `${stretchName} — ${stretchDesc}`;

  if (state.focusMode) {
    getActiveVisibleTab(async (tab) => {
      try {
        const restricted = !tab || !tab.id ||
          !tab.url ||
          tab.url.startsWith("chrome://") ||
          tab.url.startsWith("chrome-extension://") ||
          tab.url.startsWith("edge://") ||
          tab.url.startsWith("about:") ||
          tab.url.startsWith("https://chrome.google.com/webstore") ||
          tab.url.startsWith("https://chromewebstore.google.com");

        if (!restricted) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"],
            });
            const resolvedLang = (state.language === 'auto' || !state.language) ? detectBgLang() : state.language;
            await chrome.tabs.sendMessage(tab.id, { type: "SHOW_BREAK_OVERLAY", stretchIndex, male: state.maleModel, lang: resolvedLang });
          } catch (e) {
            console.log("[MicroBreaks] Overlay injection failed on:", tab && tab.url, "—", e && e.message);
            await fireNotification(notifText, stretchIndex);
          }
        } else {
          await fireNotification(notifText, stretchIndex);
        }
      } catch (outerErr) {
        // Absolute last resort — chrome.tabs.query itself misbehaved, or something
        // upstream threw outside the inner try/catch. Never let a break fire silently.
        console.log("[MicroBreaks] Unexpected error in focus-mode flow —", outerErr && outerErr.message);
        await fireNotification(notifText, stretchIndex);
      }
    });
  } else if (state.notifEnabled) {
    await fireNotification(notifText, stretchIndex);
  }

  chrome.runtime.sendMessage({ type: "BREAK_FIRED", stretchIndex }).catch(() => {});
}

// ===== DAILY SUMMARY =====

function scheduleSummaryAlarm(state) {
  chrome.alarms.clear(SUMMARY_ALARM_NAME);
  if (!state.workHoursEnabled || !state.dailySummaryEnabled) return;
  const { h, m } = parseHM(state.workEnd);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delayMin = Math.max(1, Math.round((target - now) / 60000));
  chrome.alarms.create(SUMMARY_ALARM_NAME, { delayInMinutes: delayMin, periodInMinutes: 24 * 60 });
}

async function fireDailySummary() {
  const state = await getState();
  const today = new Date().toDateString();
  if (state.summaryShownDate === today) return;
  if (isWeekendPaused(state)) return;

  await setState({ summaryShownDate: today, badgeCount: (state.badgeCount || 0) + 1 });

  const titleTmpl = await bgT('summaryTitle');
  const bodyTmpl = await bgT('summaryBody');
  const body = bodyTmpl
    .replace('$BREAKS$', String(state.breaksToday || 0))
    .replace('$MINUTES$', String(state.minsMoved || 0))
    .replace('$STREAK$', String(state.streakDays || 0));

  chrome.notifications.create('microbreaks-summary-' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: titleTmpl,
    message: body,
    requireInteraction: false,
  });

  chrome.action.setBadgeText({ text: '1' });
  chrome.action.setBadgeBackgroundColor({ color: '#E8A84C' });
}

// ===== ALARM ROUTER =====

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) fireBreak();
  if (alarm.name === CHIME_ALARM_NAME) playChime();
  if (alarm.name === SUMMARY_ALARM_NAME) fireDailySummary();
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIndex) => {
  if (notifId.startsWith("microbreak-")) {
    if (btnIndex === 0) snoozeTimer();
    if (btnIndex === 1) getState().then(s => startTimer(s.intervalMin));
    chrome.notifications.clear(notifId);
  }
});

// ===== MESSAGE ROUTER =====

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "GET_STATE":      sendResponse(await getState()); break;
      case "START":          await startTimer(msg.intervalMin); sendResponse(await getState()); break;
      case "PAUSE":          await pauseTimer(); sendResponse(await getState()); break;
      case "RESUME":         await resumeTimer(); sendResponse(await getState()); break;
      case "STOP":           await stopTimer(); sendResponse(await getState()); break;
      case "SNOOZE":         await snoozeTimer(); sendResponse(await getState()); break;
      case "SET_INTERVAL":   await setState({ intervalMin: msg.intervalMin }); sendResponse(await getState()); break;
      case "SET_FOCUS":      await setState({ focusMode: msg.value }); sendResponse(await getState()); break;

      case "SET_PREF": {
        await setState({ [msg.key]: msg.value });
        if (msg.key === 'language') { bgMessages = null; bgLang = null; }
        const newState = await getState();
        if (['workHoursEnabled', 'workStart', 'workEnd', 'dailySummaryEnabled'].includes(msg.key)) {
          scheduleSummaryAlarm(newState);
        }
        if (['workHoursEnabled', 'workStart', 'workEnd', 'weekendDays'].includes(msg.key)) {
          if (newState.running || newState.pausedRemainSec != null) {
            await startTimer(newState.intervalMin);
          }
        }
        sendResponse(await getState());
        break;
      }

      case "SET_WORK_HOURS": {
        await setState({ workHoursEnabled: msg.enabled, workStart: msg.start, workEnd: msg.end });
        const newState = await getState();
        scheduleSummaryAlarm(newState);
        if (newState.running || newState.pausedRemainSec != null) {
          await startTimer(newState.intervalMin);
        }
        sendResponse(await getState());
        break;
      }

      case "SET_WEEKEND_DAYS": {
        await setState({ weekendDays: msg.days });
        const newState = await getState();
        if (newState.running || newState.pausedRemainSec != null) {
          await startTimer(newState.intervalMin);
        }
        sendResponse(await getState());
        break;
      }

      case "CLEAR_BADGE": {
        await setState({ badgeCount: 0 });
        chrome.action.setBadgeText({ text: '' });
        sendResponse(await getState());
        break;
      }

      default: sendResponse({});
    }
  })();
  return true;
});

// ===== LIFECYCLE =====

chrome.runtime.onInstalled.addListener(async (details) => {
  const state = await getState();
  if (!state.running) await startTimer(state.intervalMin);
  scheduleSummaryAlarm(state);
  if (details.reason === 'install') {
    const title = await bgT('welcomeTitle');
    const message = await bgT('welcomeMessage', String(state.intervalMin));
    chrome.notifications.create('microbreaks-welcome', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      requireInteraction: false,
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  if (!state.running && state.pausedRemainSec == null) await startTimer(state.intervalMin);
  scheduleSummaryAlarm(state);
  chrome.action.setBadgeText({ text: state.badgeCount > 0 ? String(state.badgeCount) : '' });
});

// Periodically re-check work-hours / weekend gating even without user interaction,
// in case the browser was left open across a work-hours boundary.
chrome.alarms.create('microbreak-gate-check', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'microbreak-gate-check') return;
  const state = await getState();
  const shouldRun = !isWeekendPaused(state) && isWithinWorkHours(state);
  if (shouldRun && !state.running && state.pausedRemainSec != null) {
    await startTimer(state.intervalMin);
  } else if (!shouldRun && state.running) {
    await pauseTimer();
  }
});
