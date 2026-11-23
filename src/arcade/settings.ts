import type { MotionSetting, SaveDocument } from '@/platform/save-store';

export type { MotionSetting } from '@/platform/save-store';

/** The motion settings, in the order the Grown-Ups Area offers them. */
export const MOTION_SETTINGS: readonly MotionSetting[] = ['system', 'on', 'off'];

/** What the grown-ups have set, with the defaults for what they have not. */
export interface Settings {
  readonly sound: boolean;
  readonly motion: MotionSetting;
}

export function settingsOf(document: SaveDocument): Settings {
  return { sound: document.sound ?? true, motion: document.motion ?? 'system' };
}

export function withSound(document: SaveDocument, sound: boolean): SaveDocument {
  return { ...document, sound };
}

export function withMotion(document: SaveDocument, motion: MotionSetting): SaveDocument {
  return { ...document, motion };
}

/** Whether motion is reduced: the setting overrides the device, unless it follows it. */
export function motionReduced(setting: MotionSetting, deviceAsks: boolean): boolean {
  return setting === 'system' ? deviceAsks : setting === 'on';
}

/**
 * Progress reset: no Mascot keeps Stars and no Game keeps its count or remembered choices. The
 * Seating, sound and motion settings stay as they were.
 */
export function resetProgress(document: SaveDocument): SaveDocument {
  const { seating, sound, motion } = document;
  return {
    version: 1,
    mascots: {},
    games: {},
    ...(seating === undefined ? {} : { seating }),
    ...(sound === undefined ? {} : { sound }),
    ...(motion === undefined ? {} : { motion }),
  };
}
