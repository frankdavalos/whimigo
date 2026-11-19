import type { CheckScreen } from '../screen';
import { blankCheck } from './blank-check';
import { soundCheck } from './sound-check';
import { touchCheck } from './touch-check';

/**
 * The check screens the Home Screen lists, in order. They are tools for grown-ups and stay in the
 * product; the blank one exists only for automated tests.
 */
export function checkScreens(options: { readonly e2e: boolean }): readonly CheckScreen[] {
  return options.e2e ? [touchCheck, soundCheck, blankCheck] : [touchCheck, soundCheck];
}
