import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Lint is the test for the module boundaries. Each fixture is linted as if it lived at the same
 * path under src/, and must fail with exactly the rules listed here, or pass.
 */
const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));

const IMPORTS = 'no-restricted-imports';
const GLOBALS = 'no-restricted-globals';
const PROPERTIES = 'no-restricted-properties';
const SYNTAX = 'no-restricted-syntax';

const expected: Record<string, string[]> = {
  // A Game that keeps every rule.
  'src/games/fixture-good/manifest.ts': [],
  'src/games/fixture-good/index.ts': [],
  'src/games/fixture-good/logic/rules.ts': [],
  'src/games/fixture-good/logic/nested/score.ts': [],
  'src/games/fixture-good/scene/board-scene.ts': [],

  // A Game's rules stay pure.
  'src/games/fixture-bad/logic/imports-phaser.ts': [IMPORTS],
  'src/games/fixture-bad/logic/imports-its-scene.ts': [IMPORTS],
  'src/games/fixture-bad/logic/reads-the-document.ts': [GLOBALS],

  // A Game imports only its own code, the contract and the kit.
  'src/games/fixture-bad/scene/imports-another-game.ts': [IMPORTS],
  'src/games/fixture-bad/scene/imports-another-game-relatively.ts': [IMPORTS],
  'src/games/fixture-bad/scene/imports-arcade.ts': [IMPORTS],
  'src/games/fixture-bad/scene/imports-arcade-relatively.ts': [IMPORTS],
  'src/games/fixture-bad/scene/imports-arcade-dynamically.ts': [SYNTAX],
  'src/games/fixture-bad/scene/imports-platform.ts': [IMPORTS],

  // A Game uses scene time and the Round's random source.
  'src/games/fixture-bad/scene/uses-set-timeout.ts': [GLOBALS],
  'src/games/fixture-bad/scene/uses-set-interval.ts': [GLOBALS],
  'src/games/fixture-bad/scene/uses-date-now.ts': [PROPERTIES],
  'src/games/fixture-bad/scene/uses-request-animation-frame.ts': [GLOBALS],
  'src/games/fixture-bad/scene/uses-math-random.ts': [PROPERTIES],

  // Objects with open defects in Phaser 4.2.1 are not created anywhere.
  'src/games/fixture-bad/scene/creates-text.ts': [SYNTAX],
  'src/games/fixture-bad/scene/creates-render-texture.ts': [SYNTAX],
  'src/games/fixture-bad/scene/creates-dynamic-texture.ts': [SYNTAX],
  'src/games/fixture-bad/scene/creates-shader.ts': [SYNTAX],

  // A Game has one Scene and one camera, which the Arcade and the kit own, and no HTML.
  'src/games/fixture-bad/scene/adds-a-scene.ts': [SYNTAX],
  'src/games/fixture-bad/scene/launches-a-scene.ts': [SYNTAX],
  'src/games/fixture-bad/scene/adds-a-camera.ts': [SYNTAX],
  'src/games/fixture-bad/scene/creates-a-dom-element.ts': [SYNTAX],
  'src/games/fixture-bad/scene/creates-an-html-element.ts': [SYNTAX],
  'src/arcade/creates-render-texture.ts': [SYNTAX],

  // The platform services know nothing of the kit, the Arcade or Games.
  'src/platform/imports-kit.ts': [IMPORTS],
  'src/platform/imports-kit-relatively.ts': [IMPORTS],
  'src/platform/imports-arcade.ts': [IMPORTS],
  'src/platform/imports-game.ts': [IMPORTS],

  // The kit knows nothing of the Arcade or Games.
  'src/kit/imports-arcade.ts': [IMPORTS],
  'src/kit/imports-game.ts': [IMPORTS],

  // The Arcade reaches a Game only through its manifest.
  'src/arcade/imports-game-internals.ts': [IMPORTS],
};

function fixtureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? fixtureFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const eslint = new ESLint({ cwd: root });

async function ruleIdsFor(path: string): Promise<string[]> {
  const code = readFileSync(join(fixtures, path), 'utf8');
  const [result] = await eslint.lintText(code, { filePath: join(root, path) });
  return [...new Set(result?.messages.map((message) => message.ruleId ?? 'fatal'))].sort();
}

describe('lint boundaries', () => {
  it('has an expectation for every fixture', () => {
    const onDisk = fixtureFiles(fixtures).map((file) => relative(fixtures, file));
    expect(onDisk.sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [path, rules] of Object.entries(expected)) {
    const verdict = rules.length === 0 ? 'passes' : `fails with ${rules.join(', ')}`;
    it(`${path} ${verdict}`, async () => {
      expect(await ruleIdsFor(path)).toEqual(rules);
    });
  }

  it('reports each banned clock or random call once', async () => {
    const [result] = await eslint.lintText('setTimeout(() => {}, 1);\nMath.random();\n', {
      filePath: join(root, 'src/games/fixture-bad/scene/twice.ts'),
    });
    expect(result?.messages.map((message) => message.line)).toEqual([1, 2]);
  });
});
