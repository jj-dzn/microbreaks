const ALARM_NAME = "microbreak";

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

const DEFAULTS = {
  intervalMin: 20,
  running: false,
  focusMode: false,
  notifEnabled: true,
  animEnabled: true,
  startedAt: null,
  pausedRemainSec: null,
  breaksToday: 0,
  minsMoved: 0,
  streakDays: 3,
  lastBreakDate: null,
  stretchIndex: 0,
  maleModel: false,
  language: "auto",
};

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
}

async function startTimer(intervalMin) {
  if (intervalMin == null) {
    const current = await getState();
    intervalMin = current.intervalMin || 20;
  }
  const startedAt = Date.now();
  await setState({ running: true, startedAt, pausedRemainSec: null, intervalMin });
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: intervalMin });
}

async function pauseTimer() {
  const state = await getState();
  if (!state.running || !state.startedAt) return;
  const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
  const totalSec = state.intervalMin * 60;
  const remainSec = Math.max(0, totalSec - elapsedSec);
  await chrome.alarms.clear(ALARM_NAME);
  await setState({ running: false, pausedRemainSec: remainSec, startedAt: null });
}

async function resumeTimer() {
  const state = await getState();
  const remainSec = state.pausedRemainSec ?? state.intervalMin * 60;
  const delayInMinutes = remainSec / 60;
  const startedAt = Date.now();
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes });
  await setState({ running: true, startedAt, pausedRemainSec: null });
}

async function stopTimer() {
  await chrome.alarms.clear(ALARM_NAME);
  await setState({ running: false, startedAt: null, pausedRemainSec: null });
}

async function snoozeTimer() {
  const state = await getState();
  const SNOOZE_MIN = 5;
  await chrome.alarms.clear(ALARM_NAME);
  if (state.running) {
    const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
    const totalSec = state.intervalMin * 60;
    const remainSec = Math.max(0, totalSec - elapsedSec);
    const newRemainMin = (remainSec + SNOOZE_MIN * 60) / 60;
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: newRemainMin });
    await setState({ startedAt: Date.now(), pausedRemainSec: null });
  } else if (state.pausedRemainSec != null) {
    const newRemain = state.pausedRemainSec + SNOOZE_MIN * 60;
    await setState({ pausedRemainSec: newRemain });
  }
}

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

async function fireBreak() {
  const state = await getState();

  const today = new Date().toDateString();
  let { breaksToday, minsMoved, streakDays, lastBreakDate, stretchIndex } = state;

  if (lastBreakDate !== today) {
    breaksToday = 0;
    minsMoved = 0;
    if (lastBreakDate === yesterday()) {
      streakDays += 1;
    } else if (lastBreakDate !== today) {
      streakDays = 1;
    }
  }

  breaksToday += 1;
  minsMoved += 1;
  stretchIndex = (stretchIndex + 1) % 15;

  await setState({ breaksToday, minsMoved, streakDays, lastBreakDate: today, stretchIndex, running: false, startedAt: null, pausedRemainSec: null });

  const stretchKeys = [
    "stretchNeckRolls", "stretchOverheadReach", "stretch2020", "stretchWristCircles", "stretchShoulderRolls",
    "stretchSpinalTwist", "stretchForwardFold", "stretchChestOpener", "stretchSideStretch", "stretchChinTucks",
    "stretchUpperBackSqueeze", "stretchTempleMassage", "stretchAnkleCircles", "stretchFingerSpreads", "stretchHipStretch",
  ];
  const stretchName = await bgT(stretchKeys[stretchIndex]);
  const stretchDesc = await bgT(stretchKeys[stretchIndex] + "Desc");
  const notifText = `${stretchName} — ${stretchDesc}`;

  if (state.focusMode) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const restricted = !tab || !tab.id ||
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("https://chrome.google.com/webstore");

      if (!restricted) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
          const resolvedLang = (state.language === 'auto' || !state.language) ? detectBgLang() : state.language;
          await chrome.tabs.sendMessage(tab.id, { type: "SHOW_BREAK_OVERLAY", stretchIndex, male: state.maleModel, lang: resolvedLang });
        } catch (e) {
          console.log("[MicroBreaks] Overlay injection failed on:", tab.url, "—", e.message);
          await fireNotification(notifText, stretchIndex);
        }
      } else {
        await fireNotification(notifText, stretchIndex);
      }
    });
  } else if (state.notifEnabled) {
    await fireNotification(notifText, stretchIndex);
  }

  chrome.runtime.sendMessage({ type: "BREAK_FIRED", stretchIndex }).catch(() => {});
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toDateString();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) fireBreak();
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIndex) => {
  if (notifId.startsWith("microbreak-")) {
    if (btnIndex === 0) snoozeTimer();
    if (btnIndex === 1) getState().then(s => startTimer(s.intervalMin));
    chrome.notifications.clear(notifId);
  }
});

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
      case "SET_PREF":
        await setState({ [msg.key]: msg.value });
        if (msg.key === 'language') { bgMessages = null; bgLang = null; }
        sendResponse(await getState());
        break;
      default:               sendResponse({});
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  const state = await getState();
  if (!state.running) await startTimer(state.intervalMin);
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
});
