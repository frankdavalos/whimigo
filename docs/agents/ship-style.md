# Ship style: direct push

Changes go straight to `main`. There is no pull request workflow.

## Conventions

- Pull latest before committing.
- Run the checks before pushing: `npm run check` and `npm run e2e`. Push only if both pass. If either fails, fix the cause or stop and report. Never push a failing tree, and never skip, delete or weaken a test to get a push through.
- Commit and push to `main` without waiting for the owner to confirm the commit message. The owner chose this on 2026-11-19 to keep their involvement low; they review afterwards, in the commit history and on the tablet.
- Never force-push, and never rewrite history that has been pushed.
- Close the related issue explicitly with a reference to the commit: `gh issue close <num> --comment "<sha>"`. If the issue is a sub-issue, closing it lets the parent close itself once its last child closes.
- A `[HITL]` slice is never shipped by an agent. The owner clears it with `/zsl:human-itl`.

Until the walking skeleton exists there are no check commands to run. That slice creates them, and it is the only code slice pushed without them.

### When WebKit cannot launch on the development host

`npm run e2e` includes the `webkit-smoke` project. On a host that lacks the system libraries Playwright's WebKit needs, run that project in the official Playwright container of the pinned version (the `@playwright/test` version in `package.json`), from the repository root:

```sh
docker run --rm --ipc=host -v "$PWD":/src:ro -e GITHUB_SHA="$(git rev-parse HEAD)" \
  mcr.microsoft.com/playwright:v1.64.1-noble bash -c '
    mkdir /work && tar -C /src --exclude=./node_modules --exclude=./dist --exclude=./.git -cf - . | tar -C /work -xf - &&
    cd /work && npm ci && npm run build && npx playwright test --project=webkit-smoke'
```

The checkout is mounted read-only and copied, so the container's `node_modules` never replaces the host's. `GITHUB_SHA` gives the build its identifier, since the copy has no git history. Run the Chromium projects on the host as usual. CI runs every project on Ubuntu anyway. Never skip the WebKit project to get a push through.

## When a skill says "ship the change"

1. Pull latest.
2. Run the checks. Stop if they fail.
3. Commit and push to `main`.
4. Close the related issue with a reference to the commit.

## What direct push rules out

- `/zsl:tdd-parallel`, which builds several slices at once and opens one combined pull request. Slices are built one at a time with `/zsl:tdd`.
- The overnight loop (`/zsl:afk-fanout`, `/zsl:afk-worker`, `/zsl:morning-review`), which depends on `/zsl:tdd-parallel`.
- Two agents working in the same checkout at once. With no merge step, nothing would catch a collision.

To use any of these later, change this file to the pull-request style by re-running `/zsl:setup-zsl-superpowers`.
