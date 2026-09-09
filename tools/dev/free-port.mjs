import { execFileSync } from 'node:child_process';

const TERM_GRACE_MS = 700;

/**
 * The process ids currently listening on a TCP port.
 *
 * `-sTCP:LISTEN` is what makes this safe to kill: without it `lsof` also reports every client
 * connected to the port, which on a dev machine means the browser tab that happens to have the app
 * open. `lsof` exits non-zero when nothing matches, which is the ordinary case rather than a
 * failure, so the throw is swallowed and read as an empty list.
 *
 * @param {number} port TCP port to inspect.
 * @returns {number[]} listening process ids, or an empty list on any platform without `lsof`.
 */
const listenersOn = (port) => {
  try {
    return execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
};

const signal = (pid, name) => {
  try {
    process.kill(pid, name);
    return true;
  } catch {
    return false;
  }
};

const sleep = (ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
};

/**
 * Take back a port a previous dev server never let go of.
 *
 * Restarting the dev server is how nearly every local problem gets cleared, and Vite answers a
 * taken port by quietly moving to the next one — so the reload loop stays alive on 3000, the new
 * server comes up on 3001, and the browser tab keeps talking to the wedged one. That has cost this
 * repository real debugging time more than once.
 *
 * `SIGTERM` first so the runtime can shut its Miniflare child down; `SIGKILL` only for what is
 * still holding the port afterwards, which is precisely the case worth being blunt about. Nothing
 * here fails the script: a free port, a platform without `lsof`, and a process that has already
 * gone are all simply nothing to do.
 *
 * @param {number} port TCP port to free.
 * @returns {number[]} the process ids that were signalled.
 */
export const freePort = (port) => {
  const listeners = listenersOn(port);
  if (listeners.length === 0) return [];

  const terminated = listeners.filter((pid) => signal(pid, 'SIGTERM'));
  sleep(TERM_GRACE_MS);
  for (const pid of listenersOn(port)) signal(pid, 'SIGKILL');
  return terminated;
};

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
  console.error('free-port: expected a port number');
  process.exit(1);
}
const freed = freePort(port);
if (freed.length > 0)
  console.log(`free-port: stopped ${freed.join(', ')} on :${port}`);
