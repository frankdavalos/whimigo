---
status: accepted
---

# Sound is synthesized from recipes in code; there are no audio files and no voice

Every sound in the Arcade is described as a recipe: a few lines of data naming a waveform, a pitch that may glide, and a loudness envelope, optionally several notes in sequence. Recipes are rendered into sound buffers when they are loaded and played through Phaser's Web Audio sound manager. The first release ships no audio files and no speech of any kind; a wordless Demo shows how to play.

This follows from keeping human production work low through the first release ([ADR-0016](0016-art-and-sound-made-in-code.md)). A recipe can be written, reviewed and tuned by a coding agent. A recording needs a person, a microphone and an editing pass.

## Considered Options

- **Recorded effects and recorded Voice Prompts as MP3.** The original plan. Rejected for the human work it needs. It would also have brought audio formats, decoding defects and cached-media handling into the design.
- **Speech synthesis on the tablet for instructions.** Rejected. Voices differ from tablet to tablet, offline availability is undocumented, and the owner chose to have no voice at all.
- **A synthesis library.** Rejected for now. The need is about 150 lines, and Phaser stays the only runtime dependency.
- **Building a live oscillator graph on every play.** Rejected in favour of rendering each recipe to a buffer once, so that Phaser pauses, mutes and plays synthesized sounds exactly like any others.

## Consequences

- Sounds are simple by nature: chimes, blips, whooshes, pops. Nothing will sound like a real animal or a real voice.
- With no speech and no reading, each Game must be learnable from its Demo alone. A Game whose rules cannot be shown that way is too complicated for this Arcade.
- Whether Phaser 4.2.1 accepts a ready-made buffer in its audio cache is an assumption, checked on the sound check screen in Phase 0. The fallback is for `platform/audio` to play the buffers itself on the same audio context. Games cannot tell the difference. Confirmed on 2026-11-19: Phaser 4.2.1 does accept one, the Sound check plays every sound through Phaser's sound manager, and the fallback is not built.
- The tablet's silent mode silences the Arcade. That is left as it is.
- A Game must never wait on a sound, because sound may be off, locked or silenced.
- If recorded sound is added later, it arrives as files in a Game's pack. MP3 is the format to use, being the one every target browser decodes, and the files must be fetched whole and decoded by Web Audio, not streamed, to avoid Safari's range-request problem with cached media.
