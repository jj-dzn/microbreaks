'use strict';

// Mock of the chrome.* surface background.js actually calls, matching each
// call site's exact calling convention (promise-returning vs callback vs sync
// fire-and-forget) rather than a generic one-size-fits-all stub. Deliberately
// covers ONLY the confirmed-used surface — no permissive catch-alls — so a
// new chrome.* call added to background.js later fails loudly here instead of
// silently becoming a no-op.

function createListenerSet() {
  const listeners = [];
  return {
    addListener(fn) { listeners.push(fn); },
    removeListener(fn) {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    _listeners: listeners,
    // Generic trigger: calls every listener and awaits anything they return.
    // NOT correct for onMessage (response comes via sendResponse, not a
    // return value) or for non-async listeners that fire-and-forget internal
    // promise chains (e.g. notifications.onButtonClicked) — those need an
    // explicit extra microtask flush from the test after calling this.
    async trigger(...args) {
      await Promise.all(listeners.map(fn => fn(...args)));
    },
  };
}

function createMockChrome({ now = () => Date.now() } = {}) {
  const syncStore = {};
  const localStore = {};
  const alarmsStore = new Map(); // name -> { delayInMinutes, periodInMinutes, createdAt }
  const notificationsCreated = []; // { id, opts }
  const badge = { text: '', color: null };
  const tabsCreated = [];
  const sentMessages = []; // messages passed to chrome.runtime.sendMessage (fire-and-forget from background's POV)

  let idleState = 'active'; // what chrome.idle.queryState resolves with until a test changes it
  let idleDetectionIntervalSec = null;
  let lastErrorValue = undefined;

  const onMessageListeners = [];

  const chrome = {
    runtime: {
      getURL: (path) => `chrome-extension://mock-extension-id/${path}`,
      get lastError() { return lastErrorValue; },
      sendMessage: (msg) => {
        sentMessages.push(msg);
        // Real chrome.runtime.sendMessage rejects if there's no receiving end;
        // background.js always chains .catch(() => {}) on these calls, so
        // resolving is fine and matches the common "popup isn't open" case.
        return Promise.resolve(undefined);
      },
      onMessage: {
        addListener(fn) { onMessageListeners.push(fn); },
        _listeners: onMessageListeners,
      },
      onInstalled: createListenerSet(),
      onStartup: createListenerSet(),
    },

    storage: {
      sync: {
        async get(defaults) {
          const result = {};
          for (const [k, def] of Object.entries(defaults)) {
            result[k] = Object.prototype.hasOwnProperty.call(syncStore, k) ? syncStore[k] : def;
          }
          return result;
        },
        async set(obj) {
          Object.assign(syncStore, obj);
        },
      },
      local: {
        async get(defaults) {
          const result = {};
          for (const [k, def] of Object.entries(defaults)) {
            result[k] = Object.prototype.hasOwnProperty.call(localStore, k) ? localStore[k] : def;
          }
          return result;
        },
        async set(obj) {
          Object.assign(localStore, obj);
        },
      },
    },

    alarms: {
      async clear(name) {
        return alarmsStore.delete(name);
      },
      create(name, opts) {
        alarmsStore.set(name, { ...opts, createdAt: now() });
      },
      getAll(callback) {
        // Real chrome.alarms.getAll is genuinely async — queueMicrotask here
        // mirrors that instead of resolving purely synchronously, so tests
        // relying on load-background.js's post-load flush see realistic timing.
        queueMicrotask(() => {
          callback(Array.from(alarmsStore, ([name, opts]) => ({ name, ...opts })));
        });
      },
      onAlarm: createListenerSet(),
    },

    offscreen: {
      _hasDocument: false,
      async hasDocument() { return this._hasDocument; },
      async createDocument() { this._hasDocument = true; },
      async closeDocument() { this._hasDocument = false; },
    },

    notifications: {
      create(id, opts) { notificationsCreated.push({ id, opts }); },
      clear(id) {
        const i = notificationsCreated.findIndex(n => n.id === id);
        if (i >= 0) notificationsCreated.splice(i, 1);
      },
      onButtonClicked: createListenerSet(),
    },

    windows: {
      WINDOW_ID_NONE: -1,
      _lastFocused: null, // test sets this to a fake window object ({focused, tabs} or null)
      getLastFocused(_opts, cb) { cb(chrome.windows._lastFocused); },
      onFocusChanged: createListenerSet(),
    },

    tabs: {
      _queryResult: [], // test sets this to control chrome.tabs.query's callback result
      _getResult: null, // test sets this to control chrome.tabs.get's callback result
      query(_opts, cb) { cb(chrome.tabs._queryResult); },
      get(_tabId, cb) { cb(chrome.tabs._getResult); },
      async sendMessage(_tabId, _msg) { return undefined; },
      create(opts) { tabsCreated.push(opts); },
      onActivated: createListenerSet(),
    },

    scripting: {
      async executeScript() { return [{ result: undefined }]; },
    },

    idle: {
      setDetectionInterval(sec) { idleDetectionIntervalSec = sec; },
      queryState(_detectionIntervalSec, cb) { cb(idleState); },
      onStateChanged: createListenerSet(),
      // Test helpers, not part of the real chrome.idle surface:
      _setState(state) { idleState = state; },
      get _detectionIntervalSec() { return idleDetectionIntervalSec; },
    },

    action: {
      setBadgeText(opts) { badge.text = opts.text; },
      setBadgeBackgroundColor(opts) { badge.color = opts.color; },
    },

    commands: {
      onCommand: createListenerSet(),
    },

    i18n: {
      _uiLanguage: 'en',
      getUILanguage() { return chrome.i18n._uiLanguage; },
    },
  };

  return {
    chrome,
    // Test-only introspection/control surface, kept separate from the chrome
    // mock itself so it's obvious what's "real API shape" vs "test harness".
    _internals: {
      syncStore,
      localStore,
      alarmsStore,
      notificationsCreated,
      badge,
      tabsCreated,
      sentMessages,
      setLastError(value) { lastErrorValue = value; },
      sendMessageToBackground(msg) {
        // background.js's single onMessage listener always calls sendResponse
        // async and returns true (keep channel open) — there's only ever one
        // listener registered in this codebase, so driving them all and
        // resolving on the first sendResponse call is sufficient here.
        return new Promise((resolve) => {
          for (const fn of onMessageListeners) fn(msg, {}, resolve);
        });
      },
    },
  };
}

module.exports = { createMockChrome };
