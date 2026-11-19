---
status: accepted
---

# Precache every file; apply updates only at a cold start or by an adult

The service worker caches the entire Arcade at install, including every Game, and a new version is never applied while the Arcade is running a Session. A downloaded update waits until the next cold start, or until an adult presses "Update now" in the Grown-Ups Area.

## Considered Options

- **Cache each Game the first time it is opened.** Rejected. A Game nobody happened to open at home would be missing on a car journey, and the Arcade would need a "not downloaded" state that a child cannot understand.
- **Automatic update (`skipWaiting` and `clientsClaim`).** Rejected. It can swap files under a running Round, leaving a page served partly by the old version and partly by the new.
- **Precache all, prompt mode.** Chosen.

## Consequences

- The first visit downloads everything, budgeted at 60 MB.
- Two Workbox defaults must be overridden: it precaches only scripts, styles and HTML, and skips files over 2 MiB.
- A fix does not reach the family until the app is next started cold or an adult updates it. The Arcade checks for a new version whenever it becomes visible.
