import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveBuildId } from '../../scripts/build-id';
import { expect, test } from './arcade';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const expectedBuildId = resolveBuildId(process.env);

test('the bridge reports the build identifier of the commit that was built @smoke', async ({
  arcade,
}) => {
  await arcade.open();
  expect(expectedBuildId).not.toBe('unknown');
  expect(await arcade.page.evaluate(() => window.whimigo?.buildId)).toBe(expectedBuildId);
});

test('the build identifier is published as build.json beside the Arcade', async ({ request }) => {
  const response = await request.get('build.json');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ buildId: expectedBuildId });
});

test('the build output contains no audio file', () => {
  const files = readdirSync(dist, { recursive: true, encoding: 'utf8' });
  expect(files.length).toBeGreaterThan(0);
  expect(
    files.filter((file) => /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|weba|webm)$/i.test(file)),
  ).toEqual([]);
});
