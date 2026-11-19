import type { CheckScreen } from '../screen';
import { blankCheck } from './blank-check';

/** The check screens the Home Screen lists, in order. The blank one exists only for tests. */
export function checkScreens(options: { readonly e2e: boolean }): readonly CheckScreen[] {
  return options.e2e ? [blankCheck] : [];
}
