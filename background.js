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
      try {
        const url = chrome.runtime.getURL(`_locales/en/messages.json`);
        const res = await fetch(url);
        bgMessages = await res.json();
        bgLang = 'en';
      } catch (e2) {
        console.log('[MicroBreaks] Failed to load any messages:', e2.message);
        bgMessages = null;
      }
    } else {
      bgMessages = null;
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
  if (!bgMessages) return key; // both fetches failed — return raw key
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
  maleModel: true,
  theme: "sage",
  chimeSound: "marimba",
  darkMode: "system",
  ratingNudgeDone: false,
  onboardingDone: false,
  language: "auto",
  streakDays: 0,
  lastBreakDate: null,
  totalBreaksAllTime: 0,
  soundEnabled: true,
  soundLeadSec: 10,
  workHoursEnabled: false,
  workStart: "09:00",
  workEnd: "17:00",
  weekendDays: [0, 6],
  dailySummaryEnabled: true,
  stretchOrder: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14], // indices into STRETCH_KEYS
  stretchEnabled: [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true],
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
  pendingBreak: null,
  breakLog: [], // [{time: ISO string, stretchIndex: number}] — today only, cleared at midnight
  breakLogDate: null, // date string to detect midnight rollover
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
    const chimeDelayMin = Math.max(1, intervalMin - (leadSec / 60));
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
    const chimeDelayMin = Math.max(1, (remainSec - leadSec) / 60);
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

  let newRemainSec;
  if (state.running) {
    // Only clear alarms once we've confirmed we're in a valid state
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
    const totalSec = state.intervalMin * 60;
    newRemainSec = Math.max(0, totalSec - elapsedSec) + SNOOZE_MIN * 60;
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: newRemainSec / 60 });
    await setState({ startedAt: Date.now(), pausedRemainSec: null });
  } else if (state.pausedRemainSec != null) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    newRemainSec = state.pausedRemainSec + SNOOZE_MIN * 60;
    await setState({ pausedRemainSec: newRemainSec });
    return;
  } else {
    // Neither running nor paused — nothing to snooze, don't touch alarms
    return;
  }

  const leadSec = state.soundEnabled ? (state.soundLeadSec || 0) : 0;
  if (leadSec > 0 && newRemainSec > leadSec) {
    chrome.alarms.create(CHIME_ALARM_NAME, { delayInMinutes: Math.max(1, (newRemainSec - leadSec) / 60) });
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
      console.log('[MicroBreaks] First offscreen create attempt failed:', e.message, '— retrying');
      try {
        await chrome.offscreen.closeDocument();
      } catch (_) { /* nothing to close */ }
      try {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Play a short chime before a scheduled stretch break.',
        });
      } catch (e2) {
        console.log('[MicroBreaks] Offscreen retry also failed:', e2.message);
        // Reset so future calls can try again
        creatingOffscreen = null;
        throw e2;
      }
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
    const state = await getState();
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: 'PLAY_CHIME', sound: state.chimeSound || 'marimba' });
  } catch (e) {
    console.log('[MicroBreaks] Could not play chime:', e && e.message);
  }
}

// ===== NOTIFICATIONS =====

async function fireNotification(message) {
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
      // Fall back to querying active tabs in normal windows only
      chrome.tabs.query({ active: true, windowType: 'normal' }, (tabs) => callback(tabs && tabs[0]));
      return;
    }
    const tab = (win.tabs || []).find(t => t.active) || (win.tabs || [])[0];
    if (tab) {
      callback(tab);
    } else {
      chrome.tabs.query({ active: true, windowType: 'normal' }, (tabs) => callback(tabs && tabs[0]));
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

  // Capture the stretch index for THIS break before advancing to the next
  const currentStretchIndex = stretchIndex;

  // Pick next stretch from the custom order, skipping disabled ones
  const order = state.stretchOrder || [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const enabled = state.stretchEnabled || order.map(() => true);
  const activeOrder = order.filter((_, i) => enabled[i] !== false);
  if (activeOrder.length === 0) {
    stretchIndex = (stretchIndex + 1) % 15;
  } else {
    const currentPos = activeOrder.indexOf(stretchIndex);
    const nextPos = (currentPos + 1) % activeOrder.length;
    stretchIndex = activeOrder[nextPos];
  }

  // Log this break (today only — clear on date rollover, cap at 100 entries)
  let breakLog = state.breakLogDate === today ? (state.breakLog || []) : [];
  breakLog = [...breakLog, { time: new Date().toISOString(), stretchIndex: currentStretchIndex }].slice(-100);

  await setState({
    breaksToday, minsMoved, streakDays, lastBreakDate: today, totalBreaksAllTime,
    stretchIndex, running: false, startedAt: null, pausedRemainSec: null,
    breakLog, breakLogDate: today,
  });

  const stretchKeys = [
    "stretchNeckRolls", "stretchOverheadReach", "stretch2020", "stretchWristCircles", "stretchShoulderRolls",
    "stretchSpinalTwist", "stretchForwardFold", "stretchChestOpener", "stretchSideStretch", "stretchChinTucks",
    "stretchUpperBackSqueeze", "stretchTempleMassage", "stretchAnkleCircles", "stretchFingerSpreads", "stretchHipStretch",
  ];
  // Use currentStretchIndex for notification — it shows what THIS break is, not the next one
  const stretchName = await bgT(stretchKeys[currentStretchIndex]);
  const stretchDesc = await bgT(stretchKeys[currentStretchIndex] + "Desc");
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

        // Check if the Chrome window is actually focused by the user right now.
        // If no window is focused (user is in another app), store a pending break
        // and show the overlay when they come back instead of firing a notification.
        const win = await new Promise(r => chrome.windows.getLastFocused({ populate: false }, w => r(w)));
        const chromeIsFocused = win && win.focused && !restricted;

        if (chromeIsFocused) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"],
            });
            const resolvedLang = (state.language === 'auto' || !state.language) ? detectBgLang() : state.language;
            await chrome.tabs.sendMessage(tab.id, { type: "SHOW_BREAK_OVERLAY", stretchIndex: currentStretchIndex, male: state.maleModel, lang: resolvedLang, theme: state.theme });
            // Overlay shown — clear any previous pending break
            await setState({ pendingBreak: null });
          } catch (e) {
            console.log("[MicroBreaks] Overlay injection failed on:", tab && tab.url, "—", e && e.message);
            // Injection failed on this tab (e.g. CSP) — store pending so user sees it on next navigable tab
            await setState({ pendingBreak: { stretchIndex: currentStretchIndex } });
            if (state.notifEnabled) await fireNotification(notifText);
          }
        } else {
          console.log("[MicroBreaks] Chrome not focused — storing pending break for when user returns");
          await setState({ pendingBreak: { stretchIndex: currentStretchIndex } });
          if (state.notifEnabled) await fireNotification(notifText);
        }
      } catch (outerErr) {
        console.log("[MicroBreaks] Unexpected error in focus-mode flow —", outerErr && outerErr.message);
        await setState({ pendingBreak: { stretchIndex: currentStretchIndex } });
        if (state.notifEnabled) await fireNotification(notifText);
      }
    });
  } else if (state.notifEnabled) {
    await fireNotification(notifText);
  }

  // Send BREAK_FIRED to popup for UI update. In focus mode the overlay/pendingBreak
  // may not be set yet (async callback pending), but popup only uses this for display hints.
  chrome.runtime.sendMessage({ type: "BREAK_FIRED", stretchIndex: currentStretchIndex, totalBreaks: totalBreaksAllTime }).catch(() => {});

  setTimeout(async () => {
    const freshState = await getState();
    if (!freshState.pendingBreak) {
      startTimer(freshState.intervalMin);
    }
  }, 1500);
}

// ===== PENDING BREAK ON FOCUS RETURN =====

async function tryShowPendingOverlay(tab) {
  const state = await getState();
  if (!state.focusMode || !state.pendingBreak) return;

  const { stretchIndex } = state.pendingBreak;
  const restricted = !tab || !tab.id || !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("https://chrome.google.com/webstore") ||
    tab.url.startsWith("https://chromewebstore.google.com");

  if (restricted) return;

  // Clear pendingBreak BEFORE injection to prevent the race condition where
  // both onFocusChanged and onActivated fire simultaneously and both attempt
  // to show the overlay on the same tab.
  await setState({ pendingBreak: null });

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const resolvedLang = (state.language === 'auto' || !state.language) ? detectBgLang() : state.language;
    await chrome.tabs.sendMessage(tab.id, { type: "SHOW_BREAK_OVERLAY", stretchIndex, male: state.maleModel, lang: resolvedLang, theme: state.theme });
    console.log("[MicroBreaks] Showed pending overlay on focus return");
  } catch (e) {
    console.log("[MicroBreaks] Could not show pending overlay on focus return:", e && e.message);
    // Re-store so it tries again on the next tab activation.
    // Small delay avoids race with the post-break timer auto-restart.
    await new Promise(r => setTimeout(r, 200));
    const freshState = await getState();
    // Only re-store if timer hasn't restarted yet (pendingBreak still expected)
    if (!freshState.running) {
      await setState({ pendingBreak: { stretchIndex } });
    }
  }
}

// When Chrome regains focus, check if there's a pending break to show.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const state = await getState();
  if (!state.focusMode || !state.pendingBreak) return;

  // First attempt after 800ms — gives the tab time to render on most machines
  setTimeout(async () => {
    getActiveVisibleTab(async (tab) => {
      if (tab) await tryShowPendingOverlay(tab);
    });
  }, 800);

  // Fallback attempt after 2.5s — catches slow machines and lazy-loaded pages
  setTimeout(async () => {
    const freshState = await getState();
    if (!freshState.pendingBreak) return; // already shown, skip
    getActiveVisibleTab(async (tab) => {
      if (tab) await tryShowPendingOverlay(tab);
    });
  }, 2500);
});

// Also check on tab activation — if user switches tabs while a break is pending
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getState();
  if (!state.focusMode || !state.pendingBreak) return;

  setTimeout(async () => {
    chrome.tabs.get(tabId, async (tab) => {
      if (tab && !chrome.runtime.lastError) await tryShowPendingOverlay(tab);
    });
  }, 400);
});

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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) fireBreak();
  if (alarm.name === CHIME_ALARM_NAME) playChime();
  if (alarm.name === SUMMARY_ALARM_NAME) fireDailySummary();
  if (alarm.name === 'microbreak-gate-check') {
    const state = await getState();
    const shouldRun = !isWeekendPaused(state) && isWithinWorkHours(state);
    if (shouldRun && !state.running && !state.pendingBreak) {
      // Only auto-start if fully stopped (post-break), not if user manually paused
      // A manual pause has pausedRemainSec set — we respect that choice.
      if (state.pausedRemainSec === null) {
        await startTimer(state.intervalMin);
      }
    } else if (!shouldRun && state.running) {
      await pauseTimer();
    }
  }
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
      case "START": {
        await setState({ pendingBreak: null });
        const startState = await getState();
        await startTimer(msg.intervalMin ?? startState.intervalMin);
        sendResponse(await getState());
        break;
      }
      case "PAUSE":          await pauseTimer(); sendResponse(await getState()); break;
      case "RESUME":         await resumeTimer(); sendResponse(await getState()); break;
      case "STOP":           await stopTimer(); sendResponse(await getState()); break;
      case "SNOOZE": {
        // Only clear pendingBreak if the overlay was already shown (user snoozing from it).
        // If pendingBreak is set and overlay hasn't shown yet, leave it so it shows on return.
        const snoozeState = await getState();
        if (!snoozeState.pendingBreak) {
          await setState({ pendingBreak: null });
        }
        await snoozeTimer();
        sendResponse(await getState());
        break;
      }
      case "SET_INTERVAL":   await setState({ intervalMin: msg.intervalMin }); await startTimer(msg.intervalMin); sendResponse(await getState()); break;
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
        sendResponse(newState);
        break;
      }

      case "SET_WORK_HOURS": {
        await setState({ workHoursEnabled: msg.enabled, workStart: msg.start, workEnd: msg.end });
        const whState = await getState();
        scheduleSummaryAlarm(whState);
        if (whState.running || whState.pausedRemainSec != null) {
          await startTimer(whState.intervalMin);
        }
        sendResponse(whState);
        break;
      }

      case "SET_WEEKEND_DAYS": {
        await setState({ weekendDays: msg.days });
        const wdState = await getState();
        if (wdState.running || wdState.pausedRemainSec != null) {
          await startTimer(wdState.intervalMin);
        }
        sendResponse(wdState);
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

// ===== KEYBOARD SHORTCUTS =====

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-break') {
    await fireBreak();
  }
  if (command === 'snooze-break') {
    await snoozeTimer();
  }
});

// ===== LIFECYCLE =====

chrome.runtime.onInstalled.addListener(async (details) => {
  const state = await getState();
  if (!state.running) await startTimer(state.intervalMin);
  scheduleSummaryAlarm(state);
  if (details.reason === 'install') {
    // Open the onboarding page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
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
// Guard with getAll() so we don't reset the countdown on every service worker wake.
chrome.alarms.getAll(alarms => {
  if (!alarms.find(a => a.name === 'microbreak-gate-check')) {
    chrome.alarms.create('microbreak-gate-check', { periodInMinutes: 5 });
  }
});
