import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../playwright.config';

/**
 * One command for each level of testing, and CI running the same ones (story 6); publishing only
 * what passed them, from `main`, then checking the published address (story 15).
 */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
const workflow = read('.github/workflows/ci.yml');

/**
 * A top-level block of the workflow, such as `on`, or one job under `jobs`: its lines, trimmed,
 * without blank lines or comments.
 */
function block(name: string, indent: number): string[] {
  const lines = workflow.split('\n').filter((line) => !/^\s*(#.*)?$/.test(line));
  const start = lines.findIndex((line) => line === `${' '.repeat(indent)}${name}:`);
  expect(start, `${name} in the workflow`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex(
    (line, index) => index > start && line.length - line.trimStart().length <= indent,
  );
  return lines.slice(start + 1, end === -1 ? undefined : end).map((line) => line.trim());
}

const job = (name: string) => block(name, 2);
/** The commands a job's steps run. */
const runs = (lines: string[]) =>
  lines.flatMap((line) => /^(?:- )?run: (.+)$/.exec(line)?.[1] ?? []);

describe('the commands for each level of testing', () => {
  it('npm run check runs the type-check, lint and every Vitest test, stopping at the first that fails', () => {
    expect(scripts['check']).toBe('npm run typecheck && npm run lint && npm run test');
    expect(scripts['typecheck']).toBe('tsc --noEmit');
    expect(scripts['lint']).toMatch(/^eslint \. && /);
    expect(scripts['test']).toBe('vitest run');
  });

  it('npm run e2e makes the production build, then runs every Playwright test against it under /whimigo/', () => {
    expect(scripts['e2e']).toBe('npm run build && playwright test');
    expect(config.testDir).toBe('tests/e2e');
    expect(config.webServer).toMatchObject({
      command: expect.stringMatching(/^npx vite preview /),
    });
    expect(new URL(config.use!.baseURL!).pathname).toBe('/whimigo/');
  });

  it('the Playwright projects are three Chromium tablets with touch, and WebKit at 1024 x 768 running only the smoke tests', () => {
    const projects = config.projects!.map((project) => ({
      browser: project.use?.defaultBrowserType,
      viewport: project.use?.viewport,
      hasTouch: project.use?.hasTouch,
      smokeOnly: String(project.grep ?? '') === String(/@smoke/),
    }));
    expect(projects).toEqual([
      {
        browser: 'chromium',
        viewport: { width: 1376, height: 1032 },
        hasTouch: true,
        smokeOnly: false,
      },
      {
        browser: 'chromium',
        viewport: { width: 1133, height: 744 },
        hasTouch: true,
        smokeOnly: false,
      },
      {
        browser: 'chromium',
        viewport: { width: 1280, height: 800 },
        hasTouch: true,
        smokeOnly: false,
      },
      {
        browser: 'webkit',
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
        smokeOnly: true,
      },
    ]);
  });
});

describe('the CI workflow', () => {
  it('runs npm run check, and npm run e2e for every Playwright project and every test, on every push to main', () => {
    expect(block('on', 0)).toEqual(['push:', 'branches: [main]']);
    expect(runs(job('check')).filter((step) => step.startsWith('npm run '))).toEqual([
      'npm run check',
    ]);
    // The browser tests run in jobs side by side, each through npm run e2e.
    const e2e = job('e2e');
    expect(runs(e2e).filter((step) => step.startsWith('npm run '))).toEqual([
      'npm run e2e -- ${{ matrix.args }}',
    ]);
    const jobs = new Map<string, string[]>();
    let current = '';
    for (const line of e2e) {
      const name = /^- job: (.+)$/.exec(line)?.[1];
      if (name) jobs.set((current = name), []);
      const args = /^args: (.+)$/.exec(line)?.[1];
      if (args) jobs.get(current)!.push(...args.split(' '));
    }
    const projects = config.projects!.map((project) => project.name!);
    const performance = 'tests/e2e/performance-check.spec.ts';
    // One job for each project, running all of its tests but the Performance check's.
    for (const project of projects) {
      const args = jobs.get(project);
      expect(args, `a job for ${project}`).toBeDefined();
      expect(args!.filter((arg) => arg.startsWith('--project='))).toEqual([`--project=${project}`]);
      if (project !== 'webkit-smoke') {
        expect(args).toContain('--grep-invert=performance-check.spec.ts');
      }
    }
    // And one job running the Performance check's tests for each of those projects, one at a time.
    const alone = jobs.get('performance-check');
    expect(alone).toEqual([
      ...projects.filter((project) => project !== 'webkit-smoke').map((p) => `--project=${p}`),
      '--workers=1',
      performance,
    ]);
    expect([...jobs.keys()]).toEqual([...projects, 'performance-check']);
    expect(e2e).toContain('fail-fast: false');
  });

  it('publishes only from main, only after npm run check and npm run e2e have passed in the same run', () => {
    const deploy = job('deploy');
    expect(deploy).toContain('needs: [check, e2e, same-build]');
    expect(deploy).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(deploy.some((line) => line.startsWith('uses: actions/deploy-pages@'))).toBe(true);
    // The build published is one the browser tests ran against, kept only on main, from one project.
    const tested = job('e2e');
    const keep = tested.indexOf('- name: Keep the tested build for GitHub Pages');
    expect(keep).toBeGreaterThan(
      tested.indexOf('- run: npm run e2e -- --project=${{ matrix.project }}'),
    );
    expect(tested.slice(keep, keep + 3)).toContain(
      "if: github.ref == 'refs/heads/main' && matrix.job == 'chromium-tablet-4x3'",
    );
    // Every project's build is the same build, byte for byte, or nothing is published.
    const same = job('same-build');
    expect(same).toContain('needs: e2e');
    expect(same).toContain('pattern: build-checksums-*');
    expect(same.some((line) => line.startsWith('diff -u '))).toBe(true);
    // One checksum list from each browser-test job: each project's, and the Performance check's.
    expect(same).toContain(`if [ "$count" -ne ${config.projects!.length + 1} ]; then`);
    // No other job publishes.
    const publishers = workflow.match(/actions\/deploy-pages@/g) ?? [];
    expect(publishers).toHaveLength(1);
  });

  it('after publishing, checks the published address for the build identifier of the commit just pushed', () => {
    const verify = job('verify-deploy');
    expect(verify).toContain('needs: deploy');
    expect(runs(verify)).toEqual(['node scripts/verify-deploy.ts']);
    expect(verify).toContain('SITE_URL: ${{ needs.deploy.outputs.page_url }}');
    expect(verify).toContain('EXPECTED_BUILD_ID: ${{ github.sha }}');
  });
});
