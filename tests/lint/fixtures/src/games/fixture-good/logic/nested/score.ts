import { start } from '../rules';

export const scoreOf = (state: ReturnType<typeof start>) => state.first;
