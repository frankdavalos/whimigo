import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * The module boundaries of docs/architecture/game-contract.md, enforced with ESLint's own rules.
 *
 * Imports that leave a module's folder must use the `@/` alias, so that a rule can see where they
 * go: a relative import that climbs out of its folder is refused outright. Each folder then gets
 * one list of refused aliases. ESLint replaces a rule's options when a later block matches the same
 * file, so every block below carries the complete list for its files.
 *
 * tests/lint/boundaries.test.ts proves each rule against fixtures.
 */

const DEEPEST = 8;

/** @typedef {{ regex: string, message: string }} Refusal */
/** @typedef {import('eslint').Linter.Config} Block */

/** @param {number} levels @returns {Refusal} */
const climbsOut = (levels) => ({
  regex: `^(\\.\\./){${levels},}`,
  message: 'Import from outside this folder through the @/ alias, so the boundary rules apply.',
});

/** @param {string} regex @param {string} message @returns {Refusal} */
const refuse = (regex, message) => ({ regex, message });

const GAME = [
  refuse(
    '^@/(arcade|platform|games)(/|$)',
    'A Game imports only its own code, @/contract and @/kit.',
  ),
];

const LOGIC = [
  refuse('^phaser(/|$)', 'Rules are pure: logic/ never imports Phaser.'),
  refuse(
    '^@/kit(?!/(rng|turn)$)(/|$)',
    'logic/ may use only @/kit/rng and @/kit/turn from the kit.',
  ),
  refuse('^(\\.\\./)+scene(/|$)', 'Rules are pure: logic/ never imports the Scene.'),
];

const KIT = [refuse('^@/(games|arcade)(/|$)', 'The kit never imports a Game or the Arcade.')];

const PLATFORM = [
  refuse(
    '^@/(games|arcade|kit)(/|$)',
    'The platform services never import a Game, the Arcade or the kit.',
  ),
];

const ARCADE = [
  refuse(
    '^@/games/[^/]+/',
    'The Arcade reaches a Game only through @/games/catalog and its manifest.',
  ),
];

/** Objects with open defects or leaks in Phaser 4.2.1 (ADR-0005, ADR-0012). Nowhere in src/. */
const BANNED_OBJECTS = [
  {
    selector:
      'CallExpression[callee.object.property.name=/^(add|make)$/][callee.property.name=/^(text|renderTexture|dynamicTexture|shader)$/]',
    message:
      'Phaser Text, RenderTexture, DynamicTexture and Shader objects are not used (ADR-0005, ADR-0012).',
  },
  {
    selector: 'NewExpression[callee.property.name=/^(Text|RenderTexture|DynamicTexture|Shader)$/]',
    message:
      'Phaser Text, RenderTexture, DynamicTexture and Shader objects are not used (ADR-0005, ADR-0012).',
  },
  {
    selector: "CallExpression[callee.property.name='addDynamicTexture']",
    message: 'Dynamic textures are not used (ADR-0012).',
  },
];

const GAME_SYNTAX = [
  ...BANNED_OBJECTS,
  {
    selector:
      "CallExpression[callee.object.property.name='scene'][callee.property.name=/^(add|launch|run|start|switch|remove|stop|sleep|wake|restart|moveAbove|moveBelow|bringToTop|sendToBack)$/]",
    message: 'A Game has one Scene; the Arcade adds, starts and removes it (ADR-0004).',
  },
  {
    selector:
      "CallExpression[callee.object.property.name='cameras'][callee.property.name=/^(add|addExisting|remove)$/]",
    message: 'A Game uses the one camera the kit owns (ADR-0003).',
  },
  {
    selector:
      'CallExpression[callee.object.property.name=/^(add|make)$/][callee.property.name=/^(dom|video|iframe)$/]',
    message: 'A Game creates no HTML elements (ADR-0005).',
  },
  {
    selector:
      'CallExpression[callee.property.name=/^(createElement|createElementNS|insertAdjacentHTML)$/]',
    message: 'A Game creates no HTML elements (ADR-0005).',
  },
  {
    selector: 'ImportExpression[source.value=/^@\\u002F(arcade|platform|games)(\\u002F|$)/]',
    message: 'A Game imports only its own code, @/contract and @/kit.',
  },
];

/**
 * One block for each depth of a folder (`src/kit/*.ts`, `src/kit/x/*.ts`, ...), refusing relative
 * imports that climb out of the module. `belowModule` is how far the folder sits inside it.
 * @param {string} folder
 * @param {Refusal[]} refused
 * @param {Block['rules']} [extra]
 * @returns {Block[]}
 */
function byDepth(folder, refused, extra = {}, belowModule = 0) {
  return Array.from({ length: DEEPEST + 1 }, (_, depth) => ({
    files: [`${folder}/${'*/'.repeat(depth)}*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [climbsOut(belowModule + depth + 1), ...refused] },
      ],
      ...extra,
    },
  }));
}

/** @type {Block['rules']} */
const GAME_RULES = {
  'no-restricted-syntax': ['error', ...GAME_SYNTAX],
  'no-restricted-globals': [
    'error',
    ...['setTimeout', 'setInterval', 'requestAnimationFrame', 'performance'].map((name) => ({
      name,
      message: 'Games use scene time (this.time, this.tweens), never the wall clock.',
    })),
    ...['window', 'document', 'navigator', 'globalThis', 'self'].map((name) => ({
      name,
      message: 'Games never touch the DOM or the browser.',
    })),
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Date', property: 'now', message: 'Games use scene time, never the wall clock.' },
    { object: 'Math', property: 'random', message: 'Games use round.rng, never Math.random().' },
  ],
};

export default defineConfig(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'tests/lint/fixtures/',
    ],
  },
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...BANNED_OBJECTS] },
  },
  ...byDepth('src/arcade', ARCADE),
  ...byDepth('src/kit', KIT),
  ...byDepth('src/platform', PLATFORM),
  ...byDepth('src/games/*', GAME, GAME_RULES),
  ...byDepth('src/games/*/logic', [...GAME, ...LOGIC], GAME_RULES, 1),
);
