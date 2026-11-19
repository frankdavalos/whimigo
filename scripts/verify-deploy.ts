/**
 * Run by CI after a deployment to GitHub Pages: asks the published address for build.json until
 * it names the commit that was just pushed, and fails if it never does. Pages can take a minute
 * or two to serve a new deployment, so it asks a bounded number of times.
 *
 *   SITE_URL=https://<account>.github.io/whimigo/ EXPECTED_BUILD_ID=<sha> node scripts/verify-deploy.ts
 *
 * VERIFY_ATTEMPTS and VERIFY_INTERVAL_SECONDS change how often and how far apart it asks.
 */
import { fileURLToPath } from 'node:url';

export type Verdict = { ok: true } | { ok: false; reason: string };

export interface VerifyOptions {
  /** The published Arcade, e.g. https://<account>.github.io/whimigo/ */
  siteUrl: string;
  expectedBuildId: string;
  attempts: number;
  intervalMs: number;
  log: (line: string) => void;
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function verifyPublishedBuild(options: VerifyOptions): Promise<Verdict> {
  let verdict: Verdict = { ok: false, reason: 'not checked' };
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
    verdict = await checkOnce(options, attempt);
    options.log(
      `Attempt ${attempt} of ${options.attempts}: ${verdict.ok ? 'found this build' : verdict.reason}`,
    );
    if (verdict.ok) break;
  }
  return verdict;
}

async function checkOnce(options: VerifyOptions, attempt: number): Promise<Verdict> {
  const base = options.siteUrl.endsWith('/') ? options.siteUrl : `${options.siteUrl}/`;
  // A query no cache has seen, so the answer comes from the deployment, not an old copy.
  const url = new URL(`build.json?verify=${Date.now()}-${attempt}`, base);
  let status: number;
  let body: string;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    status = response.status;
    body = await response.text();
  } catch (error) {
    return { ok: false, reason: `build.json could not be fetched (${describe(error)})` };
  }
  if (status < 200 || status > 299)
    return { ok: false, reason: `build.json answered HTTP ${status}` };
  return judge(body, options.expectedBuildId);
}

function judge(body: string, expectedBuildId: string): Verdict {
  let published: unknown;
  try {
    published = JSON.parse(body);
  } catch {
    return { ok: false, reason: 'build.json is not valid JSON' };
  }
  const buildId =
    typeof published === 'object' && published !== null && 'buildId' in published
      ? published.buildId
      : undefined;
  if (typeof buildId !== 'string') return { ok: false, reason: 'build.json has no buildId' };
  return buildId === expectedBuildId
    ? { ok: true }
    : { ok: false, reason: `found build ${buildId}, expected ${expectedBuildId}` };
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
  return `${error.message}${cause}`;
}

async function main(env: NodeJS.ProcessEnv): Promise<number> {
  const siteUrl = env['SITE_URL']?.trim();
  const expectedBuildId = env['EXPECTED_BUILD_ID']?.trim();
  if (!siteUrl || !expectedBuildId) {
    console.error('SITE_URL and EXPECTED_BUILD_ID must both be set.');
    return 2;
  }
  // By default twenty attempts fifteen seconds apart: about five minutes before giving up.
  const attempts = whole(env['VERIFY_ATTEMPTS'], 20);
  const intervalSeconds = whole(env['VERIFY_INTERVAL_SECONDS'], 15);
  console.log(`Looking for build ${expectedBuildId} at ${siteUrl}`);
  const verdict = await verifyPublishedBuild({
    siteUrl,
    expectedBuildId,
    attempts: Math.max(1, attempts),
    intervalMs: intervalSeconds * 1000,
    log: (line) => console.log(line),
  });
  if (verdict.ok) return 0;
  console.error(`The published address does not serve this build: ${verdict.reason}`);
  return 1;
}

/** A non-negative whole number from the environment, or the fallback when it is unset or not one. */
function whole(value: string | undefined, fallback: number): number {
  return value !== undefined && /^\d+$/.test(value.trim()) ? Number(value) : fallback;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.env);
}
