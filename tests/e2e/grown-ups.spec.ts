import type { CDPSession, Page } from '@playwright/test';
import type { SaveDocument } from '../../src/platform/save-store';
import { type Arcade, expect, test } from './arcade';
import { CATALOG, EVERY_STYLE, openSession, playToResult, sessionFor } from './play';

/**
 * The Grown-Ups Area (stories 24 to 28): plain HTML over the whole screen (ADR-0005), behind the
 * Grown-Up Gate, a three-second hold on the Home Screen.
 */

const AREA = 'grown-ups';
const GATE_MS = 3000;
const FIRST = CATALOG[0]!;

/** From the tap-to-start screen, holds the Gate on the Home Screen until the Area opens. */
async function openArea(arcade: Arcade) {
  await arcade.start();
  await arcade.openGrownUps();
  return arcade.grownUps();
}

/** Leaves the Area for the Home Screen. */
async function back(arcade: Arcade) {
  await arcade.grownUps().getByRole('button', { name: 'Back' }).tap();
  await expect.poll(() => arcade.screen()).toBe('home');
}

/** Opens the first Game's first Round through the bridge and reports its motion. */
async function motionOfNextRound(arcade: Arcade) {
  await arcade.call('open', sessionFor(FIRST, FIRST.playStyles[0]!), 1);
  await expect.poll(async () => (await arcade.round())?.motion ?? null).not.toBeNull();
  return (await arcade.round())!.motion;
}

/** Ends the Round being played with a Result, then goes home from the Result screen. */
async function closeRound(arcade: Arcade) {
  await arcade.call('finish', { kind: 'draw' });
  await expect.poll(() => arcade.screen()).toBe('result');
  await arcade.tap('home');
  await expect.poll(() => arcade.screen()).toBe('home');
}

/** Counts every touch and pointer event that reaches the canvas from now on. */
async function countCanvasTouches(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    const canvas = document.querySelector('#arcade canvas')!;
    const counter = { touches: 0 };
    Object.assign(window, { canvasTouches: counter });
    for (const type of ['touchstart', 'touchend', 'pointerdown', 'pointerup']) {
      canvas.addEventListener(type, () => (counter.touches += 1));
    }
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { canvasTouches: { touches: number } }).canvasTouches.touches,
    );
}

/** A save document with Stars, remembered choices and every setting chosen. */
const PLAYED: SaveDocument = {
  version: 1,
  mascots: { fox: { stars: 5 }, owl: { stars: 2 } },
  games: {
    [FIRST.id]: {
      roundsPlayed: 3,
      choices: { style: FIRST.playStyles[0]!.style, difficulty: 'hard', mascots: ['fox', 'owl'] },
    },
  },
  seating: 'around-the-table',
  sound: false,
  motion: 'on',
};

/** Loads the Arcade with `document` saved, as a visit after earlier play would. */
async function openWithSave(arcade: Arcade, document: SaveDocument) {
  await arcade.open();
  await arcade.page.evaluate(
    (saved) => localStorage.setItem('whimigo:save', JSON.stringify(saved)),
    document,
  );
  await arcade.open();
}

test.describe('the Grown-Up Gate', () => {
  test('a tap or a hold shorter than three seconds does nothing; a three-second hold opens the Grown-Ups Area', async ({
    arcade,
    page,
  }) => {
    await arcade.open();
    await arcade.start();
    await arcade.tap(AREA);
    await arcade.brush(AREA);
    // Scene time runs no faster than the clock, so this hold is shorter than the Gate's, with room
    // for a busy page to deliver the finger's lift late.
    await arcade.hold(AREA, GATE_MS / 3);
    await page.waitForTimeout(1000);
    expect(await arcade.screen()).toBe('home');
    await expect(arcade.grownUps()).toBeHidden();

    expect(await arcade.openGrownUps()).toBeGreaterThanOrEqual(GATE_MS);
    await expect(arcade.grownUps()).toBeVisible();
  });

  test('the Grown-Ups Area cannot be reached while a Game is loading, played, paused or showing its Result', async ({
    arcade,
    page,
  }) => {
    test.slow();
    await arcade.open();
    await arcade.start();
    const session = sessionFor(FIRST, FIRST.playStyles[0]!);
    const refused = async (state: string) => {
      expect(await arcade.host()).toBe(state);
      await arcade.call('openGrownUps');
      await page.waitForTimeout(500);
      expect(await arcade.screen(), state).not.toBe(AREA);
      await expect(arcade.grownUps(), state).toBeHidden();
    };

    // Asked in the same moment the Session opens, before the Game has loaded.
    const loading = await page.evaluate((session) => {
      window.whimigo!.open(session, 1);
      const state = window.whimigo!.screen().host;
      window.whimigo!.openGrownUps();
      return state;
    }, session);
    expect(loading).toBe('loading');
    await arcade.skipDemo();
    expect(await arcade.screen()).toBe(FIRST.id);
    await refused('playing');
    await arcade.hide();
    await expect.poll(() => arcade.screen()).toBe('pause');
    await arcade.show();
    await refused('paused');
    await arcade.call('finish', { kind: 'draw' });
    await expect.poll(() => arcade.screen()).toBe('result');
    await refused('showing-result');
    await arcade.tap('home');
    await expect.poll(() => arcade.screen()).toBe('home');

    await arcade.call('openGrownUps');
    await expect.poll(() => arcade.screen(), 'idle again: it opens').toBe(AREA);
  });
});

test.describe('the Grown-Ups Area', () => {
  test('is HTML over the whole screen, the canvas takes no touches while it shows, and Back returns home', async ({
    arcade,
    page,
  }) => {
    await arcade.open();
    const area = await openArea(arcade);
    expect(await area.boundingBox()).toEqual({ x: 0, y: 0, ...page.viewportSize()! });
    await expect(area.getByRole('heading', { level: 1 })).toHaveText('For grown-ups');

    const touches = await countCanvasTouches(page);
    const { width, height } = page.viewportSize()!;
    // Over the page's words and margins, never on one of its controls.
    const heading = (await area.getByRole('heading', { level: 1 }).boundingBox())!;
    for (const [x, y] of [
      [heading.x + heading.width / 2, heading.y + heading.height / 2],
      [width - 20, height - 20],
      [20, 20],
    ] as const) {
      await page.touchscreen.tap(x, y);
    }
    expect(await touches()).toBe(0);
    expect(await arcade.screen()).toBe(AREA);

    await back(arcade);
    await expect(area).toBeHidden();
    await page.touchscreen.tap(width / 2, 20);
    expect(await touches(), 'the canvas takes touches again').toBeGreaterThan(0);
  });

  test('every control is a real button or labelled form control with an accessible name, under a heading', async ({
    arcade,
  }) => {
    await arcade.open();
    const area = await openArea(arcade);
    // The questions Reset Progress asks are shown too. Update now is offered only when a newer
    // version waits, as the update tests show.
    await area.getByRole('button', { name: 'Reset Progress' }).tap();
    const controls = area.locator('button, input, select, textarea').locator('visible=true');
    expect(await controls.count()).toBeGreaterThan(8);
    for (const control of await controls.all()) {
      await expect(control).toHaveAccessibleName(/\S/);
      const heading = await control.evaluate((element) => {
        const section = element.closest('section[aria-labelledby]');
        const label = section && document.getElementById(section.getAttribute('aria-labelledby')!);
        return label?.tagName ?? null;
      });
      expect(heading, await control.evaluate((element) => element.outerHTML)).toMatch(/^H[12]$/);
    }
    for (const name of ['Sound', 'Motion', 'Updates', 'Progress', 'Status', 'Check screens']) {
      await expect(area.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect(area.getByRole('checkbox', { name: 'Sound on' })).toBeVisible();
    const motion = area.getByRole('group', { name: 'Reduce motion' });
    for (const name of ['As the tablet asks', 'On', 'Off']) {
      await expect(motion.getByRole('radio', { name, exact: true })).toBeVisible();
    }
  });
});

test.describe('sound', () => {
  test('switched off, no sound starts; switched on again, a requested sound starts; the setting survives a reload', async ({
    arcade,
  }) => {
    await arcade.open();
    let area = await openArea(arcade);
    await expect(
      area.getByText('The tablet’s silent mode also silences the Arcade.'),
    ).toBeVisible();
    const sound = area.getByRole('checkbox', { name: 'Sound on' });
    await expect(sound).toBeChecked();
    await expect.poll(() => arcade.audio()).toBe('running');
    expect((await arcade.call('playSound', 'tap')).started).toBe(true);

    await sound.uncheck();
    await back(arcade);
    expect(await arcade.call('save')).toMatchObject({ sound: false });
    const started = await arcade.call('soundsStarted');
    expect((await arcade.call('playSound', 'tap')).started).toBe(false);
    expect(await arcade.call('soundsStarted')).toBe(started);

    await arcade.open();
    area = await openArea(arcade);
    await expect.poll(() => arcade.audio()).toBe('running');
    expect((await arcade.call('playSound', 'tap')).started, 'still off after a reload').toBe(false);
    await expect(sound).not.toBeChecked();
    await sound.check();
    await back(arcade);
    expect((await arcade.call('playSound', 'tap')).started).toBe(true);
  });
});

test.describe('motion', () => {
  const CASES = [
    { setting: 'As the tablet asks', value: 'system', device: 'reduce', motion: 'reduced' },
    { setting: 'As the tablet asks', value: 'system', device: 'no-preference', motion: 'full' },
    { setting: 'On', value: 'on', device: 'no-preference', motion: 'reduced' },
    { setting: 'Off', value: 'off', device: 'reduce', motion: 'full' },
  ] as const;

  for (const { setting, value, device, motion } of CASES) {
    test(`set to ${value} with the device asking for ${device}, the next Round's motion is ${motion}, after a reload too`, async ({
      arcade,
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: device });
      await arcade.open();
      let area = await openArea(arcade);
      await area.getByRole('radio', { name: setting, exact: true }).check();
      await back(arcade);
      expect(await motionOfNextRound(arcade)).toBe(motion);
      await closeRound(arcade);

      await arcade.open();
      area = await openArea(arcade);
      await expect(area.getByRole('radio', { name: setting, exact: true })).toBeChecked();
      expect((await arcade.call('save')).motion ?? 'system').toBe(value);
      await back(arcade);
      expect(await motionOfNextRound(arcade)).toBe(motion);
    });
  }
});

test.describe('Update now', () => {
  test('is not offered when no newer version is waiting', async ({ arcade }) => {
    await arcade.open();
    await expect.poll(() => arcade.call('offlineReady')).toBe(true);
    const area = await openArea(arcade);
    await expect(area.getByText('No update waiting', { exact: true })).toBeVisible();
    await expect(area.getByRole('button', { name: 'Update now' })).toBeHidden();
  });
});

test.describe('Reset Progress', () => {
  test('asks twice, and declining at either question leaves the save document unchanged', async ({
    arcade,
  }) => {
    await openWithSave(arcade, PLAYED);
    const area = await openArea(arcade);
    const reset = area.getByRole('button', { name: 'Reset Progress' });
    const yes = area.getByRole('button', { name: 'Yes, reset' });
    const no = area.getByRole('button', { name: 'No, keep Progress' });

    await reset.tap();
    await expect(area.getByText(/^Reset Progress\?/)).toBeVisible();
    await no.tap();
    expect(await arcade.call('save')).toEqual(PLAYED);

    await reset.tap();
    await yes.tap();
    await expect(area.getByText('Are you sure? This cannot be undone.')).toBeVisible();
    await no.tap();
    expect(await arcade.call('save')).toEqual(PLAYED);
    await expect(yes).toBeHidden();
  });

  test('accepted twice, no Mascot has Stars and no Game remembered choices; sound, motion and Seating are unchanged, after a reload too', async ({
    arcade,
  }) => {
    await openWithSave(arcade, PLAYED);
    const area = await openArea(arcade);
    await area.getByRole('button', { name: 'Reset Progress' }).tap();
    await area.getByRole('button', { name: 'Yes, reset' }).tap();
    await area.getByRole('button', { name: 'Yes, reset' }).tap();
    await expect(area.getByText('Progress was reset.')).toBeVisible();

    const check = (save: SaveDocument) => {
      expect(save.mascots).toEqual({});
      expect(Object.values(save.games).some((game) => game.choices)).toBe(false);
      expect(save).toMatchObject({ seating: 'around-the-table', sound: false, motion: 'on' });
    };
    check(await arcade.call('save'));
    await arcade.open();
    check(await arcade.call('save'));
  });
});

/**
 * Every Phaser screen, and how to reach it from a load with Progress saved: the Arcade's own screens,
 * a Round of every Game in every Play Style, and every check screen.
 */
const PHASER_SCREENS: readonly { readonly name: string; reach(arcade: Arcade): Promise<string> }[] =
  [
    { name: 'start', reach: async () => 'start' },
    {
      name: 'home',
      async reach(arcade) {
        await arcade.start();
        return 'home';
      },
    },
    ...CATALOG.map((game) => ({
      name: `${game.id} lobby`,
      async reach(arcade: Arcade) {
        await arcade.start();
        await arcade.tap(game.id);
        await expect.poll(() => arcade.screen()).toBe('lobby');
        return 'lobby';
      },
    })),
    ...EVERY_STYLE.map(({ game, style, name }) => ({
      name: `${name} Round`,
      async reach(arcade: Arcade) {
        await arcade.start();
        await openSession(arcade, sessionFor(game, style), 7);
        return game.id;
      },
    })),
    {
      name: 'pause',
      async reach(arcade) {
        await arcade.start();
        await openSession(arcade, sessionFor(FIRST, FIRST.playStyles[0]!), 7);
        await arcade.hideAndShow();
        await expect.poll(() => arcade.screen()).toBe('pause');
        return 'pause';
      },
    },
    {
      name: 'result',
      async reach(arcade) {
        await arcade.start();
        await openSession(arcade, sessionFor(FIRST, FIRST.playStyles[0]!), 7);
        await arcade.call('finish', { kind: 'draw' });
        await expect.poll(() => arcade.screen()).toBe('result');
        return 'result';
      },
    },
    ...['touch-check', 'sound-check', 'performance-check'].map((id) => ({
      name: id,
      async reach(arcade: Arcade) {
        await arcade.start();
        await arcade.openCheck(id);
        return id;
      },
    })),
  ];

test.describe('Progress on the Phaser screens', () => {
  for (const { name, reach } of PHASER_SCREENS) {
    test(`${name}: no target removes Progress`, async ({ arcade }) => {
      test.slow();
      const kept = (save: SaveDocument, tapped: string) => {
        for (const [mascot, { stars }] of Object.entries(PLAYED.mascots)) {
          expect(save.mascots[mascot]?.stars ?? 0, `${tapped}: ${mascot}`).toBeGreaterThanOrEqual(
            stars,
          );
        }
        expect(save.games[FIRST.id]?.choices, tapped).toBeDefined();
      };
      await openWithSave(arcade, PLAYED);
      const id = await reach(arcade);
      const targets = Object.keys((await arcade.snapshot()).targets);
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) {
        if ((await arcade.screen()) !== id) {
          await openWithSave(arcade, PLAYED);
          await reach(arcade);
        }
        await arcade.tap(target);
        // Long enough for a screen the tap opens to begin changing.
        await arcade.page.waitForTimeout(500);
        kept(await arcade.call('save'), target);
      }
    });
  }
});

test.describe('status', () => {
  test('shows the build identifier the bridge reports, ready to play offline once the bridge says so, a browser tab with the install steps as pictures, and the storage state', async ({
    arcade,
  }) => {
    await arcade.open();
    await expect.poll(() => arcade.call('offlineReady')).toBe(true);
    const area = await openArea(arcade);
    const buildId = await arcade.page.evaluate(() => window.whimigo!.buildId);
    await expect(area.getByText(buildId, { exact: true })).toBeVisible();
    await expect(area.getByText('Ready to play offline', { exact: true })).toBeVisible();
    await expect(area.getByText('Browser tab', { exact: true })).toBeVisible();
    await expect(area.locator('[data-reading="storage"]')).toHaveText(/^(Persistent|Best-effort):/);
    const steps = area.getByRole('heading', { name: 'Installing the Arcade' });
    await expect(steps).toBeVisible();
    expect(await area.locator('ol.install').getByRole('img').count()).toBeGreaterThanOrEqual(3);
  });

  test('installed, it says so and shows no install steps', async ({ arcade, page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }),
    );
    await arcade.open();
    const area = await openArea(arcade);
    await expect(area.getByText('Installed app', { exact: true })).toBeVisible();
    await expect(area.getByRole('heading', { name: 'Installing the Arcade' })).toBeHidden();
    await expect(area.locator('ol.install')).toBeHidden();
  });

  test('the Arcade asks the browser for persistent storage once, at start-up', async ({
    arcade,
    page,
  }) => {
    await page.addInitScript(() => {
      const storage = navigator.storage;
      const persist = storage.persist.bind(storage);
      Object.assign(window, { persistRequests: 0 });
      storage.persist = () => {
        (window as unknown as { persistRequests: number }).persistRequests += 1;
        return persist();
      };
    });
    await arcade.open();
    const requests = () =>
      page.evaluate(() => (window as unknown as { persistRequests: number }).persistRequests);
    expect(await requests()).toBe(1);
    await openArea(arcade);
    await back(arcade);
    await arcade.openGrownUps();
    expect(await requests()).toBe(1);
  });

  test('lists the last few error messages, and sends nothing anywhere', async ({
    arcade,
    page,
  }) => {
    await arcade.open();
    const area = await openArea(arcade);
    const errors = area.locator('[data-reading="errors"]');
    await expect(errors).toHaveText('None');
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await arcade.call('rejectUnhandled');
    await expect(errors).toHaveText('Rejected on purpose by the test bridge');
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
  });

  test('shows the safe-area insets the browser reports', async ({ arcade, page }) => {
    const cdp: CDPSession = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 24, right: 0, bottom: 20, left: 12 },
    });
    await arcade.open();
    const area = await openArea(arcade);
    await expect(area.getByText('Top 24 px, right 0 px, bottom 20 px, left 12 px')).toBeVisible();
  });

  test('shows the screen as the browser measures it, and each change of size as it happens', async ({
    arcade,
    page,
  }) => {
    await arcade.open();
    const area = await openArea(arcade);
    const now = area.locator('[data-reading="screen"]');
    const changes = area.locator('[data-reading="screen-changes"]');
    const { width, height } = page.viewportSize()!;
    await expect(now).toContainText(`Window ${width} × ${height}`);
    await expect(now).toContainText(`Arcade box ${width} × ${height}`);
    await expect(now).toContainText(await canvasSizes(page));
    await expect(changes).toContainText(`start: window ${width} × ${height}`);

    // Turned to portrait while the Area shows: it follows, and the change is listed as it happens.
    await page.setViewportSize({ width: height, height: width });
    await expect(now).toContainText(`Window ${height} × ${width}`);
    await expect(now).toContainText(`Arcade box ${height} × ${width}`);
    await expect
      .poll(async () => (await now.textContent())!.includes(await canvasSizes(page)))
      .toBe(true);
    await expect(changes).toContainText(new RegExp(`\\d s resize: window ${height} × ${width}`));
    await expect(changes).toContainText(`settled: window ${height} × ${width}`);
  });

  test.describe('without a service worker', () => {
    test.use({ serviceWorkers: 'block' });

    test('says the Arcade is not ready offline, as the bridge does', async ({ arcade }) => {
      await arcade.open();
      const area = await openArea(arcade);
      await expect(area.getByText('Not ready offline yet', { exact: true })).toBeVisible();
      expect(await arcade.call('offlineReady')).toBe(false);
    });
  });
});

/** Storage that is missing, or that throws on every write, installed before the Arcade loads. */
const BROKEN_STORAGE = {
  missing: () =>
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    }),
  'throwing on every write': () => {
    Storage.prototype.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  },
} as const;

for (const [name, breakStorage] of Object.entries(BROKEN_STORAGE)) {
  test(`with storage ${name}, the Arcade plays normally, Stars add up during the visit, and the Area reports memory-only`, async ({
    arcade,
    page,
  }) => {
    test.slow();
    await page.addInitScript(breakStorage);
    await arcade.open();
    await arcade.start();
    for (const round of [1, 2]) {
      await openSession(arcade, sessionFor(FIRST, FIRST.playStyles[0]!), round);
      await playToResult(arcade, FIRST.id);
      await expect.poll(() => arcade.screen()).toBe('result');
      await arcade.tap('home');
      await expect.poll(() => arcade.screen()).toBe('home');
    }
    const { mascots } = await arcade.call('save');
    const total = Object.values(mascots).reduce((sum, { stars }) => sum + stars, 0);
    expect(total, 'at least a Star a Player for each of two Rounds').toBeGreaterThanOrEqual(4);

    await arcade.openGrownUps();
    await expect(arcade.grownUps().locator('[data-reading="storage"]')).toHaveText(
      /^Memory-only: .*Progress will not be kept/,
    );
  });
}

/** The canvas as the page lays it out, in CSS pixels, and its size in pixels. */
async function canvasSizes(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#arcade canvas') as HTMLCanvasElement;
    const box = canvas.getBoundingClientRect();
    return `Canvas ${Math.round(box.width)} × ${Math.round(box.height)} (${canvas.width} × ${canvas.height} pixels)`;
  });
}
