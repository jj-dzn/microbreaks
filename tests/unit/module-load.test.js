'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockChrome } = require('../helpers/mock-chrome');
const { createMockFetch } = require('../helpers/mock-fetch');
const { loadBackground } = require('../helpers/load-background');
const { localTime } = require('../helpers/time');

const WEDNESDAY_10AM = localTime(2024, 0, 10, 10, 0);

test('loading background.js registers each listener exactly once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: WEDNESDAY_10AM });
  const { chrome } = createMockChrome();
  await loadBackground(chrome, createMockFetch());

  assert.equal(chrome.windows.onFocusChanged._listeners.length, 1);
  assert.equal(chrome.tabs.onActivated._listeners.length, 1);
  assert.equal(chrome.idle.onStateChanged._listeners.length, 1);
  assert.equal(chrome.alarms.onAlarm._listeners.length, 1);
  assert.equal(chrome.notifications.onButtonClicked._listeners.length, 1);
  assert.equal(chrome.runtime.onMessage._listeners.length, 1);
  assert.equal(chrome.commands.onCommand._listeners.length, 1);
  assert.equal(chrome.runtime.onInstalled._listeners.length, 1);
  assert.equal(chrome.runtime.onStartup._listeners.length, 1);
});

test('chrome.alarms.getAll guard creates the periodic gate-check alarm only when missing', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: WEDNESDAY_10AM });
  const { chrome, _internals } = createMockChrome();
  await loadBackground(chrome, createMockFetch());

  const alarms1 = await new Promise((resolve) => chrome.alarms.getAll(resolve));
  const gateCheckAlarms1 = alarms1.filter((a) => a.name === 'microbreak-gate-check');
  assert.equal(gateCheckAlarms1.length, 1, 'should create the alarm once when missing');

  // Loading a second time against the SAME chrome mock (alarm already present)
  // should not create a duplicate.
  await loadBackground(chrome, createMockFetch());
  const alarms2 = await new Promise((resolve) => chrome.alarms.getAll(resolve));
  const gateCheckAlarms2 = alarms2.filter((a) => a.name === 'microbreak-gate-check');
  assert.equal(gateCheckAlarms2.length, 1, 'should not duplicate the alarm on a second load if already present');
});
