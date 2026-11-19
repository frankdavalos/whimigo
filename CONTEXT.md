# Whimigo

Whimigo (Whimsy + Amigo + Go) is a private, tablet-first arcade of short mini-games for children aged 4–8, played by one to four children sharing a single tablet. It exists so a family can hand a tablet to its children and get friendly, offline, ad-free play with no accounts and nothing to configure.

## Constraints

These are product constraints, not preferences. A design that violates one is wrong, however elegant.

- **Ages 4–8.** Assume a pre-reader: nothing a child must do may depend on reading text.
- **One shared tablet, 1–4 local players.** Landscape. iPadOS and Android tablets.
- **Offline after install.** No backend, accounts, ads, analytics, subscriptions, online multiplayer, or cloud dependency.
- **Short sessions.** A **Round** lasts about one to three minutes and replays in one tap.
- **Family project.** Personal use, not a commercial platform. Prefer the simplest thing that is reliable.
- **Made in code.** Through the first release, art is drawn as vector files and sound is synthesized, both written in the repository. Nothing is recorded, illustrated by hand or licensed, and there is no speech.

## Language

### The arcade

**Arcade**:
The whole Whimigo application as a child experiences it: the **Home Screen** plus every **Game**.
_Avoid_: platform, app shell, launcher

**Game**:
One self-contained mini-game in the **Catalog**, such as Tic-Tac-Toe or Reaction Rush.
_Avoid_: mini-game (in code), activity, level, app

**Catalog**:
The fixed list of **Games** the **Arcade** offers.
_Avoid_: library, store, registry (the registry is the code that holds the Catalog)

**Game Card**:
The animated tile on the **Home Screen** that represents one **Game**.
_Avoid_: tile, icon, thumbnail

**Home Screen**:
The first screen of the **Arcade**, showing the **Game Cards**.
_Avoid_: menu, lobby, dashboard

**Grown-Ups Area**:
The adult-only settings and maintenance screen, reached through the **Grown-Up Gate**.
_Avoid_: settings, admin, parent dashboard

**Grown-Up Gate**:
The deliberate gesture (a long press) that a young child is unlikely to perform by accident, guarding the **Grown-Ups Area**.
_Avoid_: parental lock, PIN, password

### People and places at the tablet

**Player**:
A child (or adult) taking part in a **Session**, identified in the **Arcade** by a **Mascot**.
_Avoid_: user, account, profile, kid

**Mascot**:
The animal character a **Player** picks to be; it is the **Player's** persistent identity and carries their **Progress**.
_Avoid_: avatar, character, profile picture

**Computer Player**:
A **Seat** occupant controlled by the **Arcade** rather than by a person.
_Avoid_: AI, bot, CPU, NPC

**Seat**:
One of up to four numbered positions in a **Session**, each with a fixed colour, held by a **Player** or a **Computer Player**.
_Avoid_: slot, player index, position

**Zone**:
The region of the screen that belongs to one **Seat** during simultaneous play, including the direction it faces.
_Avoid_: area, quadrant, region, pad

**Seating**:
The physical arrangement of **Players** around the tablet, which decides where each **Zone** sits and which way it faces.
_Avoid_: layout (layout is how a screen is drawn), orientation (orientation is the device's)

### Playing

**Session**:
One visit to one **Game** by a fixed set of **Seats**, from leaving the **Home Screen** until returning to it; it contains one or more **Rounds**.
_Avoid_: match, playthrough, game (as an instance)

**Round**:
One complete play of a **Game** from its start to its **Result**; replaying starts a new **Round** in the same **Session**.
_Avoid_: match, game (as an instance), level, attempt

**Turn**:
One **Seat's** opportunity to act in a **Turn-Based** **Game**.
_Avoid_: move (a **Move** is what is done during a Turn), go

**Move**:
The single action a **Seat** takes during its **Turn**.
_Avoid_: action, turn, play

**Result**:
How a **Round** ended: which **Seats** won, drew or (in **Cooperative** play) succeeded together, with any scores.
_Avoid_: outcome, score (a score is one part of a Result), game over

**Difficulty**:
One of three levels (Easy, Medium, Hard) chosen for a **Session**, which each **Game** interprets in its own way.
_Avoid_: level, age setting, skill

### Ways of playing

**Play Style**:
How **Seats** share a **Game**: **Solo**, **Versus Computer**, **Turn-Based**, **Simultaneous** or **Cooperative**.
_Avoid_: mode (ambiguous with difficulty and display modes), game type

**Solo**:
A **Play Style** with one **Player** and no opponent.

**Versus Computer**:
A **Play Style** in which a **Player** competes against one or more **Computer Players**.
_Avoid_: single-player (ambiguous with **Solo**), vs AI

**Turn-Based**:
A **Play Style** in which **Seats** act one at a time on a shared board, passing the **Turn**.
_Avoid_: pass-and-play, hot-seat

**Simultaneous**:
A **Play Style** in which every **Seat** acts at the same time, each inside its own **Zone**.
_Avoid_: real-time multiplayer, party mode

**Cooperative**:
A **Play Style** in which all **Seats** win or lose together.
_Avoid_: co-op (in documents), team mode

### Keeping track

**Progress**:
What the **Arcade** remembers about a **Mascot** between visits: its **Stars**, **Achievements** and remembered choices.
_Avoid_: save data, save game, stats

**Star**:
The unit of reward a **Mascot** earns for finishing a **Round**.
_Avoid_: point, coin, XP

**Achievement**:
An optional, named milestone a **Mascot** earns once, shown as a sticker.
_Avoid_: badge, trophy, medal

**Demo**:
A short wordless animation that shows a pre-reader how to play a **Game**, in place of written or spoken instructions.
_Avoid_: tutorial, instructions, help, voice prompt

## Relationships

- The **Arcade** has one **Catalog**; the **Catalog** lists many **Games**; each **Game** has exactly one **Game Card**.
- A **Session** belongs to exactly one **Game** and has one to four **Seats**, one **Play Style**, one **Difficulty** and one **Seating**.
- A **Seat** is held by exactly one **Player** or one **Computer Player**; a **Player** holds at most one **Seat** per **Session**.
- A **Player** is identified by exactly one **Mascot**; a **Mascot** owns its **Progress**.
- A **Session** contains one or more **Rounds**; each **Round** ends in exactly one **Result**.
- A **Turn-Based** **Round** is a sequence of **Turns**; each **Turn** belongs to one **Seat** and produces at most one **Move**.
- In **Simultaneous** play each **Seat** has exactly one **Zone**; in **Turn-Based** play there are no **Zones** and the whole board belongs to the **Seat** whose **Turn** it is.
- A **Result** may award **Stars** and **Achievements** to the **Mascots** of the **Seats** held by **Players**; **Computer Players** earn nothing.

## Example dialogue

> **Dev:** "Two children sit down for Reaction Rush. Is that one **Session** or two?"
> **Domain expert:** "One **Session**, two **Seats**. Each child picks a **Mascot**, the fox takes **Seat** 1 and the owl takes **Seat** 2. They'll probably play five or six **Rounds** before going back to the **Home Screen**."
> **Dev:** "And because Reaction Rush is **Simultaneous**, each **Seat** gets a **Zone**?"
> **Domain expert:** "Right. The **Seating** decides where those **Zones** go. If the children sit opposite each other, the owl's **Zone** faces the other way."
> **Dev:** "In Tic-Tac-Toe there's no **Zone**. If the owl taps the board during the fox's **Turn**, whose **Move** is it?"
> **Domain expert:** "The fox's. The tablet can't tell whose finger it is, so on a shared board a touch always counts for the **Seat** whose **Turn** it is. That's why the **Turn** indicator has to be impossible to miss."
> **Dev:** "If the fox plays alone against the tablet, is that **Solo**?"
> **Domain expert:** "No, that's **Versus Computer**: there are two **Seats** and a **Computer Player** holds one. **Solo** means no opponent at all, like Color Echo on your own."
> **Dev:** "When the **Round** ends, who gets the **Stars**?"
> **Domain expert:** "The **Result** says which **Seats** won. The **Mascots** on those **Seats** get the **Stars**. The **Computer Player** never does."

## Flagged ambiguities

- "game" was used for both the thing in the **Catalog** and one play of it — resolved: **Game** is the catalog entry, **Round** is one play, **Session** is the visit that groups **Rounds**.
- "mode" was used for player arrangement, difficulty and display state — resolved: **Play Style** is how **Seats** share a **Game**; **Difficulty** is separate; "mode" is not a domain term.
- "single-player" was used for both playing alone and playing against the tablet — resolved: **Solo** has no opponent; **Versus Computer** has a **Computer Player** in another **Seat**.
- "player" was used for both the person and their position — resolved: **Player** is the person (identified by a **Mascot**); **Seat** is the position, which a **Computer Player** can also hold.
- "instructions" were first planned as recorded speech — resolved: the first release has no voice of any kind; a **Demo** shows how to play.
- "profile" and "account" were used for a child's saved identity — resolved: there are no accounts; a **Player's** identity is their **Mascot**, and what is saved is its **Progress**.
