import { defineConfig, type Plugin } from 'vitest/config';
import { resolveBuildId } from './scripts/build-id.ts';

const buildId = resolveBuildId(process.env);

/** Puts the build identifier in the output as build.json, readable without running script. */
function buildInfo(): Plugin {
  return {
    name: 'whimigo-build-info',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build.json',
        source: `${JSON.stringify({ buildId })}\n`,
      });
    },
  };
}

export default defineConfig({
  base: '/whimigo/',
  resolve: { tsconfigPaths: true },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [buildInfo()],
  build: {
    target: 'es2022',
    // Phaser is one large module that cannot be split or tree-shaken; it is downloaded once.
    chunkSizeWarningLimit: 2000,
  },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
