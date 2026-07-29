'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BACKGROUND_PATH = path.join(__dirname, '..', '..', 'background.js');

// Kept intentionally short — just what this first-pass test suite needs, not
// an exhaustive dump of every top-level identifier in background.js. If a
// listed name is ever renamed/removed in background.js, the trailer's `return`
// throws a ReferenceError immediately at load time — loud and easy to diagnose,
// not a silent gap.
const EXPOSED_NAMES = [
  'getState', 'setState',
  'isWithinWorkHours', 'isWeekendPaused',
  'startTimer', 'pauseTimer', 'resumeTimer', 'snoozeTimer',
  'fireBreak',
  'reevaluateGate', 'reconfirmNotIdle',
  'ALARM_NAME', 'CHIME_ALARM_NAME',
  'IDLE_DETECTION_INTERVAL_SEC', 'POST_BREAK_IDLE_GRACE_MS',
  'SYNC_DEFAULTS', 'LOCAL_DEFAULTS',
];

let compiledFn = null;

function getCompiledBackground() {
  if (compiledFn) return compiledFn;
  const source = fs.readFileSync(BACKGROUND_PATH, 'utf8');
  const trailer = `\n;\nreturn { ${EXPOSED_NAMES.join(', ')} };\n`;
  // No parsingContext option -> compiles against the CURRENT context (this
  // process's real globalThis), not a vm.createContext sandbox. That's the
  // point: assert.deepStrictEqual/instanceof work normally on anything the
  // returned API produces, and node:test's t.mock.timers (which patches
  // globalThis.setTimeout/Date) transparently affects code running inside
  // the compiled function too, with no manual wiring.
  compiledFn = vm.compileFunction(source + trailer, ['chrome', 'fetch'], {
    filename: BACKGROUND_PATH,
  });
  return compiledFn;
}

// Loads a fresh instance of background.js's top-level scope wired to the given
// mock chrome + fetch. Every call gives fresh closures over background.js's
// top-level `let`/`const` state (bgMessages, bgLang, breakInFlight,
// creatingOffscreen, etc.) with no cross-test leakage, since it's a fresh
// invocation of the compiled function rather than re-running raw top-level
// script text (which would throw "already declared" against a persistent
// global scope).
//
// background.js registers every chrome.*.onX listener AND fires its own
// chrome.alarms.getAll(...) side effect (creating the periodic gate-check
// alarm) synchronously during the call. mock-chrome's getAll resolves via
// queueMicrotask to mirror real Chrome's async callback timing, so this
// flushes a couple of microtask turns before returning to make sure that
// side effect has actually completed.
async function loadBackground(chrome, fetchFn) {
  const fn = getCompiledBackground();
  const api = fn(chrome, fetchFn);
  await Promise.resolve();
  await Promise.resolve();
  return api;
}

module.exports = { loadBackground };
