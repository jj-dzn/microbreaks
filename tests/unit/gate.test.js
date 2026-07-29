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

test('isWithinWorkHours / isWeekendPaused: boundary correctness', async (t) => {
  const { api } = await setup(t);

  const cases = [
    // [label, hour, minute, workStart, workEnd, expectedWithin]
    ['start-inclusive', 9, 0, '09:00', '17:00', true],
    ['end-exclusive', 17, 0, '09:00', '17:00', false],
    ['one minute before start', 8, 59, '09:00', '17:00', false],
    ['one minute before end', 16, 59, '09:00', '17:00', true],
    ['mid-day', 12, 0, '09:00', '17:00', true],
    // overnight wraparound (start > end): 22:00-06:00
    ['overnight, well after start', 23, 0, '22:00', '06:00', true],
    ['overnight, well before end', 3, 0, '22:00', '06:00', true],
    ['overnight, outside range', 12, 0, '22:00', '06:00', false],
  ];

  for (const [label, hour, minute, workStart, workEnd, expectedWithin] of cases) {
    const now = new Date(2024, 0, 10, hour, minute); // Wednesday
    const state = { workHoursEnabled: true, workStart, workEnd };
    assert.equal(api.isWithinWorkHours(state, now), expectedWithin, `isWithinWorkHours: ${label}`);
  }

  // workHoursEnabled:false always returns "within hours" regardless of time
  assert.equal(
    api.isWithinWorkHours({ workHoursEnabled: false, workStart: '09:00', workEnd: '17:00' }, new Date(2024, 0, 10, 2, 0)),
    true,
  );

  // isWeekendPaused: Sat=6, Sun=0, Wed=3
  const saturday = new Date(2024, 0, 13);
  const sunday = new Date(2024, 0, 14);
  const wednesday = new Date(2024, 0, 10);
  const defaultWeekend = { weekendDays: [0, 6] };
  assert.equal(api.isWeekendPaused(defaultWeekend, saturday), true);
  assert.equal(api.isWeekendPaused(defaultWeekend, sunday), true);
  assert.equal(api.isWeekendPaused(defaultWeekend, wednesday), false);
  assert.equal(api.isWeekendPaused({ weekendDays: [] }, saturday), false, 'empty weekendDays never pauses');
});

test('reevaluateGate: auto-resumes a gate-paused timer with a fresh full interval', async (t) => {
  const { api } = await setup(t);
  await api.setState({
    workHoursEnabled: true, workStart: '09:00', workEnd: '17:00',
    running: false, gatePaused: true, pausedRemainSec: 3, intervalMin: 20, // near-zero stale remainder
  });

  await api.reevaluateGate();
  const state = await api.getState();

  assert.equal(state.running, true);
  assert.equal(state.gatePaused, false);
  assert.equal(state.pausedRemainSec, null, 'startTimer clears pausedRemainSec once running');
});

test('reevaluateGate: gate-pausing a running timer stores the full interval, not the elapsed remainder', async (t) => {
  // Start within hours, then move time forward past work hours before checking the gate.
  const { api } = await setup(t);
  await api.setState({ workHoursEnabled: true, workStart: '09:00', workEnd: '17:00' });
  await api.startTimer(60);

  t.mock.timers.setTime(localTime(2024, 0, 10, 17, 1)); // now just past work hours end
  await api.reevaluateGate();
  const state = await api.getState();

  assert.equal(state.running, false);
  assert.equal(state.gatePaused, true);
  assert.equal(state.pausedRemainSec, 60 * 60, 'must be the full interval, never pauseTimer()\'s actual elapsed remainder');
});

test('reevaluateGate: leaves an active override running while blocked, clears it once naturally back in bounds', async (t) => {
  const outsideHours = localTime(2024, 0, 10, 20, 0);
  const { api } = await setup(t, { now: outsideHours });
  await api.setState({ workHoursEnabled: true, workStart: '09:00', workEnd: '17:00' });
  await api.startTimer(20, true); // force through the gate
  assert.equal((await api.getState()).gateOverride, true);

  await api.reevaluateGate();
  assert.equal((await api.getState()).running, true, 'gateOverride should prevent a re-pause while still blocked');

  t.mock.timers.setTime(localTime(2024, 0, 10, 10, 0)); // back within hours
  await api.reevaluateGate();
  const state = await api.getState();
  assert.equal(state.running, true);
  assert.equal(state.gateOverride, false, 'override should be cleared once naturally back in bounds');
});
