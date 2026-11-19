import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const guard = fileURLToPath(new URL('./deny-network.mjs', import.meta.url));

/** Runs a snippet of ES module code in a fresh Node process with the guard preloaded. */
function runGuarded(code: string) {
  const result = spawnSync(
    process.execPath,
    ['--import', guard, '--input-type=module', '-e', code],
    {
      encoding: 'utf8',
      timeout: 20_000,
    },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const DENIED = 'Outbound network access is denied';

describe('the build’s network guard', () => {
  it('refuses fetch to another host', () => {
    const run = runGuarded(
      `try { await fetch('http://192.0.2.1/'); console.log('reached'); } catch (e) { console.log(String(e.cause ?? e)); }`,
    );
    expect(run.output).toContain(DENIED);
    expect(run.output).not.toContain('reached');
  });

  it('refuses a raw TCP connection to another host', () => {
    const run = runGuarded(
      `import net from 'node:net';
       const s = net.connect(80, '192.0.2.1');
       s.on('error', (e) => console.log(e.message));
       s.on('connect', () => console.log('reached'));`,
    );
    expect(run.output).toContain(DENIED);
  });

  it('refuses name lookups for other hosts', () => {
    const run = runGuarded(
      `import dns from 'node:dns';
       dns.lookup('example.com', (e) => console.log(e ? e.message : 'resolved'));
       try { await dns.promises.lookup('example.com'); } catch (e) { console.log(e.message); }`,
    );
    expect(run.output.split(DENIED).length - 1).toBe(2);
  });

  it('refuses UDP datagrams to another host', () => {
    const run = runGuarded(
      `import dgram from 'node:dgram';
       const s = dgram.createSocket('udp4');
       try { s.send('x', 53, '192.0.2.1'); console.log('sent'); } catch (e) { console.log(e.message); }
       s.close();`,
    );
    expect(run.output).toContain(DENIED);
    expect(run.output).not.toContain('sent');
  });

  it('allows connections on the loopback interface', () => {
    const run = runGuarded(
      `import net from 'node:net';
       const server = net.createServer((c) => c.end()).listen(0, '127.0.0.1', () => {
         const { port } = server.address();
         net.connect(port, 'localhost').on('connect', function () { console.log('connected'); this.end(); server.close(); })
           .on('error', (e) => { console.log(e.message); server.close(); });
       });`,
    );
    expect(run.output).toContain('connected');
  });
});
