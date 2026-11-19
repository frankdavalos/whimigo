/**
 * Preloaded into the production build (`node --import`) so that any attempt by the build's
 * JavaScript to reach another host fails loudly. Connections on the loopback interface and
 * local sockets stay allowed. Native code (the bundler's own binaries) is outside its reach;
 * none of it makes requests, and this guard is what would notice a plugin or script that did.
 */
import dgram from 'node:dgram';
import dns from 'node:dns';
import net from 'node:net';

const MESSAGE = 'Outbound network access is denied during the build';

/** @param {unknown} host */
function isLoopback(host) {
  if (host === undefined || host === null || host === '') return true;
  const name = String(host)
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return (
    name === 'localhost' ||
    name.endsWith('.localhost') ||
    name === '::1' ||
    /^(::ffff:)?127\.\d+\.\d+\.\d+$/.test(name)
  );
}

/** @param {string} host */
function denied(host) {
  const error = new Error(`${MESSAGE} (${host})`);
  Object.assign(error, { code: 'EACCES' });
  return error;
}

const originalConnect = net.Socket.prototype.connect;
/**
 * @this {net.Socket}
 * @param {any[]} args
 */
function guardedConnect(...args) {
  // Node passes already-normalised arguments as an array whose first entry is the options.
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options =
    typeof first === 'object' && first !== null
      ? first
      : typeof first === 'number' || /^\d+$/.test(String(first))
        ? { port: first, host: args[1] }
        : { path: first };
  if (!('path' in options && options.path) && !isLoopback(options.host)) {
    throw denied(String(options.host));
  }
  return originalConnect.apply(this, /** @type {any} */ (args));
}
net.Socket.prototype.connect = /** @type {any} */ (guardedConnect);

const originalLookup = dns.lookup;
dns.lookup = /** @type {typeof dns.lookup} */ (
  function (/** @type {string} */ hostname, /** @type {any[]} */ ...rest) {
    if (!isLoopback(hostname)) {
      const callback = rest[rest.length - 1];
      const error = denied(hostname);
      if (typeof callback === 'function') {
        process.nextTick(() => callback(error));
        return;
      }
      throw error;
    }
    return /** @type {any} */ (originalLookup)(hostname, ...rest);
  }
);

const originalPromisesLookup = dns.promises.lookup;
dns.promises.lookup = /** @type {typeof dns.promises.lookup} */ (
  async function (/** @type {string} */ hostname, /** @type {any[]} */ ...rest) {
    if (!isLoopback(hostname)) throw denied(hostname);
    return /** @type {any} */ (originalPromisesLookup)(hostname, ...rest);
  }
);

for (const method of /** @type {const} */ (['resolve', 'resolve4', 'resolve6', 'resolveAny'])) {
  const original = dns[method];
  /** @type {any} */ (dns)[method] = function (
    /** @type {string} */ hostname,
    /** @type {any[]} */ ...rest
  ) {
    if (!isLoopback(hostname)) throw denied(hostname);
    return /** @type {any} */ (original)(hostname, ...rest);
  };
}

const originalSend = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = /** @type {typeof dgram.Socket.prototype.send} */ (
  function (/** @type {any[]} */ ...args) {
    // send(msg, [offset, length,] port, address, callback): the address is the last string.
    const address = args.find((arg, index) => index > 0 && typeof arg === 'string');
    if (address !== undefined && !isLoopback(address)) throw denied(address);
    return /** @type {any} */ (originalSend).apply(this, args);
  }
);
