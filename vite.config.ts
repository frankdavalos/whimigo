import { defineConfig, type Plugin } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import { ASSETS, buildAssets } from './scripts/assets/build-assets.ts';
import { resolveBuildId } from './scripts/build-id.ts';
import { PRECACHE_BUDGET_BYTES } from './scripts/precache.ts';
import { colors, cssColor } from './src/kit/theme.ts';

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

const BASE = '/whimigo/';

/**
 * The manifest and the precaching service worker (ADR-0008). Prompt mode: a new version installs
 * and waits; src/platform/updates.ts registers the worker and applies a waiting version only at a
 * cold start. Every emitted file is precached, whatever its type or size.
 */
function offline(): Plugin[] {
  return VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'Whimigo',
      short_name: 'Whimigo',
      description: 'An offline arcade of mini-games for children, played on one shared tablet.',
      id: BASE,
      start_url: BASE,
      scope: BASE,
      display: 'fullscreen',
      orientation: 'landscape',
      background_color: cssColor(colors.sky),
      theme_color: cssColor(colors.sky),
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*'],
      maximumFileSizeToCacheInBytes: PRECACHE_BUDGET_BYTES,
      inlineWorkboxRuntime: true,
      skipWaiting: false,
      clientsClaim: false,
    },
  });
}

export default defineConfig({
  base: BASE,
  resolve: { tsconfigPaths: true },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [assets(), buildInfo(), offline()],
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
