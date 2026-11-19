---
status: accepted
---

# The Arcade's web address is chosen once and never changes

A browser ties both stored data and the installed app to the site's origin (scheme, host and port). If the Arcade moves to a different address, every tablet silently starts with empty Progress and must be reinstalled, and nothing in the code can prevent or detect this. The permanent address is therefore chosen before the family starts using the Arcade, and the Arcade is served from the root of that address.

## Consequences

- Use a hostname the family controls, so the hosting provider can change behind it without changing the origin.
- Preview deployments on other addresses are fine for testing. Their Progress is separate and disposable.
- Changing from a subdomain to a path, or from one subdomain to another, counts as a move.
- The address is needed before the Phase 0 device tests, because installation and storage behaviour must be tested where the Arcade will really live.
