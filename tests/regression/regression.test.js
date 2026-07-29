'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockChrome } = require('../helpers/mock-chrome');
const { createMockFetch } = require('../helpers/mock-fetch');
const { loadBackground } = require('../helpers/load-background');
const { tickAndFlush, localTime } = require('../helpers/time');

const WEDNESDAY_10AM = localTime(2024, 0, 10, 10, 0);
const WEDNESDAY_8PM = localTime(2024, 0, 10, 20, 0); // outside a 9-17 work day

async function setup(t, { now = WEDNESDAY_10AM } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  const { chrome, _internals } = createMockChrome();
  const fetchFn = createMockFetch();
  const api = await loadBackground(chrome, fetchFn);
  return { chrome, internals: _internals, api };
}

// Regression: commit 840bca6 (1.6.21) — reevaluateGate()'s gate-pause branch used
// to call pauseTimer(), which stores the real elapsed-adjusted remainder. Since
// gate-lift always resumes with a fresh full interval, that made the "paused"
// display misleading (e.g. "58:30 left" for hours, when resume actually gives
// a fresh 60:00). Fixed to snapshot the full interval instead.
test('regression 840bca6: gate-pausing shows the full interval, never a stale elapsed remainder', async (t) => {
  const { api } = await setup(t);
  await api.setState({ workHoursEnabled: true, workStart: '09:00', workEnd: '17:00' });
  await api.startTimer(60);

  await tickAndFlush(t, 90 * 1000); // only 90 seconds in when the gate closes
  t.mock.timers.setTime(localTime(2024, 0, 10, 17, 1));
  await api.reevaluateGate();

  const state = await api.getState();
  assert.equal(state.gatePaused, true);
  assert.equal(state.pausedRemainSec, 60 * 60, 'must show the full interval, not ~58:30 of actual elapsed time');
});

// Regression: commit 9995682 (1.6.22, bug #3) — a manual Resume click and the
// idle→active event it likely triggers (moving the mouse to click IS the input
// that ends an idle period) could both end up calling resumeTimer() against
// interleaved state, with the loser recomputing remainSec from an
// already-cleared pausedRemainSec and resetting the countdown to a full
// interval. Fixed with an idempotency guard.
test('regression 9995682 (#3): a concurrent Resume + idle-active event never resets the countdown', async (t) => {
  const { chrome, internals, api } = await setup(t);
  await api.startTimer(20);
  await tickAndFlush(t, 5 * 60 * 1000); // 5 minutes in, 15 remain

  chrome.idle._setState('idle');
  await api.reconfirmNotIdle(true);
  assert.equal((await api.getState()).idlePaused, true);
  assert.equal((await api.getState()).pausedRemainSec, 15 * 60);

  chrome.idle._setState('active');
  await Promise.all([
    chrome.idle.onStateChanged.trigger('active'),
    internals.sendMessageToBackground({ type: 'RESUME' }),
  ]);

  const state = await api.getState();
  assert.equal(state.running, true);
  const alarms = await new Promise((resolve) => chrome.alarms.getAll(resolve));
  const main = alarms.find((a) => a.name === api.ALARM_NAME);
  assert.equal(main.delayInMinutes, 15, 'the race loser must not overwrite the alarm with a fresh full interval');
});

// Regression: commit 9995682 (1.6.22, bug #1) — idle-pause used to unconditionally
// discard an active work-hours gate override (pauseTimer() clears gateOverride as
// part of its normal job). Stepping away for a bit while running via "Run anyway"
// would silently lose the override, landing back on the gate-paused banner
// instead of resuming. Fixed to preserve and honor it.
test('regression 9995682 (#1): an active gate override survives idle-pause and is honored on resume', async (t) => {
  const { chrome, api } = await setup(t, { now: WEDNESDAY_8PM });
  await api.setState({ workHoursEnabled: true, workStart: '09:00', workEnd: '17:00' });
  await api.startTimer(20, true); // force through the gate
  assert.equal((await api.getState()).gateOverride, true);

  chrome.idle._setState('idle');
  await api.reconfirmNotIdle(true);
  assert.equal((await api.getState()).idlePaused, true);
  assert.equal((await api.getState()).gateOverride, true, 'override must survive the idle-pause itself');

  // Still outside hours on return — drive the REAL idle.onStateChanged listener,
  // since the bug lived specifically in that listener's branching logic.
  chrome.idle._setState('active');
  await chrome.idle.onStateChanged.trigger('active');

  const state = await api.getState();
  assert.equal(state.running, true, 'should resume via the override rather than falling back to gatePaused');
  assert.equal(state.gatePaused, false);
});

// Regression: commit 1a99ebb (1.6.23) — startTimer()'s gate-blocked branch set
// gatePaused:true without clearing idlePaused, reachable via SET_INTERVAL (which
// always calls startTimer regardless of running state). A stale idlePaused:true
// left over from an earlier idle-pause would combine with the newly-set
// gatePaused:true to show both banners in the popup at once.
//
// This is the highest-value test in the suite: rather than reproducing the one
// specific path, it drives every state-mutating entry point from an adversarial
// seeded state and checks the underlying invariant directly, so it also catches
// future variants of the same class of bug.
test('regression 1a99ebb + invariant: gatePaused and idlePaused are never both true', async (t) => {
  await t.test('startTimer() gate-blocked branch clears a stale idlePaused', async (t) => {
    const { api } = await setup(t, { now: WEDNESDAY_8PM });
    await api.setState({
      workHoursEnabled: true, workStart: '09:00', workEnd: '17:00',
      idlePaused: true, // stale, left over from an earlier idle-pause
    });

    await api.startTimer(20, false); // gate-blocked (outside hours, not forced)
    const state = await api.getState();
    assert.equal(state.gatePaused, true);
    assert.equal(state.idlePaused, false, 'must not leave a stale idlePaused alongside the new gatePaused');
  });

  await t.test('SET_INTERVAL (the actual originally-reachable path) also clears a stale idlePaused', async (t) => {
    const { internals, api } = await setup(t, { now: WEDNESDAY_8PM });
    await api.setState({
      workHoursEnabled: true, workStart: '09:00', workEnd: '17:00',
      idlePaused: true,
    });

    await internals.sendMessageToBackground({ type: 'SET_INTERVAL', intervalMin: 30 });
    const state = await api.getState();
    assert.equal(state.gatePaused, true);
    assert.equal(state.idlePaused, false);
  });

  await t.test('invariant holds after reevaluateGate() gate-pausing a running timer', async (t) => {
    const { api } = await setup(t);
    await api.setState({ workHoursEnabled: true, workStart: '09:00', workEnd: '17:00' });
    await api.startTimer(60);
    t.mock.timers.setTime(localTime(2024, 0, 10, 17, 1));
    await api.reevaluateGate();

    const state = await api.getState();
    assert.ok(!(state.gatePaused && state.idlePaused), 'invariant violated');
  });

  await t.test('invariant holds after idle-pausing a running timer', async (t) => {
    const { chrome, api } = await setup(t);
    await api.startTimer(20);
    chrome.idle._setState('idle');
    await api.reconfirmNotIdle(true);

    const state = await api.getState();
    assert.ok(!(state.gatePaused && state.idlePaused), 'invariant violated');
  });
});
