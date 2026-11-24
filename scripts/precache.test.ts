import { describe, expect, it } from 'vitest';
import { GAME_BUDGET_BYTES, PRECACHE_BUDGET_BYTES, budgetProblems } from './precache';

const MB = 1_000_000;

/** A build with one Game of the given size, split between its chunk and its atlas. */
const build = (gameBytes: number, otherBytes = 2 * MB) => [
  { path: 'index.html', size: 10_000 },
  { path: 'assets/index-BeGcJfKb.js', size: otherBytes },
  { path: 'assets/tic-tac-toe-C5GtBO0F.js', size: gameBytes / 2 },
  { path: 'assets/tic-tac-toe-BhDE2CnQ.png', size: gameBytes / 2 },
];

describe('the size budgets', () => {
  it('are 5 MB a Game and 60 MB in all', () => {
    expect(GAME_BUDGET_BYTES).toBe(5 * MB);
    expect(PRECACHE_BUDGET_BYTES).toBe(60 * MB);
  });

  it('pass a build within both', () => {
    expect(budgetProblems(build(GAME_BUDGET_BYTES), ['tic-tac-toe'])).toEqual([]);
  });

  it('fail, naming the Game, when a Game’s own files are over 5 MB', () => {
    expect(budgetProblems(build(GAME_BUDGET_BYTES + 2), ['tic-tac-toe'])).toEqual([
      `tic-tac-toe: its files are ${GAME_BUDGET_BYTES + 2} bytes, over the ${GAME_BUDGET_BYTES} a Game may have`,
    ]);
  });

  it('fail when the whole precache is over 60 MB', () => {
    const files = build(MB, PRECACHE_BUDGET_BYTES);
    const total = files.reduce((sum, file) => sum + file.size, 0);
    expect(budgetProblems(files, ['tic-tac-toe'])).toEqual([
      `the precache is ${total} bytes, over the ${PRECACHE_BUDGET_BYTES} it may have`,
    ]);
  });

  it('fail when a Game has no files of its own in the build, so it cannot be measured', () => {
    expect(budgetProblems(build(MB), ['tic-tac-toe', 'color-echo'])).toEqual([
      'color-echo: the build has no files named for it',
    ]);
  });

  it('count only the files named for a Game, not those of a Game whose id begins the same way', () => {
    const files = [
      { path: 'assets/color-AAAAAAAA.js', size: MB },
      { path: 'assets/color-echo-BWY_4nNm.png', size: GAME_BUDGET_BYTES },
    ];
    expect(budgetProblems(files, ['color', 'color-echo'])).toEqual([]);
  });
});
