import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { resolveBuildId } from './build-id';

const sha = 'a'.repeat(40);
const failingGit = () => {
  throw new Error('git is not available');
};

describe('the build identifier', () => {
  it('is the commit CI is building', () => {
    expect(resolveBuildId({ GITHUB_SHA: sha }, failingGit)).toBe(sha);
  });

  it('is the checked-out commit when built outside CI', () => {
    expect(resolveBuildId({}, () => `${sha}\n`)).toBe(sha);
  });

  it('is "unknown" when neither CI nor git can say', () => {
    expect(resolveBuildId({}, failingGit)).toBe('unknown');
    expect(resolveBuildId({ GITHUB_SHA: '' }, () => '')).toBe('unknown');
  });

  it('reads this repository’s HEAD by default', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(resolveBuildId({})).toBe(head);
  });
});
