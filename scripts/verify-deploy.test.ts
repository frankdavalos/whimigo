import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPublishedBuild } from './verify-deploy';

const run = promisify(execFile);
const sha = 'a'.repeat(40);

type Reply = { status: number; body: string };

/** A stand-in for the published site: answers each request for /whimigo/build.json in turn. */
let server: Server | undefined;
const requested: string[] = [];

async function site(...replies: Reply[]): Promise<string> {
  requested.length = 0;
  server = createServer((request, response) => {
    requested.push(request.url ?? '');
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const reply =
      path === '/whimigo/build.json'
        ? (replies.shift() ?? { status: 404, body: 'Not found' })
        : { status: 404, body: 'Not found' };
    response.writeHead(reply.status, { 'content-type': 'application/json' });
    response.end(reply.body);
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/whimigo/`;
}

async function closeSite(): Promise<void> {
  const open = server;
  server = undefined;
  if (!open) return;
  open.closeAllConnections();
  await new Promise((resolve) => open.close(resolve));
}

afterEach(closeSite);

const quickly = { attempts: 1, intervalMs: 0, log: () => {} };

describe('checking the published build', () => {
  it('passes when the published build.json names the commit just pushed', async () => {
    const siteUrl = await site({ status: 200, body: JSON.stringify({ buildId: sha }) });
    const verdict = await verifyPublishedBuild({ siteUrl, expectedBuildId: sha, ...quickly });
    expect(verdict).toEqual({ ok: true });
  });

  it('fails when the published build.json names another commit', async () => {
    const older = 'b'.repeat(40);
    const siteUrl = await site({ status: 200, body: JSON.stringify({ buildId: older }) });
    const verdict = await verifyPublishedBuild({ siteUrl, expectedBuildId: sha, ...quickly });
    expect(verdict).toEqual({ ok: false, reason: `found build ${older}, expected ${sha}` });
  });

  it('fails when the address has no build.json', async () => {
    const siteUrl = await site({ status: 404, body: 'Not found' });
    const verdict = await verifyPublishedBuild({ siteUrl, expectedBuildId: sha, ...quickly });
    expect(verdict).toEqual({ ok: false, reason: 'build.json answered HTTP 404' });
  });

  it('fails when build.json is not JSON', async () => {
    const siteUrl = await site({ status: 200, body: '<html>Site not found</html>' });
    const verdict = await verifyPublishedBuild({ siteUrl, expectedBuildId: sha, ...quickly });
    expect(verdict).toEqual({ ok: false, reason: 'build.json is not valid JSON' });
  });

  it('fails when build.json carries no build identifier', async () => {
    const siteUrl = await site({ status: 200, body: JSON.stringify({ commit: sha }) });
    const verdict = await verifyPublishedBuild({ siteUrl, expectedBuildId: sha, ...quickly });
    expect(verdict).toEqual({ ok: false, reason: 'build.json has no buildId' });
  });
});

describe('waiting for GitHub Pages to serve the new build', () => {
  const older = JSON.stringify({ buildId: 'b'.repeat(40) });

  it('asks again until the new build is served', async () => {
    const siteUrl = await site(
      { status: 404, body: 'Not found' },
      { status: 200, body: older },
      { status: 200, body: JSON.stringify({ buildId: sha }) },
    );
    const verdict = await verifyPublishedBuild({
      siteUrl,
      expectedBuildId: sha,
      attempts: 5,
      intervalMs: 0,
      log: () => {},
    });
    expect(verdict).toEqual({ ok: true });
    expect(requested).toHaveLength(3);
  });

  it('gives up after the last attempt, with the last reason', async () => {
    const siteUrl = await site(...Array.from({ length: 5 }, () => ({ status: 200, body: older })));
    const lines: string[] = [];
    const verdict = await verifyPublishedBuild({
      siteUrl,
      expectedBuildId: sha,
      attempts: 3,
      intervalMs: 0,
      log: (line) => lines.push(line),
    });
    expect(verdict).toEqual({
      ok: false,
      reason: `found build ${'b'.repeat(40)}, expected ${sha}`,
    });
    expect(requested).toHaveLength(3);
    expect(lines).toHaveLength(3);
  });

  it('asks with a fresh address each time, so no cache can answer with an old copy', async () => {
    const siteUrl = await site(...Array.from({ length: 3 }, () => ({ status: 200, body: older })));
    await verifyPublishedBuild({
      siteUrl,
      expectedBuildId: sha,
      attempts: 3,
      intervalMs: 0,
      log: () => {},
    });
    expect(requested.every((url) => url.startsWith('/whimigo/build.json?'))).toBe(true);
    expect(new Set(requested).size).toBe(3);
  });

  it('finds build.json beside the Arcade when the address lacks its final slash', async () => {
    const siteUrl = await site({ status: 200, body: JSON.stringify({ buildId: sha }) });
    const verdict = await verifyPublishedBuild({
      siteUrl: siteUrl.replace(/\/$/, ''),
      expectedBuildId: sha,
      ...quickly,
    });
    expect(verdict).toEqual({ ok: true });
  });

  it('fails, rather than throwing, when the address cannot be reached', async () => {
    const siteUrl = await site();
    await closeSite();
    const verdict = await verifyPublishedBuild({ siteUrl, expectedBuildId: sha, ...quickly });
    expect(verdict.ok).toBe(false);
  });
});

describe('the CI step', () => {
  const script = fileURLToPath(new URL('./verify-deploy.ts', import.meta.url));

  async function runStep(env: Record<string, string>): Promise<number> {
    try {
      await run(process.execPath, [script], {
        env: { PATH: process.env['PATH'] ?? '', ...env },
      });
      return 0;
    } catch (error) {
      return (error as { code: number }).code;
    }
  }

  it('succeeds when the published address serves this build', async () => {
    const siteUrl = await site({ status: 200, body: JSON.stringify({ buildId: sha }) });
    expect(await runStep({ SITE_URL: siteUrl, EXPECTED_BUILD_ID: sha })).toBe(0);
  });

  it('fails when the published address never serves this build', async () => {
    const siteUrl = await site(
      ...Array.from({ length: 2 }, () => ({
        status: 200,
        body: JSON.stringify({ buildId: 'b'.repeat(40) }),
      })),
    );
    const env = { SITE_URL: siteUrl, EXPECTED_BUILD_ID: sha };
    expect(await runStep({ ...env, VERIFY_ATTEMPTS: '2', VERIFY_INTERVAL_SECONDS: '0' })).toBe(1);
  });

  it('fails when it is not told what to look for', async () => {
    expect(await runStep({})).not.toBe(0);
  });
});
