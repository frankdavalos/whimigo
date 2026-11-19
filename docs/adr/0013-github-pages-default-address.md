---
status: accepted
---

# The Arcade is served from GitHub Pages at its default address

The Arcade is hosted on GitHub Pages at the account's default address, `https://<account>.github.io/whimigo/`, from a public repository. This replaces an earlier version of this record, written the same day, which called for a hostname the owner controls so that the address could never change.

A browser ties both stored data and the installed app to the site's address. If the Arcade ever moves, every tablet starts again with empty Progress and must be reinstalled, and nothing in the code can prevent that. An address the owner controls would avoid it. Two facts outweigh that:

- The tablet's network filtering is not under the owner's control. It allows GitHub; an unfamiliar hostname may be blocked, and the owner could not unblock it.
- The owner has said that losing Progress in a future move is acceptable.

## Considered Options

- **A subdomain the owner controls, pointed at GitHub Pages.** The earlier choice. Rejected because the filter may block it.
- **A server the owner runs.** Rejected for the same reason. It remains the fallback if GitHub Pages is unreachable from the tablet.
- **A private repository with Pages.** Needs a paid GitHub plan. Rejected: the repository holds nothing sensitive, so it is made public.
- **A private source repository that publishes only the built site to a second, public repository.** Rejected as more machinery than the secrecy is worth.

## Consequences

- **Unverified until tested on the tablet.** "GitHub is allowed" may cover only `github.com`. Pages sites are on `github.io`, which a filter can treat separately, even per site. The first thing done is to open the real address on the tablet.
- **The Arcade lives under a path, not at the root.** The build's base path, the manifest's scope and start address, and the service worker's scope are all `/whimigo/`.
- **The hostname is shared.** Every Pages site under the same account has the same hostname, and a browser keys stored data by hostname. The Arcade's saved document therefore uses a key that begins `whimigo:`, so no sibling site can collide with it. Storage eviction is also shared across those sites.
- **The repository and the site are public.** Nothing personal goes into either: no email addresses, names of children, device identifiers or network details. Commits use the owner's GitHub no-reply address.
- **Moving later costs Progress and a reinstall.** That is accepted. Stars and stickers are all that would be lost.
- **Deployment is a GitHub Actions workflow** that publishes the build on every push to `main`. There is no DNS to configure and nothing for the owner to do.
