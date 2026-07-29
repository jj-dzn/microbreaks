# Roadmap

Ideas for future MicroBreaks improvements, roughly ordered by effort within each tier. Nothing here is committed — this is a working list to pull from, not a promise.

## 1.7 — target: next ~30 days

Curated from the tiers below for a realistic one-month scope: all self-contained, none touch the work-hours/weekend gate logic (that code just went through three straight patch releases stabilizing it — deliberately giving it a cycle to settle before building more on top of it).

- **Idle detection** — auto-pause when away from the computer (`chrome.idle`), so breaks don't silently pile up during lunch or a long meeting. Highest-value item on this list; solves a real, frequently-hit gap.
- **Overlay customization (opacity / corner-widget option)** — now that strict mode is the default (1.6.21), this is more relevant than it used to be: a lighter middle ground for users who find the full-screen takeover too disruptive but don't want to drop back to plain notifications. Directly follow-on work from the default-mode change.
- **Eye-rest breaks (20-20-20)** — a second break type alongside stretches. Reuses existing overlay/notification plumbing, mostly new content + a type selector.
- **Accessibility pass** — screen-reader labels, focus management in the overlay/popup, `prefers-reduced-motion` support. Worth doing before the user base grows further; also a Chrome Web Store quality signal.
- **"Why this stretch" tooltip** — one-line rationale per stretch card. Cheap, improves the guided-stretch experience.
- **More chime options** — low-effort content addition to the existing sound picker.
- **Export/import settings** — JSON export/import for backup or moving to a fresh profile. Straightforward, no new mechanism.

**Deliberately deferred past 1.7:**
- *Custom intervals per time-of-day* — builds directly on the work-hours gate; holding until the current gate logic has had a real cycle in the wild with no regressions.
- *Additional stretch categories* — content-heavy (new animated figures/poses), not a scoped engineering task; better as its own release.
- *Popup/options live sync* (`chrome.storage.onChanged`) — a robustness item noted during the 1.6.x bug hunts, not a feature; candidate for a maintenance-focused release instead of a feature release.

## Near-term (small, self-contained)

- **Eye-rest breaks (20-20-20)** — an alternate break type alongside stretches: "look at something 20ft away for 20 seconds." Simple timer variant, reuses existing overlay/notification plumbing.
- **Idle detection** — use `chrome.idle` to auto-pause the timer when the user is away from the computer, so breaks don't pile up while they're at lunch. Would need a new permission but is a small logic change in `background.js`.
- **Per-stretch duration** — right now all stretches likely share timing; letting each stretch define its own hold/step duration would make the guided animations feel more accurate (e.g. a spinal twist vs. a quick wrist circle).
- **"Why this stretch" tooltip** — one-line rationale on each stretch card (what muscle group / desk-posture problem it addresses) to make the picks feel less random.
- **Export/import settings** — JSON export of options + custom stretch list, for users who want to back up config outside of Chrome sync or move it to a fresh profile.
- **More chime options** — the sound picker already has a preview UI; adding a handful more chimes is low-effort content, not new mechanism.

## Medium (new surface area, still local-only)

- **Additional stretch categories** — current 15 stretches read as general desk stretches; could add focused sets (eyes/vision, standing desk, post-meeting, wrists/RSI-focused) selectable as a pack in options.
- **Weekly/monthly stats view** — the daily summary and streak tracking exist; a simple history chart (breaks per day over the last 7/30 days) in the options page would extend `chrome.storage` data already being collected rather than requiring new tracking.
- **Custom break intervals per time-of-day** — e.g. shorter intervals in the afternoon energy dip. Builds on the existing work-hours/weekend-pause scheduling logic.
- **Overlay customization** — let users pick overlay opacity/blur or disable the full-screen takeover in favor of a corner widget, for people who find strict mode too disruptive but still want a visual nudge.
- **More locales** — the i18n system already supports 8 languages via `_locales/`; adding more (e.g. Japanese, Portuguese, Arabic) is mostly translation work, not engineering.
- **Accessibility pass** — screen-reader labels, focus management in the overlay/popup, and reduced-motion support for the animated figures (respect `prefers-reduced-motion`).

## Larger (new mechanism or scope)

- **Multi-monitor overlay** — currently strict mode injects into the active tab; explicitly handling multiple windows/monitors so a break overlay shows wherever the user's eyes are, not just the focused tab.
- **Calendar-aware pausing** — optional integration to detect an active video call or presentation (e.g. via tab title/URL heuristics rather than a Calendar API, to preserve the no-network-requests privacy story) and auto-snooze breaks during it.
- **Companion mobile reminder** — out of scope for a Chrome extension proper, but worth scoping separately if there's demand for break reminders outside the browser.
- **Firefox/Edge port** — the extension is plain JS/HTML/CSS with no build step, which makes a WebExtensions port to Firefox relatively mechanical; main work is auditing Chrome-specific APIs (`chrome.offscreen`, `chrome.alarms` behavior) for polyfills or Manifest differences.

## Explicitly not planned

- **Accounts / cloud sync beyond Chrome's built-in sync** — conflicts with the "100% private, no servers" positioning that's core to the product.
- **Any analytics/telemetry** — same reason; the privacy policy commits to zero data leaving the device.

---

Have an idea not listed here, or found via a GitHub issue? Add it to the relevant tier above, or open an issue and reference it in a future edit of this file.
