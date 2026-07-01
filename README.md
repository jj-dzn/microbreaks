# MicroBreaks — Stretch Timer

A calm, gentle break reminder for desk workers who forget to move. Configurable timer, animated stretch guides, and a strict mode overlay that's actually hard to ignore.

🔗 **[Visit the site](https://jj-dzn.github.io/microbreaks/)** · **[Privacy Policy](https://jj-dzn.github.io/microbreaks/privacy-policy.html)** · **[Chrome Web Store](https://chromewebstore.google.com/detail/microbreaks-%E2%80%94-stretch-tim/lkepdmphkgeplknkfoolimhjamkfkgie)**

## What it does

MicroBreaks sits quietly in your toolbar and reminds you to take a short stretch break at a configurable interval. When a break fires, you get a gentle notification with a stretch suggestion — or, if you've enabled **strict mode**, a full-screen overlay with an animated figure walking you through the movement step by step. If you're away from Chrome when the break fires, the overlay waits for you when you come back.

No accounts, no servers, no tracking. Everything stays on your device.

## Features

- ⏱ **Configurable timer** — 20 / 30 / 45 min or any custom interval
- 🧘 **15 guided stretches** — neck rolls, shoulder rolls, spinal twists, wrist circles, and more, each with step-by-step instructions and an animated figure
- 🎯 **Strict mode** — full-screen break overlay that waits for you even if you were away from Chrome when it fired
- 🗂️ **Browse all stretches** — view all 15 in a grid from the popup or inside the overlay, and jump to any one instantly
- ⚙️ **Full options page** — dedicated settings page with sidebar navigation for all preferences
- 💤 **Snooze** — push a break back, no guilt
- 🔥 **Streak tracking** — daily breaks taken, minutes moved, and current streak
- 🔔 **Gentle chime** — 4 sounds to choose from (marimba, soft bell, kalimba, wind chime), with a live preview when selecting
- 🕐 **Work hours** — timer only runs during your set working hours
- 📅 **Weekend pause** — auto-pauses on Saturday and Sunday by default, fully configurable per day
- 📊 **Daily summary** — notification and badge at end of workday with your stats
- ☁️ **Synced across devices** — settings and streak follow you via Chrome's built-in sync
- 🎨 **3 color themes** — sage, dusk purple, and ocean blue, applied to both the overlay and the popup
- 🌙 **Dark mode** — follows your system setting, or override to light/dark manually
- 🌍 **8 languages** — English, Spanish, French, German, Hindi, Malayalam, Tamil, and Telugu, with auto-detect
- ✨ **Polished animations** — rise → hold-with-breath → release arc, motion arrows, completion checkmark burst
- 🔒 **100% private** — no data ever leaves your device

## Installing

**From the Chrome Web Store** *(recommended)*
Install directly from the [Chrome Web Store listing](https://chromewebstore.google.com/detail/microbreaks-%E2%80%94-stretch-tim/lkepdmphkgeplknkfoolimhjamkfkgie).

**From source (developer mode)**
1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked**
5. Select the project folder

## Tech stack

Plain JavaScript, HTML, and CSS — no build step, no frameworks, no dependencies. Built on Chrome's Manifest V3 extension platform using:

- `chrome.alarms` — reliable timer that survives popup closes and browser restarts
- `chrome.storage.sync` — settings and streak sync automatically across signed-in devices
- `chrome.storage.local` — session-only timer state (high-churn, not synced)
- `chrome.notifications` — break reminders and daily summary
- `chrome.offscreen` — plays the chime sound from the service worker (MV3 restriction)
- `chrome.scripting` + `host_permissions` — on-demand strict mode overlay injection on any active tab
- `chrome.windows` — detects when the user returns to Chrome to show a pending break overlay
- `_locales/` — Chrome's native i18n system for 8-language support

## Project structure

```
microbreaks/
├── manifest.json               Extension config and permissions
├── background.js               Service worker — timer, alarms, break logic, pending break
├── popup.html / .css / .js     Extension popup UI
├── options.html / .css / .js   Full settings page (sidebar navigation)
├── content.js                  Injected on-demand — renders the strict mode overlay
├── offscreen.html / .js        Audio playback document (MV3 service workers can't play sound directly)
├── icons/                      Toolbar and store icons
├── sounds/                     chime-marimba.mp3, chime-bell.mp3, chime-kalimba.mp3, chime-windchime.mp3
├── _locales/                   Translations — en, es, fr, de, hi, ml, ta, te
├── index.html                  Landing page (GitHub Pages)
└── privacy-policy.html         Privacy policy (GitHub Pages)
```

## Privacy

MicroBreaks collects no personal data and makes no network requests of its own. Settings sync between your own devices using Chrome's built-in sync infrastructure — the same mechanism Chrome uses for bookmarks and passwords. Nothing is sent to us or any third party. Full details in the [privacy policy](https://jj-dzn.github.io/microbreaks/privacy-policy.html).

## Feedback & issues

Found a bug or have a feature request? [Open an issue](../../issues) on this repository.

## License

All rights reserved. This code is shared publicly for transparency, but may not be copied, modified, or redistributed without permission.

---

Built with care for everyone who forgets to stand up. 🌿
