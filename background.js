const ALARM_NAME = "microbreak";
const CHIME_ALARM_NAME = "microbreak-chime";
const SUMMARY_ALARM_NAME = "microbreak-summary";

let bgMessages = null;
let bgLang = null;

// Guards against a break firing twice in quick succession (e.g. a rapid double-press
// of the Alt+Shift+B shortcut while the previous break's overlay/notification is
// still up). Cleared once the break's post-fire settling window has passed.
let breakInFlight = false;

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
  focusMode: true,
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
  snoozeMin: 5,
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
  gatePaused: false, // true when timer was paused by work hours/weekend gate, not by user
  gateOverride: false, // true when the user force-started the timer while gate-blocked
                        // (e.g. "Run anyway") — tells the periodic gate-check to leave
                        // it running instead of silently re-pausing it a few minutes later
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

async function startTimer(intervalMin, force = false) {
  const state = await getState();
  if (intervalMin == null) intervalMin = state.intervalMin || 20;

  const gateBlocked = isWeekendPaused(state) || !isWithinWorkHours(state);

  if (!force && gateBlocked) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    await setState({ running: false, startedAt: null, pausedRemainSec: intervalMin * 60, intervalMin, gatePaused: true });
    return;
  }

  const startedAt = Date.now();
  // Clear existing alarms BEFORE writing running:true — prevents a race where
  // the old alarm fires between setState and clear if the service worker restarts.
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(CHIME_ALARM_NAME);
  // If this start bypassed a blocked gate (force=true while gateBlocked), remember it —
  // otherwise the periodic gate-check alarm would silently re-pause this a few minutes
  // later, since from its point of view an active timer outside the gate looks wrong.
  await setState({ running: true, startedAt, pausedRemainSec: null, intervalMin, gateOverride: force && gateBlocked });
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
  await setState({ running: false, pausedRemainSec: remainSec, startedAt: null, gatePaused: false, gateOverride: false });
}

async function resumeTimer() {
  const state = await getState();

  // If outside work hours / weekend, don't resume — leave paused
  if (isWeekendPaused(state) || !isWithinWorkHours(state)) {
    return;
  }

  const remainSec = state.pausedRemainSec ?? state.intervalMin * 60;
  // Chrome enforces a minimum 1-minute delay for alarms — clamp to avoid silent rounding
  const delayInMinutes = Math.max(1, remainSec / 60);
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
  await setState({ running: false, startedAt: null, pausedRemainSec: null, gateOverride: false });
}

async function snoozeTimer() {
  const state = await getState();
  const SNOOZE_MIN = state.snoozeMin || 5;

  // Snoozing is an explicit user action that supersedes any break overlay still
  // waiting to be shown — without this, a break snoozed via the notification button
  // or the Alt+Shift+S shortcut would still pop up the full-screen overlay the next
  // time the user focuses Chrome.
  if (state.pendingBreak) await setState({ pendingBreak: null });

  let newRemainSec;
  if (state.running) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
    const totalSec = state.intervalMin * 60;
    newRemainSec = Math.max(0, totalSec - elapsedSec) + SNOOZE_MIN * 60;
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: newRemainSec / 60 });
    await setState({ running: true, startedAt: Date.now(), pausedRemainSec: null });
  } else if (state.pausedRemainSec != null) {
    // Timer is paused — manually, or by the weekend/work-hours gate. Snoozing only
    // makes sense for an active or about-to-fire break, so do nothing here rather
    // than silently resuming the countdown the user (or the gate) paused.
    return;
  } else {
    // Timer fully stopped (e.g. within 1500ms post-break window before auto-restart).
    // Still honour the snooze — schedule a 5-minute alarm from now.
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    newRemainSec = SNOOZE_MIN * 60;
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: SNOOZE_MIN });
    await setState({ running: true, startedAt: Date.now(), pausedRemainSec: null });
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
    // The chime fires a few seconds before the break itself. If the gate would
    // block the break (and there's no active override), don't play the chime for
    // a break that's about to be silently skipped.
    if ((isWeekendPaused(state) || !isWithinWorkHours(state)) && !state.gateOverride) {
      return;
    }
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

async function fireBreak(force = false) {
  const state = await getState();

  if (!state.onboardingDone) return;
  if (breakInFlight) return;

  if (!force && (isWeekendPaused(state) || !isWithinWorkHours(state))) {
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    return;
  }

  breakInFlight = true;

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

        const win = await new Promise(r => chrome.windows.getLastFocused({ populate: false }, w => r(w)));
        const chromeIsFocused = force || (win && win.focused && !restricted);

        if (chromeIsFocused) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"],
            });
            const resolvedLang = (state.language === 'auto' || !state.language) ? detectBgLang() : state.language;
            await chrome.tabs.sendMessage(tab.id, { type: "SHOW_BREAK_OVERLAY", stretchIndex: currentStretchIndex, male: state.maleModel, lang: resolvedLang, theme: state.theme });
            await setState({ pendingBreak: null });
          } catch (e) {
            console.log("[MicroBreaks] Overlay injection failed:", e && e.message);
            await setState({ pendingBreak: { stretchIndex: currentStretchIndex } });
            // Strict mode promised a full-screen overlay — if it genuinely couldn't be
            // shown, fall back to a notification regardless of notifEnabled so the break
            // is never completely invisible to the user.
            await fireNotification(notifText);
          }
        } else {
          await setState({ pendingBreak: { stretchIndex: currentStretchIndex } });
          await fireNotification(notifText);
        }
      } catch (outerErr) {
        console.log("[MicroBreaks] Unexpected error in focus-mode flow —", outerErr && outerErr.message);
        await setState({ pendingBreak: { stretchIndex: currentStretchIndex } });
        await fireNotification(notifText);
      }

      // Send BREAK_FIRED after overlay attempt so popup reflects correct state
      chrome.runtime.sendMessage({ type: "BREAK_FIRED", stretchIndex: currentStretchIndex, totalBreaks: totalBreaksAllTime }).catch(() => {});

      // Auto-restart AFTER overlay is shown — not before
      setTimeout(async () => {
        const freshState = await getState();
        if (!freshState.pendingBreak) {
          startTimer(freshState.intervalMin, true);
        }
        breakInFlight = false;
      }, 1500);
    });

  } else {
    // Notification mode
    if (state.notifEnabled || force) await fireNotification(notifText);

    chrome.runtime.sendMessage({ type: "BREAK_FIRED", stretchIndex: currentStretchIndex, totalBreaks: totalBreaksAllTime }).catch(() => {});

    setTimeout(async () => {
      const freshState = await getState();
      if (!freshState.pendingBreak) {
        startTimer(freshState.intervalMin, true);
      }
      breakInFlight = false;
    }, 1500);
  }
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

// ===== GATE RE-EVALUATION =====
// Shared by the periodic gate-check alarm and by anything that changes the
// work-hours/weekend settings, so a change to those settings takes effect
// immediately instead of waiting for the next 5-minute alarm tick.
async function reevaluateGate() {
  const state = await getState();
  const shouldRun = !isWeekendPaused(state) && isWithinWorkHours(state);
  if (shouldRun && !state.running && !state.pendingBreak) {
    if (state.gatePaused) {
      // Was paused by the work hours gate — auto-resume now that hours started
      await setState({ gatePaused: false });
      await startTimer(state.intervalMin, true);
    } else if (state.pausedRemainSec === null) {
      // Fully stopped (post-break) — start fresh
      await startTimer(state.intervalMin);
    }
    // If manually paused (gatePaused:false, pausedRemainSec set) — respect user's choice
  } else if (!shouldRun && state.running && !state.gateOverride) {
    // Gate-pausing (as opposed to a manual pause) always resumes with a fresh full
    // interval — never the actual leftover remainder — so show that as what's
    // "paused" too. pauseTimer() stores the real elapsed-adjusted remainder, which
    // would be misleading here: e.g. it could show "58:30 left" for hours while
    // gated, when what actually happens on resume is a fresh 60:00.
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(CHIME_ALARM_NAME);
    await setState({
      running: false, startedAt: null, gatePaused: true, gateOverride: false,
      pausedRemainSec: state.intervalMin * 60,
    });
  } else if (shouldRun && state.running && state.gateOverride) {
    // Back within the gate naturally — the override is no longer needed.
    await setState({ gateOverride: false });
  }
}

// ===== ALARM ROUTER =====

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) fireBreak();
  if (alarm.name === CHIME_ALARM_NAME) playChime();
  if (alarm.name === SUMMARY_ALARM_NAME) fireDailySummary();
  if (alarm.name === 'microbreak-gate-check') await reevaluateGate();
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIndex) => {
  if (notifId.startsWith("microbreak-")) {
    if (btnIndex === 0) snoozeTimer();
    if (btnIndex === 1) {
      // Clear pendingBreak first so a pending overlay doesn't show after restart.
      // force=true to match every other explicit start action (Start button, Run
      // anyway) — clicking "Restart" is just as deliberate and shouldn't silently
      // no-op if it happens to be outside work hours.
      setState({ pendingBreak: null }).then(() => getState()).then(s => startTimer(s.intervalMin, true));
    }
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
        await startTimer(msg.intervalMin ?? startState.intervalMin, true); // force=true: user explicitly started
        sendResponse(await getState());
        break;
      }
      case "PAUSE":          await pauseTimer(); sendResponse(await getState()); break;
      case "RESUME":         await resumeTimer(); sendResponse(await getState()); break;
      case "STOP":           await stopTimer(); sendResponse(await getState()); break;
      case "SNOOZE": {
        // snoozeTimer() clears pendingBreak itself
        await snoozeTimer();
        // Always read fresh state after snoozeTimer — it may have returned early
        sendResponse(await getState());
        break;
      }
      case "SET_INTERVAL": {
        // Preserve an active gate override across the interval change — otherwise
        // picking a new interval while running via "Run anyway" would immediately
        // re-trigger the gate and pause it.
        const prevState = await getState();
        await setState({ intervalMin: msg.intervalMin });
        await startTimer(msg.intervalMin, prevState.gateOverride === true);
        sendResponse(await getState());
        break;
      }
      case "SET_FOCUS":      await setState({ focusMode: msg.value }); sendResponse(await getState()); break;

      case "SET_STRETCH_ORDER": {
        // stretchEnabled[i] describes stretchOrder[i] — the two arrays must always
        // move together. Setting them in one call (instead of two sequential
        // SET_PREF messages) avoids a narrow window where a break could fire and
        // read a mismatched pair mid-drag-reorder.
        await setState({ stretchOrder: msg.order, stretchEnabled: msg.enabled });
        sendResponse(await getState());
        break;
      }

      case "SET_PREF": {
        await setState({ [msg.key]: msg.value });
        if (msg.key === 'language') { bgMessages = null; bgLang = null; }
        const newState = await getState();
        if (['workHoursEnabled', 'workStart', 'workEnd', 'dailySummaryEnabled'].includes(msg.key)) {
          scheduleSummaryAlarm(newState);
        }
        if (['workHoursEnabled', 'workStart', 'workEnd', 'weekendDays'].includes(msg.key)) {
          if (newState.running) {
            await startTimer(newState.intervalMin);
          }
          // Re-check immediately in case this change should resume or pause
          // right now — otherwise a paused user is stuck for up to 5 minutes
          // waiting on the periodic gate-check alarm.
          await reevaluateGate();
        }
        sendResponse(await getState());
        break;
      }

      case "SET_WORK_HOURS": {
        // Reject an identical start/end time — it would make isWithinWorkHours()
        // always false, silently and permanently gating the timer with no obvious
        // way to un-stick it. Keep whatever the previous (valid) times were instead.
        const prevWhState = await getState();
        const validRange = msg.start !== msg.end;
        await setState({
          workHoursEnabled: msg.enabled,
          workStart: validRange ? msg.start : prevWhState.workStart,
          workEnd: validRange ? msg.end : prevWhState.workEnd,
        });
        const whState = await getState();
        scheduleSummaryAlarm(whState);
        // Only restart if running — don't wipe a manual pause
        if (whState.running) await startTimer(whState.intervalMin);
        // Re-check immediately — if this change means the gate should no longer
        // block (or should now block), don't wait up to 5 min for the alarm.
        await reevaluateGate();
        sendResponse(await getState());
        break;
      }

      case "SET_WEEKEND_DAYS": {
        await setState({ weekendDays: msg.days });
        const wdState = await getState();
        // Only restart if running — don't wipe a manual pause
        if (wdState.running) await startTimer(wdState.intervalMin);
        await reevaluateGate();
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

// ===== KEYBOARD SHORTCUTS =====

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-break') {
    await fireBreak(true);
  }
  if (command === 'snooze-break') {
    await snoozeTimer();
  }
});

// ===== LIFECYCLE =====

chrome.runtime.onInstalled.addListener(async (details) => {
  const state = await getState();
  scheduleSummaryAlarm(state);

  if (!state.onboardingDone) {
    // Fresh install (or reinstall) — open onboarding regardless of reason
    // details.reason is 'update' in dev mode even on first load, so we check
    // the onboardingDone flag instead which is reliably false on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
    await startTimer(state.intervalMin);
  } else {
    // Existing install being updated — respect manual pause state
    if (!state.running && state.pausedRemainSec === null) {
      await startTimer(state.intervalMin);
    }
    // Safety net, same reasoning as onStartup — self-corrects a stuck gatePaused
    // state without ever overriding a deliberate manual pause.
    await reevaluateGate();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  const now = Date.now();

  // If there's a pending break from a previous session, discard it —
  // the user closed the browser so the break is no longer relevant
  if (state.pendingBreak) {
    await setState({ pendingBreak: null });
  }

  // If the timer was running when the browser closed, check how long ago it started.
  // If more than 2x the interval has passed, the session is stale — start fresh.
  // If less, restart the timer for the remaining time.
  if (state.running && state.startedAt) {
    const elapsedSec = Math.floor((now - state.startedAt) / 1000);
    const totalSec = state.intervalMin * 60;
    const remainSec = totalSec - elapsedSec;

    if (remainSec <= 0) {
      // Timer would have already fired — start a fresh interval
      await startTimer(state.intervalMin);
    } else {
      // Resume with the remaining time — but only if we're within work hours /
      // not on a paused weekend day. Otherwise mark gate-paused so the popup
      // shows the "paused" banner and Resume isn't left silently doing nothing
      // (resumeTimer() itself no-ops when gated).
      await setState({ pausedRemainSec: remainSec, running: false, startedAt: null });
      if (!isWeekendPaused(state) && isWithinWorkHours(state)) {
        await resumeTimer();
      } else {
        await setState({ gatePaused: true });
      }
    }
  } else if (!state.running && state.pausedRemainSec == null && !state.gatePaused) {
    // Fully stopped and not gate-paused — start fresh
    await startTimer(state.intervalMin);
  } else if (state.gatePaused) {
    // Was gate-paused when browser closed — re-evaluate work hours now
    const shouldRun = !isWeekendPaused(state) && isWithinWorkHours(state);
    if (shouldRun) {
      await setState({ gatePaused: false });
      await startTimer(state.intervalMin, true);
    }
    // Otherwise leave gate-paused — gate-check will resume when hours start
  }
  // If manually paused (running:false, pausedRemainSec set, gatePaused:false) — leave as-is

  scheduleSummaryAlarm(state);
  chrome.action.setBadgeText({ text: state.badgeCount > 0 ? String(state.badgeCount) : '' });

  // Final safety net: independently re-derive from a fresh read whether the timer
  // should be running right now, rather than trusting only the single state snapshot
  // read at the top of this function. reevaluateGate() is idempotent and always
  // respects an actual manual pause, so this can only self-correct a stuck state
  // (e.g. gatePaused should have triggered a resume above but didn't for some
  // reason) — it never overrides a deliberate pause.
  await reevaluateGate();
});

// Periodically re-check work-hours / weekend gating even without user interaction,
// in case the browser was left open across a work-hours boundary.
// Guard with getAll() so we don't reset the countdown on every service worker wake.
chrome.alarms.getAll(alarms => {
  if (!alarms.find(a => a.name === 'microbreak-gate-check')) {
    chrome.alarms.create('microbreak-gate-check', { periodInMinutes: 5 });
  }
});
