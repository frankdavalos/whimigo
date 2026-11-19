# Game Catalog

The eight Games planned for the first release, what each one needs from the Arcade, and the order they ship in. Terms in **bold** are defined in [CONTEXT.md](../../CONTEXT.md).

Player counts in the "Initial target" column are the ones the project started with. The "Recommended" column is the result of checking each against the constraints (a pre-reader, one shared tablet, rounds of one to three minutes). Where the two differ, the reason is given under the Game. Recommendations that change a Game's design are product decisions and are listed again in [Open product decisions](#open-product-decisions).

## Summary

| # | Game | Initial target | Recommended | Play Styles | Ages | Phase |
|---|---|---|---|---|---|---|
| 1 | Tic-Tac-Toe | 1–2 | 1–2 | Versus Computer, Turn-Based | 4+ | 1 |
| 2 | Color Echo | 1–4 | 1–4 | Solo, Turn-Based, Cooperative | 4+ | 1 |
| 3 | Reaction Rush | 2–4 | 2–4 at first, then 1–4 | Simultaneous, later Versus Computer | 4+ | 1 |
| 4 | Memory Match | 1–4 | 1–4 | Solo, Turn-Based, Cooperative | 4+ | 2 |
| 5 | Four in a Row | 1–2 | 1–2 | Versus Computer, Turn-Based | 5+ | 2 |
| 6 | Snakes and Ladders | 1–4 | 1–4 | Versus Computer, Turn-Based | 4+ | 2 |
| 7 | Dots and Boxes | 2–4 | 1–4 | Versus Computer, Turn-Based | 6+ | 2 |
| 8 | Hungry Critters | 2–4 | 1–4 | Simultaneous, Versus Computer | 4+ | 2 |

A child alone at the tablet is the most common situation in a family, so the catalog is checked against it. With the initial targets, three of the eight Games (Dots and Boxes, Reaction Rush, Hungry Critters) cannot be played alone. The recommendations give each of them a **Computer Player** so that all eight can.

## What every Game shares

- A **Round** lasts about one to three minutes. A Game whose classic form runs longer is shortened (see Snakes and Ladders).
- Nothing a child must do depends on reading or on listening to speech. Each Game has a **Demo** showing how to play, and all state is shown with pictures, colour plus shape, motion and synthesized sound.
- **Difficulty** has three levels. Each Game says below what the levels mean for it.
- A draw is celebrated as a shared result, not shown as a failure.
- A **Computer Player** on Easy is meant to lose most of the time to a four-year-old. No level plays perfectly: a child who cannot win stops playing.
- Art for anything on a shared board has no "up": pieces and cards read the same from every side of the tablet, because **Players** may sit around it.

## Phase 1: the three-Game vertical slice

These three were chosen because between them they exercise every shared capability the other five need.

### 1. Tic-Tac-Toe

- **Validates:** rules as pure logic, **Turn** management, a **Computer Player**, the shared-board touch rule.
- **Mechanic:** classic 3×3. Tap an empty cell to place your mark. Marks are the two **Seats'** shapes and colours, not X and O letters.
- **Play Styles:** Versus Computer (1 **Player**), Turn-Based (2 **Players**).
- **Difficulty** (Versus Computer only): Easy picks a random legal **Move**; Medium takes a win or blocks a loss when one is available, otherwise random; Hard searches the full game and makes a deliberate mistake about one **Move** in ten.
- **Round length:** under a minute. The **Seat** that starts alternates each **Round**.
- **Risks:** none significant. This is the reference Game for the Game contract.

### 2. Color Echo

- **Validates:** synthesized sound (the pad tones), the **Demo**, timed sequencing, animation, **Difficulty**, and **Cooperative** play using **Zones**.
- **Mechanic:** the Arcade plays a growing sequence on large pads; the **Players** repeat it. Each pad has its own colour, shape and tone, so the sequence can be followed by sight or by sound.
- **Play Styles:**
  - Solo: one **Player** repeats the sequence until a miss.
  - Turn-Based (2–4): **Seats** take **Turns** repeating the sequence; it grows after every **Seat** has had a go.
  - Cooperative (2–4): each **Seat** owns a pad in its own **Zone** (two pads each when only two play), and the group plays the sequence together.
- **Difficulty:** Easy has three pads, a slow tempo and a starting length of one; Medium has four pads; Hard has four pads and a faster tempo that speeds up.
- **Round length:** one to three minutes. A miss ends a Solo **Round**; in Turn-Based play a miss costs one of three lives rather than eliminating a child on their first error.
- **Risks:** audio must be unlocked and in time with the animation on iPadOS. This is the Game that proves the audio service.

### 3. Reaction Rush

- **Validates:** **Simultaneous** play, multitouch, **Zones**, **Seating**, and fair ordering of near-simultaneous touches.
- **Mechanic:** each **Seat** has one large button in its **Zone**. Everyone waits; when the signal appears (a picture and a sound together), the first **Seat** to tap wins the point. Tapping early is a false start and that **Seat** sits out the point. First to three points wins the **Round**.
- **Play Styles:** Simultaneous (2–4). A Versus Computer style for one **Player**, with a **Computer Player** whose reaction time is drawn from a child-like range, is recommended for Phase 2.
- **Difficulty:** Easy is "tap when the mascot pops up"; Medium adds decoys ("tap for the banana, not the shoe"); Hard shortens the window and adds more decoys. With no speech, the **Demo** has to teach the decoy rule by showing a tap on the right picture and a shake of the head at the wrong one.
- **Fairness:** touches are ordered by the browser's event timestamp, not by the frame they were processed in. Touches closer together than the device can distinguish both score.
- **Round length:** about one minute.
- **Risks:** this Game carries the project's main technical risk. Four fingers on an iPad can trigger system gestures that a web page cannot block, and some budget Android tablets report fewer than four touches. The first is settled on the family's iPad Pro in Phase 0, before this Game is built; the second stays unverified until an Android tablet is available to test. An eight-year-old will usually beat a four-year-old; a per-**Seat** handicap is a possible later addition and is not designed here.

## Phase 2: the remaining five

Listed in recommended build order. Each one reuses what the earlier ones proved.

### 4. Memory Match

- **Mechanic:** a grid of face-down cards; flip two, keep the pair if they match.
- **Play Styles:** Solo (find all pairs in as few flips as possible), Turn-Based for 2–4 (a match earns another **Turn**), Cooperative for 2–4 (find every pair before the flips run out).
- **Difficulty:** Easy is 4 pairs, Medium 6 pairs, Hard 10 pairs.
- **Round length:** one to three minutes.
- **Why first in Phase 2:** it reuses **Turn** management and adds only a grid and a deck.

### 5. Four in a Row

- **Mechanic:** drop discs into a 7×6 grid; four in a line wins. Tap a column to drop.
- **Play Styles:** Versus Computer (1), Turn-Based (2).
- **Difficulty** (Versus Computer): search depth and mistake rate rise from Easy to Hard.
- **Round length:** two to three minutes.
- **Note:** the second Game with a searching **Computer Player**. This is the point at which the game-tree search written for Tic-Tac-Toe is extracted into a shared module, and not before.

### 6. Snakes and Ladders

- **Mechanic:** tap the die, your **Mascot** moves, ladders lift and snakes slide. Pure luck, which makes it the fairest Game across the age range.
- **Play Styles:** Turn-Based (2–4); Versus Computer (1 **Player** plus one **Computer Player**). A single piece on the board alone is not a game, so one **Player** always gets an opponent.
- **Board:** shortened. The classic 100-square board takes ten minutes or more, which breaks the short-session constraint. **Difficulty** selects board length instead of skill: Easy 30 squares, Medium 42, Hard 56. Square numbers are shown but never needed.
- **Round length:** two to four minutes on Easy and Medium. Hard is allowed to run longer.
- **Note:** the die is the first shared use of seeded randomness in a visible, animated form.

### 7. Dots and Boxes

- **Mechanic:** take **Turns** drawing a line between two dots; completing a box claims it and earns another **Turn**.
- **Play Styles:** Turn-Based (2–4). Recommended addition: Versus Computer (1), with a **Computer Player** that takes a box when it can and otherwise avoids giving one away.
- **Difficulty:** grid size. Easy is 2×2 boxes, Medium 3×3, Hard 4×4.
- **Round length:** one to three minutes.
- **Risks:** lines are thin targets. Each line gets a touch area much wider than it looks, and the grid is capped at 4×4 so those areas never overlap on a 10-inch screen. The youngest children may find the strategy hard; hence 6+.

### 8. Hungry Critters

- **Mechanic (recommended design):** each **Seat's** critter sits at the edge of its **Zone** facing a shared pond. Food drifts across the pond. Tap to make your critter lunge and eat what is in front of it. Most food eaten in 60 seconds wins.
- **Why one-touch:** the obvious alternative, steering a critter around a shared field, puts four children's arms across one another on a 10-inch screen and gives each **Seat** two things to manage at once. A critter fixed in its own **Zone** with a single action needs no steering, keeps hands apart, and works for a four-year-old.
- **Play Styles:** Simultaneous (2–4). Recommended addition: Versus Computer for one **Player**, since a **Computer Player** that lunges on a timer with some error is cheap to make.
- **Difficulty:** Easy has slow food only; Medium adds things not to eat; Hard is faster with more of both.
- **Round length:** one minute.
- **Note:** the first Game with continuous motion. It is built last because it is the least like the others.

## Capability coverage

Which shared capability each Game first needs. A capability is built when the first Game that needs it is built, and not earlier.

| Capability | First needed by | Also used by |
|---|---|---|
| Rules as pure logic, **Turn** management | Tic-Tac-Toe | all Turn-Based Games |
| **Computer Player** (search) | Tic-Tac-Toe | Four in a Row, Dots and Boxes |
| Synthesized sound, the **Demo**, timed sequences | Color Echo | all |
| **Cooperative** **Result** | Color Echo | Memory Match |
| **Zones**, **Seating**, multitouch | Reaction Rush (and Cooperative Color Echo) | Hungry Critters |
| Seeded shuffle and dice | Memory Match | Snakes and Ladders, Hungry Critters |
| Shared game-tree search | Four in a Row (extraction) | Dots and Boxes |
| Continuous motion and collisions | Hungry Critters | future arcade Games |

## Open product decisions

Each has a default that the architecture already supports. Changing one changes a Game's design, not the architecture.

1. **Solo access to every Game.** Default: add a **Computer Player** to Reaction Rush, Dots and Boxes and Hungry Critters during Phase 2, so the recommended counts above apply.
2. **Hungry Critters control scheme.** Default: the one-touch lunge design above.
3. **Snakes and Ladders board length.** Default: 30, 42 and 56 squares.
4. **Elimination.** Default: no child is ever removed from a **Round** for a single mistake; lives or sitting out one point are used instead.

## Later candidates

Not designed, and nothing is built for them in advance: cooperative challenges, racing, picture bingo, mazes, drawing, and simple physics arcade Games. The Game contract in [game-contract.md](../architecture/game-contract.md) is checked against these only to confirm that none of them is ruled out.
