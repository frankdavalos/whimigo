---
status: accepted
---

# Progress is one versioned JSON document in localStorage

Settings and Progress are stored as a single versioned JSON document in `localStorage`, behind a `SaveStore`. The starting proposal suggested IndexedDB; we rejected it because the data is a few kilobytes with no queries, and IndexedDB would bring an asynchronous start-up, a history of WebKit defects, and writes that can be lost if the app is killed mid-transaction, in exchange for no extra durability.

The durability point is the non-obvious one. WebKit evicts an origin's storage all together: IndexedDB, the service-worker cache and `localStorage` are removed at once. IndexedDB is therefore not a safer place for the same data.

## Consequences

- Saving is a synchronous write after each Round. There is no "saving" state anywhere.
- `SaveStore` hides the mechanism. If the data ever becomes large or structured, the store can change without touching the Arcade.
- The document carries a version and is migrated and validated on load. An unreadable document is set aside and the Arcade starts with fresh Progress.
- When storage is unavailable the Arcade runs with Progress in memory and says so in the Grown-Ups Area.
- Progress can still be lost if an adult clears website data. That is accepted; there is no export.
