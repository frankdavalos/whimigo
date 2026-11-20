import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where the next build is, for the update tests; set for every worker. */
export const NEXT_BUILD = 'WHIMIGO_NEXT_BUILD';

/**
 * Makes a second production build beside dist/, the same code with another build identifier, so
 * the update tests can deploy a newer version under a running page. It is made the same way as
 * dist/, with outbound network access denied, and removed when the run ends.
 */
export default function globalSetup(): () => void {
  const parent = mkdtempSync(join(tmpdir(), 'whimigo-e2e-'));
  const dir = join(parent, 'next');
  const current = JSON.parse(
    readFileSync(new URL('../../dist/build.json', import.meta.url), 'utf8'),
  ) as { buildId: string };
  execFileSync('npm', ['run', 'build', '--', '--outDir', dir, '--emptyOutDir'], {
    env: { ...process.env, GITHUB_SHA: `${current.buildId}-next` },
    stdio: 'ignore',
  });
  process.env[NEXT_BUILD] = dir;
  return () => rmSync(parent, { recursive: true, force: true });
}
