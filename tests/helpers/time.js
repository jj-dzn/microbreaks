'use strict';

// Advances node:test's mocked timers by `ms`, then flushes several microtask
// turns. A single tick() is not always enough for a chain of sequential
// `await`s inside a resumed timer callback to fully settle before assertions
// run against the result.
async function tickAndFlush(t, ms, flushes = 8) {
  t.mock.timers.tick(ms);
  for (let i = 0; i < flushes; i++) {
    await Promise.resolve();
  }
}

// Builds a fixed local-wall-clock timestamp (year, monthIndex 0-11, day, hour,
// minute) — timezone-independent for getHours()/getDay() purposes, since the
// components are defined in local terms already, not derived from a UTC
// instant that then gets reinterpreted locally.
function localTime(year, monthIndex, day, hour = 0, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

module.exports = { tickAndFlush, localTime };
