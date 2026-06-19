# MicroBreaks — Stretch Timer

A calm, gentle break reminder for desk workers who forget to move. Configurable timer, animated stretch guides, and a focus mode that's actually hard to ignore.

🔗 **[Visit the site](https://jj-dzn.github.io/microbreaks/)** · **[Privacy Policy](https://jj-dzn.github.io/microbreaks/privacy-policy.html)** · [Chrome Web Store](#) *(link once live)*

![MicroBreaks popup](https://via.placeholder.com/600x400?text=Add+a+screenshot+here)

## What it does

MicroBreaks sits quietly in your toolbar and reminds you to take a short stretch break at a configurable interval — 20, 30, 45 minutes, or any custom time you choose. When a break fires, you'll see a gentle notification with a stretch suggestion, or — if you've enabled **focus mode** — a full-screen overlay with an animated figure walking you through the movement step by step.

No accounts, no servers, no tracking. Everything is stored locally on your device.

## Features

- ⏱ **Configurable timer** — 20 / 30 / 45 min or custom intervals
- 🧘 **15 office-friendly stretches** — neck rolls, shoulder rolls, spinal twists, hip stretches, and more, each with step-by-step instructions
- 🎬 **Animated stretch guide** — a fully animated figure (choose male or female) demonstrates each stretch in real time
- 🎯 **Focus mode** — shows a full-screen break overlay instead of a notification, for when you really need to step away
- 💤 **Snooze** — push a break back 5 minutes, no guilt
- 🔥 **Streak tracking** — daily breaks taken, minutes moved, and current streak
- 🔒 **100% private** — no data ever leaves your device

## Installing

**From the Chrome Web Store** *(recommended)*
Once published, install directly from the [Chrome Web Store listing](#).

**From source (developer mode)**
1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked**
5. Select the project folder

## Tech stack

Plain JavaScript, HTML, and CSS — no build step, no frameworks, no dependencies. Built on Chrome's Manifest V3 extension platform using:

- `chrome.alarms` — reliable timer that survives popup closes and browser restarts
- `chrome.storage.local` — settings, streak, and stats persistence
- `chrome.notifications` — break reminders
- `chrome.scripting` + `activeTab` — on-demand focus mode overlay injection

## Project structure

```
microbreaks/
├── manifest.json          Extension config and permissions
├── background.js          Service worker — timer state, alarms, break logic
├── popup.html / .css / .js  Extension popup UI
├── content.js              Injected on-demand — renders the focus mode overlay
├── icons/                   Toolbar and store icons
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
