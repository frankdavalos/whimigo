import { defineConfig, type Plugin } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { ASSETS, buildAssets } from './scripts/assets/build-assets.ts';
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

/**
 * Builds the atlases and app icons (ADR-0011) before the development server or the production
 * build starts, and again in development whenever an SVG in the project changes. Not in unit tests.
 */
function assets(): Plugin {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const build = () => buildAssets({ ...ASSETS, root });
  return {
    name: 'whimigo-assets',
    apply: (_config, { mode }) => mode !== 'test',
    async buildStart() {
      await build();
    },
    configureServer(server) {
      server.watcher.on('all', (_event, file) => {
        if (!file.endsWith('.svg')) return;
        build().then(
          () => server.ws.send({ type: 'full-reload' }),
          (error: unknown) => server.config.logger.error(String(error)),
        );
      });
    },
  };
}

export default defineConfig({
  base: '/whimigo/',
  resolve: { tsconfigPaths: true },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [assets(), buildInfo()],
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
