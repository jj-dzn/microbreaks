# MicroBreaks — Stretch Timer

A calm, gentle break reminder for desk workers who forget to move. Configurable timer, animated stretch guides, and a strict mode that's actually hard to ignore.

🔗 **[Visit the site](https://jj-dzn.github.io/microbreaks/)** · **[Privacy Policy](https://jj-dzn.github.io/microbreaks/privacy-policy.html)** · **[Chrome Web Store](https://chromewebstore.google.com/detail/microbreaks-%E2%80%94-stretch-tim/lkepdmphkgeplknkfoolimhjamkfkgie)**

![MicroBreaks popup](https://via.placeholder.com/600x400?text=Add+a+screenshot+here)

## What it does

MicroBreaks sits quietly in your toolbar and reminds you to take a short stretch break at a configurable interval — 20, 30, 45 minutes, or any custom time you choose. When a break fires, you'll see a gentle notification with a stretch suggestion, or — if you've enabled **strict mode** — a full-screen overlay with an animated figure walking you through the movement step by step.

No accounts, no servers, no tracking. Everything is stored locally on your device.

## Features

- ⏱ **Configurable timer** — 20 / 30 / 45 min or custom intervals
- 🧘 **15 office-friendly stretches** — neck rolls, shoulder rolls, spinal twists, hip stretches, and more, each with step-by-step instructions
- 🎬 **Animated stretch guide** — a fully animated figure (choose male or female) demonstrates each stretch in real time
- 🎯 **Strict mode** — shows a full-screen break overlay instead of a notification, for when you really need to step away
- 💤 **Snooze** — push a break back 5 minutes, no guilt
- 🔥 **Streak tracking** — daily breaks taken, minutes moved, and current streak
- 🌍 **8 languages** — English, Spanish, French, German, Hindi, Malayalam, Tamil, and Telugu, with auto-detect or manual selection
- 🔔 **Gentle chime** — an optional marimba sound plays a configurable number of seconds before each break
- 🕐 **Work hours** — set a start and end time so the timer only runs while you're actually working
- 📅 **Weekend pause** — automatically skips Saturday and Sunday by default, fully configurable per day
- 📊 **Daily summary** — a notification and badge at the end of your workday recapping breaks taken and minutes moved
- ☁️ **Synced across devices** — your streak, settings, and preferences follow you via `chrome.storage.sync`
- 🎨 **3 color themes** — sage, dusk purple, and ocean blue. Pick the one that feels right.
- 🎵 **4 chime sounds** — marimba, soft bell, kalimba, or wind chime, with a live preview when choosing
- ✨ **Richer stretch animations** — each pose now follows a proper rise → hold-with-breath → release arc, with motion-trail arrows showing the direction of movement
- 🎉 **A satisfying finish** — a checkmark burst plays when you mark a stretch done, instead of the overlay just closing
- 🌅 **Time-of-day tinting** — the accent color shifts subtly warmer in the evening
- 🌬️ **Idle breathing** — the popup's timer ring keeps a slow, gentle pulse even while paused
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
- `chrome.offscreen` — plays the chime sound from the service worker
- `chrome.scripting` + `host_permissions` — on-demand strict mode overlay injection on any active tab
- `_locales/` — Chrome's native i18n system for 8-language support

## Project structure

```
microbreaks/
├── manifest.json          Extension config and permissions
├── background.js          Service worker — timer state, alarms, break logic
├── popup.html / .css / .js  Extension popup UI
├── content.js              Injected on-demand — renders the strict mode overlay
├── offscreen.html / .js     Audio playback document (MV3 service workers can't play sound directly)
├── icons/                   Toolbar and store icons
├── sounds/                   chime.mp3 — gentle marimba break sound
├── _locales/                 Translations — en, es, fr, de, hi, ml, ta, te
├── index.html               Landing page (GitHub Pages)
└── privacy-policy.html      Privacy policy (GitHub Pages)
```

## Privacy

MicroBreaks collects no personal data and makes no network requests. Full details in the [privacy policy](https://jj-dzn.github.io/microbreaks/privacy-policy.html).

## Feedback & issues

Found a bug or have a feature request? [Open an issue](../../issues) on this repository.

## License

All rights reserved. This code is shared publicly for transparency, but may not be copied, modified, or redistributed without permission.

---

Built with care for everyone who forgets to stand up. 🌿
