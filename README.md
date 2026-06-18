# MicroBreaks — Chrome Extension v1.0

A gentle stretch timer for desk workers. Calm, encouraging, never nagging.

## What's built

| Feature | Status |
|---|---|
| Countdown timer with animated breathing ring | ✅ |
| 20 / 30 / 45 / custom minute intervals | ✅ |
| Pause, resume, snooze (+5 min) | ✅ |
| Browser notification on break with stretch prompt | ✅ |
| Notification action buttons (snooze / restart) | ✅ |
| Focus mode → full-page break overlay | ✅ |
| Streak tracker (local, resets correctly) | ✅ |
| Breaks today + mins moved stats | ✅ |
| Settings toggles (sound, notifs, animations, summary) | ✅ wired to storage |
| Sound chime | ⬜ placeholder — add an MP3 to /sounds/ and wire in background.js |
| Stretch GIF animations | ⬜ placeholder — add GIFs to /images/ and show in content.js overlay |
| Daily summary notification | ⬜ toggle is wired; fire logic not yet implemented |

## Load in Chrome (dev mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `microbreaks/` folder
5. Pin the extension from the puzzle icon in the toolbar

To reload after editing: click the refresh icon on the extension card, or press ⌘R in the popup dev tools.

## File structure

```
microbreaks/
├── manifest.json       # Permissions: alarms, notifications, storage
├── background.js       # Service worker — owns all state, alarms, break logic
├── popup.html          # Extension popup shell
├── popup.css           # Full brand palette + animations
├── popup.js            # Popup UI — reads from background via messages
├── content.js          # Injected into pages — renders focus mode overlay
├── icons/              # icon16.png, icon48.png, icon128.png (add before publishing)
└── sounds/             # (optional) chime.mp3 for sound alerts
```

## Architecture notes

**State lives in `background.js` only.** The popup reads state on open and subscribes to `BREAK_FIRED` messages. This means the timer survives popup closes, tab switches, and browser restarts (Chrome restarts service workers on alarm fire).

**`chrome.alarms` not `setInterval`.** The alarm API is the only reliable way to fire events while the extension is idle. The popup uses a local `setInterval` only for the visual countdown — it re-syncs from the background's `startedAt` timestamp on every open.

**Message API:**
```
GET_STATE          → returns full state object
START              → starts/restarts timer, returns state
PAUSE              → pauses, stores remainSec, returns state
RESUME             → restarts from stored remainSec, returns state
SNOOZE             → adds 5 min to current countdown, returns state
STOP               → clears alarm, resets, returns state
SET_INTERVAL       → updates intervalMin in storage, returns state
SET_FOCUS          → toggles focusMode, returns state
SET_PREF           → sets any boolean pref by key, returns state
```

## Adding sound (optional for v1)

1. Add `chime.mp3` (or `.ogg`) to `/sounds/`
2. In `background.js`, inside `fireBreak()`:
```js
if (state.soundEnabled) {
  const audio = new Audio(chrome.runtime.getURL('sounds/chime.mp3'));
  audio.play();
}
```

Note: audio in service workers requires an offscreen document in MV3. Simpler alternative: play the sound from the content script on break fire.

## Before publishing to Chrome Web Store

- [ ] Create proper icons (16, 48, 128px) — SVG → PNG, transparent bg, forest green palette
- [ ] Add at least 3 screenshots (1280×800 or 640×400)
- [ ] Write store description (140 char short + long form)
- [ ] Test on Chrome stable, Beta, and at least one Chromium build
- [ ] Review [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [ ] Decide on privacy policy (required if you ever add sync/accounts)
- [ ] Set version to 1.0.0 and bump for each store submission

## Roadmap (post-v1)

- `chrome.storage.sync` for streak persistence across devices
- "Pause during meetings" — watch for `meet.google.com` / `zoom.us` tab activity
- Stretch GIF library (5–10 animations, bundled or CDN)
- Daily summary notification at end of work hours
- Onboarding flow on first install (set interval, enable notifications prompt)
