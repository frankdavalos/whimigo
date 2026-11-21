import type * as Phaser from 'phaser';
import type { Session, Stage } from '@/contract';
import { DESIGN_FRAME, safeRect, type Insets } from './frame';
import { renderScaleOf } from './render-scale';
import { cssColor } from './theme';
import { roundZones, zonePlacement } from './zones';

export type { BackdropFill, Stage } from '@/contract';

/**
 * Points the Scene's one camera at the design frame, zoomed to the render scale, and keeps it
 * centred when the screen changes size; works out the safe rectangle from the safe-area insets the
 * device reports, which are in CSS pixels. A Round's Stage has its Session's Zones; a screen's has
 * none.
 */
export function createStage(
  scene: Phaser.Scene,
  reportedCssInsets: Insets,
  session?: Pick<Session, 'zoned' | 'seating' | 'seats'>,
): Stage {
  const camera = scene.cameras.main;
  const renderScale = renderScaleOf(scene.game);
  const centre = () =>
    camera
      .setZoom(renderScale)
      .centerOn(DESIGN_FRAME.x + DESIGN_FRAME.width / 2, DESIGN_FRAME.y + DESIGN_FRAME.height / 2);
  centre();
  scene.scale.on('resize', centre);
  scene.events.once('shutdown', () => scene.scale.off('resize', centre));

  const unitsPerCssPixel = scene.scale.displayScale.x / renderScale;
  const inUnits = (css: number) => css * unitsPerCssPixel;
  const safe = safeRect({
    top: inUnits(reportedCssInsets.top),
    right: inUnits(reportedCssInsets.right),
    bottom: inUnits(reportedCssInsets.bottom),
    left: inUnits(reportedCssInsets.left),
  });
  const zones = session ? roundZones(safe, session) : [];
  const containers = new Map<number, Phaser.GameObjects.Container>();
  return {
    safe,
    backdrop(fill) {
      camera.setBackgroundColor(cssColor(fill.color));
    },
    zones,
    zoneContainer(seat) {
      const zone = zones.find((candidate) => candidate.seat === seat);
      if (!zone) throw new Error(`Seat ${seat} has no Zone`);
      let container = containers.get(seat);
      if (!container) {
        const { x, y, angle } = zonePlacement(zone);
        container = scene.add.container(x, y).setAngle(angle);
        containers.set(seat, container);
      }
      return container;
    },
  };
}
