'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockChrome } = require('../helpers/mock-chrome');
const { createMockFetch } = require('../helpers/mock-fetch');
const { loadBackground } = require('../helpers/load-background');
const { tickAndFlush, localTime } = require('../helpers/time');

// Wednesday 2024-01-10, 10:00am local time — an ordinary weekday, safe
// default for tests not specifically about the work-hours/weekend gate.
const WEDNESDAY_10AM = localTime(2024, 0, 10, 10, 0);

async function setup(t, { now = WEDNESDAY_10AM } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  const { chrome, _internals } = createMockChrome();
  const fetchFn = createMockFetch();
  const api = await loadBackground(chrome, fetchFn);
  return { chrome, internals: _internals, api };
}

test('startTimer: happy path starts running with the correct alarm', async (t) => {
  const { chrome, api } = await setup(t);

  await api.startTimer(20);
  const state = await api.getState();

  assert.equal(state.running, true);
  assert.equal(state.startedAt, WEDNESDAY_10AM);
  assert.equal(state.pausedRemainSec, null);
  assert.equal(state.gatePaused, false);

  const alarms = await new Promise((resolve) => chrome.alarms.getAll(resolve));
  const main = alarms.find((a) => a.name === api.ALARM_NAME);
  assert.ok(main, 'expected the main break alarm to be created');
  assert.equal(main.delayInMinutes, 20);
});

test('startTimer: force=true bypasses a blocked gate and sets gateOverride', async (t) => {
  // 8:00pm on the same Wednesday, work hours 9-17 -> outside hours.
  const outsideHours = localTime(2024, 0, 10, 20, 0);
  const { internals, api } = await setup(t, { now: outsideHours });
  await api.setState({ workHoursEnabled: true, workStart: '09:00', workEnd: '17:00' });

  await api.startTimer(20, true);
  const state = await api.getState();

  assert.equal(state.running, true, 'force=true should start despite being outside hours');
  assert.equal(state.gateOverride, true);
});

test('startTimer: gate-blocked without force pauses with a full-interval snapshot', async (t) => {
  const outsideHours = localTime(2024, 0, 10, 20, 0);
  const { api } = await setup(t, { now: outsideHours });
  await api.setState({ workHoursEnabled: true, workStart: '09:00', workEnd: '17:00' });

  await api.startTimer(30, false);
  const state = await api.getState();

  assert.equal(state.running, false);
  assert.equal(state.gatePaused, true);
  assert.equal(state.pausedRemainSec, 30 * 60, 'should show the full interval, not a partial elapsed value');
});

test('pauseTimer: computes the real elapsed-adjusted remainder', async (t) => {
  const { api } = await setup(t);
  await api.startTimer(20);

  await tickAndFlush(t, 7 * 60 * 1000); // 7 minutes in

  await api.pauseTimer();
  const state = await api.getState();

  assert.equal(state.running, false);
  assert.equal(state.pausedRemainSec, (20 - 7) * 60);
  assert.equal(state.gatePaused, false);
  assert.equal(state.gateOverride, false);
});

test('resumeTimer: idempotency guard — a second call while already running is a no-op', async (t) => {
  const { api } = await setup(t);
  await api.startTimer(20);
  const afterStart = await api.getState();

  await tickAndFlush(t, 5000);
  await api.resumeTimer(); // should bail out immediately: state.running is already true
  const afterResume = await api.getState();

  assert.equal(afterResume.running, true);
  assert.equal(afterResume.startedAt, afterStart.startedAt, 'startedAt should not have been reset');
  assert.equal(afterResume.pausedRemainSec, null);
});

test('resumeTimer: refuses when gate-blocked unless forced', async (t) => {
  const outsideHours = localTime(2024, 0, 10, 20, 0);
  const { api } = await setup(t, { now: outsideHours });
  await api.setState({
    workHoursEnabled: true, workStart: '09:00', workEnd: '17:00',
    running: false, pausedRemainSec: 600, gatePaused: true,
  });

  await api.resumeTimer(false);
  assert.equal((await api.getState()).running, false, 'unforced resume should stay paused while gate-blocked');

  await api.resumeTimer(true);
  assert.equal((await api.getState()).running, true, 'forced resume should succeed despite the gate');
});

test('snoozeTimer: while running, clears pendingBreak and extends by snoozeMin', async (t) => {
  const { chrome, api } = await setup(t);
  await api.startTimer(20);
  await api.setState({ pendingBreak: { stretchIndex: 2 } });

  await tickAndFlush(t, 2 * 60 * 1000); // 2 minutes in

  await api.snoozeTimer();
  const state = await api.getState();

  assert.equal(state.pendingBreak, null);
  assert.equal(state.running, true);

  const alarms = await new Promise((resolve) => chrome.alarms.getAll(resolve));
  const main = alarms.find((a) => a.name === api.ALARM_NAME);
  const expectedRemainMin = (20 * 60 - 2 * 60 + 5 * 60) / 60; // default snoozeMin is 5
  assert.equal(main.delayInMinutes, expectedRemainMin);
});
