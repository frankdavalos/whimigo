import type { Difficulty, Result, Rng, SeatIndex } from '@/contract';
import { createRng } from './rng';

/** How a Turn-Based Round begins. */
export interface TurnSetup {
  readonly seats: number;
  readonly difficulty: Difficulty;
  readonly seed: number;
  /** The Seat that moves first; it alternates from one Round of a Session to the next. */
  readonly first: SeatIndex;
}

/**
 * The convention for a Game whose Seats take Turns making Moves (game contract). The shared rules
 * check and, from Phase 2, the shared Computer Player search are written against it.
 */
export interface TurnRules<State, Move> {
  start(setup: TurnSetup): State;
  /** The Seat whose Turn it is. */
  seatToMove(state: State): SeatIndex;
  legalMoves(state: State): Move[];
  /** Returns a new State and never changes the one it is given. Throws on an illegal Move. */
  apply(state: State, move: Move): State;
  /** Null while the Round is in progress. */
  result(state: State): Result | null;
}

/** Chooses a Move for a Computer Player. Pure: all randomness comes from `rng`. */
export type ComputerPlayer<State, Move> = (state: State, difficulty: Difficulty, rng: Rng) => Move;

export interface TurnRulesCheck {
  /** Numbers of Seats to play with. */
  readonly seats?: readonly number[];
  /** Seeded random Rounds for each number of Seats. */
  readonly rounds?: number;
  /** A Round that has not ended after this many Moves never will. */
  readonly maxMoves?: number;
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** The Seats a Result names, as winners or in its scores. */
function seatsNamed(result: Result): number[] {
  const scored = 'scores' in result && result.scores ? Object.keys(result.scores).map(Number) : [];
  return [...(result.kind === 'win' ? result.winners : []), ...scored];
}

/**
 * Plays many seeded random Rounds and returns what the rules got wrong, once per kind of fault;
 * an empty list means they pass. A Turn-Based Game opts in with one line in its tests:
 * `expect(checkTurnRules(rules, { seats: [2] })).toEqual([])`.
 */
export function checkTurnRules<State, Move>(
  rules: TurnRules<State, Move>,
  { seats = [2], rounds = 200, maxMoves = 1000 }: TurnRulesCheck = {},
): string[] {
  const problems = new Set<string>();
  for (const count of seats) {
    for (let round = 0; round < rounds; round += 1) {
      const rng = createRng(round * 7919 + count);
      let state = rules.start({
        seats: count,
        difficulty: rng.pick(DIFFICULTIES),
        seed: rng.int(0, 2 ** 31),
        first: rng.int(0, count - 1) as SeatIndex,
      });
      let ended = false;
      for (let moves = 0; moves <= maxMoves && !ended; moves += 1) {
        const result = rules.result(state);
        if (result) {
          ended = true;
          if (seatsNamed(result).some((seat) => seat >= count)) {
            problems.add(`a Result named a Seat not in the Session of ${count}`);
          }
          break;
        }
        const seat = rules.seatToMove(state);
        if (!Number.isInteger(seat) || seat < 0 || seat >= count) {
          problems.add(`gave the Turn to Seat ${seat} in a Session of ${count}`);
          break;
        }
        const legal = rules.legalMoves(state);
        if (legal.length === 0) {
          problems.add('there was no legal Move before a Result');
          break;
        }
        const before = JSON.stringify(state);
        const next = rules.apply(state, rng.pick(legal));
        if (JSON.stringify(state) !== before) {
          problems.add('apply changed the state it was given');
          break;
        }
        state = next;
      }
      if (!ended && problems.size === 0) {
        problems.add(`a Round did not end within ${maxMoves} Moves`);
      }
      if (problems.size > 0) return [...problems];
    }
  }
  return [...problems];
}
