---
status: accepted
---

# The Arcade's web address is chosen once and never changes

A browser ties both stored data and the installed app to the site's origin (scheme, host and port). If the Arcade moves to a different address, every tablet silently starts with empty Progress and must be reinstalled, and nothing in the code can prevent or detect this. The permanent address is therefore chosen before the family starts using the Arcade, and the Arcade is served from the root of that address.

The Arcade is hosted on GitHub Pages, behind a subdomain the owner controls. The owner chose this on 2026-11-19; the exact hostname is still to be picked.

The default GitHub Pages address, `<user>.github.io/whimigo/`, must not be used for real play. That hostname belongs to GitHub, so leaving Pages would be a move. It is also shared: a browser keys stored data by hostname and not by path, so every other project site under the same account would read and write the same storage as the Arcade.

## Consequences

- The hostname is the family's, so the hosting provider can change behind it without changing the origin. GitHub Pages is the host today and can be replaced later at no cost to the children.
- Preview deployments on other addresses are fine for testing. Their Progress is separate and disposable.
- Changing from a subdomain to a path, or from one subdomain to another, counts as a move.
- The site is public. A private repository does not make its Pages site private: anyone with the address can open the Arcade. That is acceptable because there are no accounts and Progress never leaves the tablet.
- Pages on a private repository needs a paid GitHub plan. If the plan does not allow it, the choices are to upgrade, to make the repository public, or to use another static host behind the same hostname.
- Deployment is a GitHub Actions workflow that publishes the build on every push to `main`. The owner's part is one DNS record for the subdomain.
- The address is needed before the Phase 0 device tests, because installation and storage behaviour must be tested where the Arcade will really live.
