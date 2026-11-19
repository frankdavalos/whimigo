import { execFileSync } from 'node:child_process';

function gitHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * The identifier every build carries: the commit being built. CI names it in GITHUB_SHA;
 * elsewhere git is asked. A build made where neither can say is "unknown".
 */
export function resolveBuildId(
  env: Readonly<Record<string, string | undefined>>,
  readGitHead: () => string = gitHead,
): string {
  const fromCi = env['GITHUB_SHA']?.trim();
  if (fromCi) return fromCi;
  try {
    return readGitHead().trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}
