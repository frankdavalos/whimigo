import type * as Phaser from 'phaser';
import type { Round, RoundSnapshot, RoundStart, SeatTouchReport, Stage } from '@/contract';
import { createDemo } from './demo';
import { holdButton } from './controls';
import { createMotion } from './motion';
import { createRng } from './rng';
import { createSeatZones, type SeatZonesState } from './seat-zones';
import type { TouchInput } from './seat-touches';
import { createStage } from './stage';
import { onTouchesReset } from './touches';
import { pausePlace } from './zones';

const NOTHING_EXPOSED: RoundSnapshot = { state: null, targets: {} };

/** Above anything a Game draws, so nothing hides the pause control or takes its touches. */
const PAUSE_DEPTH = 1_000_000;
/** The Demo plays above the Game and below the pause control, which works while it plays. */
const DEMO_DEPTH = PAUSE_DEPTH - 1;
/** Below anything a Game draws: a Zone takes the touches that nothing of the Game's above it takes. */
const ZONE_DEPTH = -PAUSE_DEPTH;
/** How many of SeatZones' reports the test bridge sees. */
const REPORTED = 20;

/**
 * The first thing a Game's Scene does in `create`: turns what the Arcade started it with into the
 * Round's toolkit (its Session, Stage, random source, sound, motion and Demo), mounts the pause
 * control halfway down the safe rectangle's left edge, and tells the Arcade the Round has opened.
 * There is no base class to extend.
 */
export function openRound(scene: Phaser.Scene, start: RoundStart): Round {
  const { host } = start;
  const stage = createStage(scene, host.insets(), start.session);
  const { safe } = stage;
  const { target: pause } = holdButton(scene, {
    ...pausePlace(safe),
    icon: 'arcade/pause',
    onHold: () => host.pause(),
    depth: PAUSE_DEPTH,
  });
  const motion = createMotion(scene, host.reducedMotion());
  const demo = createDemo(scene, { safe, motion, depth: DEMO_DEPTH });
  const { seatZones, report } = listenToZones(scene, stage, () => demo.covering);

  // The Round's own time: Scene frames only, and none while the Demo plays.
  let now = 0;
  const tick = (_time: number, delta: number) => {
    if (!demo.playing) now += delta;
  };
  scene.events.on('preupdate', tick);
  scene.events.once('shutdown', () => scene.events.off('preupdate', tick));

  let describe = () => NOTHING_EXPOSED;
  let finished = false;
  let refusals = 0;
  host.opened(scene, stage, {
    snapshot() {
      const { state, targets } = describe();
      return { state, targets: { ...targets, pause } };
    },
    demo: () => demo.report(),
    refusals: () => refusals,
    showDemo: () => demo.replay(),
    now: () => now,
    seatTouches: report,
  });
  return {
    session: start.session,
    stage,
    rng: createRng(start.seed),
    number: start.number,
    motion,
    seatZones,
    now: () => now,
    audio: {
      sfx(key) {
        if (!finished) host.sfx(key, scene.time.now);
      },
    },
    demo: (steps) => demo.run(steps, start.number === 0),
    get demoPlaying() {
      return demo.playing;
    },
    refuse(target) {
      if (finished) return;
      refusals += 1;
      void motion.play(target, 'wiggle');
    },
    finish(result) {
      if (finished) return;
      finished = true;
      host.finish(result);
    },
    expose(snapshot) {
      describe = snapshot;
    },
  };
}

/**
 * SeatZones for a Round's Zones, heard through an invisible rectangle over each Zone beneath
 * everything the Game draws, so that something of the Game's above a Zone keeps its touches. No
 * touch comes down in a Zone while `covered` (the Demo's cover is up): when several fingers land
 * at once, Phaser does not reliably give each to the topmost object, so the cover cannot be
 * trusted to keep them from the Zones by itself. Lifts are heard wherever they happen, and every
 * touch is forgotten when the Scene's touches must be. Its latest reports are kept for the test
 * bridge.
 */
function listenToZones(
  scene: Phaser.Scene,
  stage: Stage,
  covered: () => boolean,
): { seatZones: SeatZonesState; report: () => SeatTouchReport } {
  const seatZones = createSeatZones(stage.zones);
  const reported: SeatTouchReport['events'][number][] = [];
  const log = (event: SeatTouchReport['events'][number]) => {
    reported.push(event);
    if (reported.length > REPORTED) reported.shift();
  };
  seatZones.onDown(({ seat }) => log({ kind: 'down', seat }));
  seatZones.onUp(({ seat, canceled }) => log({ kind: canceled ? 'cancel' : 'up', seat }));
  const feed = (kind: TouchInput['kind'], pointer: Phaser.Input.Pointer, time: number) => {
    const at = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    seatZones.input({ kind, id: pointer.id, x: at.x, y: at.y, time });
  };
  for (const { rect } of stage.zones) {
    scene.add
      .rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
      .setDepth(ZONE_DEPTH)
      .setInteractive()
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!covered()) feed('down', pointer, pointer.downTime);
      });
  }
  const lift = (pointer: Phaser.Input.Pointer) =>
    feed(pointer.wasCanceled ? 'cancel' : 'up', pointer, pointer.upTime);
  scene.input.on('pointerup', lift);
  scene.input.on('pointerupoutside', lift);
  onTouchesReset(scene, () => seatZones.reset());
  scene.events.once('shutdown', () => {
    scene.input.off('pointerup', lift);
    scene.input.off('pointerupoutside', lift);
  });
  return {
    seatZones,
    report: () => ({ held: seatZones.held(), events: [...reported] }),
  };
}
