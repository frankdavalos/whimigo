import * as Phaser from 'phaser';
import type { DemoStep, RoundStart, SeatIndex, SnapshotTarget, Zone } from '@/contract';
import { picture } from '@/kit/atlas';
import { touchArea } from '@/kit/control-areas';
import { openRound } from '@/kit/round';
import { colors } from '@/kit/theme';
import { fromZoneLocal } from '@/kit/zones';
import { advance, press, result, showingAt, start, type Rush, type Showing } from '../logic/rules';
import { BUTTON, DECOYS, LAMP, SIGNAL } from '../pictures';

/** Sizes in design units: the button each Seat presses, and the Seat's shape on it. */
const BUTTON_SIZE = 400;
const SHAPE_SIZE = 200;
/** A point won is a Star; three Stars in a row, or a column beside the button in a wide Zone. */
const STAR_SIZE = 100;
const STAR_STEP = 124;
/** How a Seat that pressed too early, or a point not yet won, is shown: faded. */
const FADED = 0.3;
/** How strongly a Zone shows its Seat's colour behind everything in it. */
const ZONE_TINT = 0.18;
/** The edge left between a Zone's colour and its neighbour's. */
const ZONE_EDGE = 16;

/** Where a Seat's lamp, button and Stars stand in its Zone, in Zone-local coordinates. */
function layoutOf(zone: Zone) {
  const { width: w, height: h } = zone.rect;
  const steps = [-1, 0, 1];
  if (h >= w) {
    return {
      lamp: { x: w / 2, y: h * 0.25 },
      button: { x: w / 2, y: h * 0.56 },
      stars: steps.map((i) => ({ x: w / 2 + i * STAR_STEP, y: h * 0.8 })),
    };
  }
  return {
    lamp: { x: w / 2, y: h * 0.27 },
    button: { x: w / 2, y: h * 0.68 },
    stars: steps.map((i) => ({ x: w / 2 + 330, y: h * 0.68 + i * STAR_STEP })),
  };
}

/** The frame a lamp shows for what the point shows. */
const frameOf = (showing: Showing): string => {
  if (showing === 'signal') return SIGNAL.frame;
  if (showing === null) return LAMP;
  return DECOYS[showing.decoy]!.frame;
};

interface SeatView {
  readonly zone: Zone;
  readonly lamp: Phaser.GameObjects.Image;
  readonly button: Phaser.GameObjects.Container;
  readonly stars: readonly Phaser.GameObjects.Image[];
  readonly target: SnapshotTarget;
  /** The lamp's centre, in design units. */
  readonly lampAt: { readonly x: number; readonly y: number };
}

/**
 * Every Seat watches its own lamp and presses its own button the moment the signal shows; a decoy
 * is not the signal. A press anywhere in a Seat's Zone is that Seat's press.
 */
export class ReactionRushScene extends Phaser.Scene {
  /** Moves the Round on, once a frame. */
  private step: () => void = () => undefined;

  override update(): void {
    this.step();
  }

  create(begin: RoundStart): void {
    const round = openRound(this, begin);
    const { session, stage } = round;
    stage.backdrop({ color: colors.butter });

    const views: SeatView[] = stage.zones.map((zone) => {
      const seat = session.seats[zone.seat]!;
      const layout = layoutOf(zone);
      const { width: w, height: h } = zone.rect;
      const tint = this.add.rectangle(
        w / 2,
        h / 2,
        w - ZONE_EDGE,
        h - ZONE_EDGE,
        seat.color,
        ZONE_TINT,
      );
      const lamp = picture(this, layout.lamp.x, layout.lamp.y, LAMP);
      const face = picture(this, 0, 0, BUTTON);
      const shape = picture(this, 0, 0, seat.shape);
      shape.setScale(SHAPE_SIZE / Math.max(shape.width, shape.height));
      const button = this.add.container(layout.button.x, layout.button.y, [face, shape]);
      const stars = layout.stars.map(({ x, y }) => {
        const star = picture(this, x, y, 'arcade/star').setAlpha(FADED);
        return star.setScale(STAR_SIZE / Math.max(star.width, star.height));
      });
      stage.zoneContainer(zone.seat).add([tint, lamp, button, ...stars]);
      const centre = fromZoneLocal(zone, layout.button.x, layout.button.y);
      const rect = touchArea({ ...centre, width: BUTTON_SIZE, height: BUTTON_SIZE });
      return {
        zone,
        lamp,
        button,
        stars,
        target: { ...centre, rect },
        lampAt: fromZoneLocal(zone, layout.lamp.x, layout.lamp.y),
      };
    });
    const viewOf = (seat: SeatIndex) => views.find((view) => view.zone.seat === seat)!;

    let rush = start({
      difficulty: session.difficulty,
      seats: session.seats.length,
      rng: round.rng,
      at: round.now(),
    });
    // Easy: the signal shows, and the hand presses one Seat's button, then another's. Medium and
    // Hard: the hand points at a decoy in the first Seat's lamp and refuses it, then presses the
    // button of a Seat whose lamp shows the signal.
    const [first, second] = views;
    const decoys = session.difficulty !== 'easy';
    const steps: DemoStep[] = decoys
      ? [{ wait: 800 }, { refuse: first!.lampAt }, { wait: 800 }, { tap: second!.target }]
      : [{ wait: 800 }, { tap: first!.target }, { wait: 800 }, { tap: second!.target }];
    const demoFrame = (i: number) => (decoys && i === 0 ? DECOYS[0].frame : SIGNAL.frame);

    /** What the Round shows in every lamp, and whether the lamps show the Demo's pictures instead. */
    let shown = LAMP;
    let showingDemo = false;

    /**
     * Draws the lamps: the Demo's pictures while it plays, otherwise what the Round shows, asking
     * for each new picture's sound as it is drawn.
     */
    const drawLamps = (now: number) => {
      const showing = showingAt(rush, now);
      const frame = frameOf(showing);
      const changed = frame !== shown;
      shown = frame;
      if (round.demoPlaying) {
        if (!showingDemo) views.forEach((view, i) => view.lamp.setFrame(demoFrame(i)));
        showingDemo = true;
        return;
      }
      if (!changed && !showingDemo) return;
      showingDemo = false;
      for (const view of views) view.lamp.setFrame(frame);
      if (!changed) return;
      if (showing === 'signal') round.audio.sfx('reaction-rush/signal');
      else if (showing !== null) round.audio.sfx('reaction-rush/decoy');
    };

    /** Brings what is drawn up to date with the Round. */
    const apply = (next: Rush, now: number) => {
      const was = rush;
      rush = next;
      drawLamps(now);
      if (rush.point !== was.point) {
        for (const view of views) view.button.setAlpha(1);
      }
      const decided =
        was.phase !== rush.phase && (rush.phase === 'between' || rush.phase === 'over');
      if (!decided) return;
      for (const seat of rush.winners) {
        const view = viewOf(seat);
        view.stars.forEach((star, i) => star.setAlpha(i < rush.scores[seat]! ? 1 : FADED));
        void round.motion.play(view.button, 'pop');
      }
      if (rush.winners.length > 0) round.audio.sfx('reaction-rush/point');
      const ended = result(rush);
      if (!ended) return;
      if (ended.kind === 'win') round.audio.sfx('win');
      round.finish(ended);
    };

    round.seatZones.onDown((touch) => {
      const now = round.now();
      const pressing = press(rush, touch.seat, { time: touch.time, now });
      const { button } = viewOf(touch.seat);
      if (pressing.outcome === 'ignored') {
        round.refuse(button);
        return;
      }
      if (pressing.outcome === 'false-start') {
        round.audio.sfx('wrong');
        button.setAlpha(FADED);
      } else {
        round.audio.sfx('tap');
      }
      apply(pressing.rush, now);
    });

    this.step = () => {
      const now = round.now();
      apply(advance(rush, now), now);
    };

    void round.demo(steps);

    const targets = Object.fromEntries(
      views.map((view) => [`button-${view.zone.seat}`, view.target]),
    );
    round.expose(() => {
      const showing = showingAt(rush, round.now());
      return {
        state: {
          phase: rush.phase,
          point: rush.point,
          showing: showing === null || showing === 'signal' ? showing : `decoy-${showing.decoy}`,
          winners: rush.winners,
          seats: session.seats.map(({ index, shape, color }) => ({
            seat: index,
            shape,
            color,
            score: rush.scores[index],
            out: rush.out.includes(index),
            lamp: viewOf(index).lampAt,
          })),
          result: result(rush),
        },
        targets,
      };
    });
  }
}
