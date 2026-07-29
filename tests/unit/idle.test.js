'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockChrome } = require('../helpers/mock-chrome');
const { createMockFetch } = require('../helpers/mock-fetch');
const { loadBackground } = require('../helpers/load-background');
const { localTime } = require('../helpers/time');

const WEDNESDAY_10AM = localTime(2024, 0, 10, 10, 0);

async function setup(t, { now = WEDNESDAY_10AM } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  const { chrome, _internals } = createMockChrome();
  const fetchFn = createMockFetch();
  const api = await loadBackground(chrome, fetchFn);
  return { chrome, internals: _internals, api };
}

test('reconfirmNotIdle: pauses and preserves gateOverride once idle and past the grace window', async (t) => {
  const { chrome, api } = await setup(t);
  await api.startTimer(20, true); // force so gateOverride starts true, to prove it survives
  await api.setState({ gateOverride: true });

  chrome.idle._setState('idle');
  await api.reconfirmNotIdle(true);
  const state = await api.getState();

  assert.equal(state.running, false);
  assert.equal(state.idlePaused, true);
  assert.equal(state.gateOverride, true, 'gateOverride must survive an idle-pause');
});

test('reconfirmNotIdle: no-op during the post-break grace window even when idle', async (t) => {
  const { chrome, api } = await setup(t);
  await api.startTimer(20);
  // Seed a breakLog entry as if a break had just fired.
  await api.setState({ breakLog: [{ time: new Date(WEDNESDAY_10AM).toISOString(), stretchIndex: 0 }], breakLogDate: new Date(WEDNESDAY_10AM).toDateString() });

  chrome.idle._setState('idle');
  await api.reconfirmNotIdle(true);
  const stillRunning = await api.getState();
  assert.equal(stillRunning.running, true, 'should not idle-pause inside the grace window');

  // Move past the grace window and confirm it now does pause.
  t.mock.timers.setTime(WEDNESDAY_10AM + api.POST_BREAK_IDLE_GRACE_MS + 1000);
  await api.reconfirmNotIdle(true);
  const nowPaused = await api.getState();
  assert.equal(nowPaused.running, false);
  assert.equal(nowPaused.idlePaused, true);
});
