'use strict';

const fs = require('fs');
const path = require('path');

// background.js fetches _locales/{lang}/messages.json via a chrome-extension://
// URL built from chrome.runtime.getURL(). This mock parses the language back
// out of that URL and reads the REAL locale file off disk (path.join, not
// string concatenation — CI runs on ubuntu-latest, dev happens on Windows),
// so tests exercise real translation data instead of a duplicated fixture.
// Tests should assert on shape/presence (non-empty string, contains expected
// substrings) rather than exact copy text, so an unrelated wording edit in a
// locale file doesn't break a background.js test.

const REPO_ROOT = path.join(__dirname, '..', '..');

function createMockFetch() {
  return async function mockFetch(url) {
    const match = /_locales\/([a-z-]+)\/messages\.json$/.exec(String(url));
    if (!match) {
      throw new Error(`mock fetch: unexpected URL (no _locales/*/messages.json match): ${url}`);
    }
    const lang = match[1];
    const filePath = path.join(REPO_ROOT, '_locales', lang, 'messages.json');
    let body;
    try {
      body = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      return { ok: false, status: 404, json: async () => { throw new Error('not found'); } };
    }
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  };
}

module.exports = { createMockFetch };
