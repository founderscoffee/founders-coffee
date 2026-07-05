/**
 * Server-bootstrap side effect: inject the real server logger into the isomorphic `logger`
 * singleton. Import this once from each app's server entry (`apps/<app>/src/server.ts` or
 * `index.ts`) — its top-level `setLogger(createServerLogger())` runs at module load, before any
 * request handler or queue consumer logs.
 *
 * This is the ONLY place outside `./server.js` itself that imports the server logger factory (→
 * `./context.js` → `node:async_hooks`). It MUST stay server-only — never import it from
 * client-reachable code, or `AsyncLocalStorage` leaks into the browser bundle. The public
 * `@founders-coffee/observability` barrel does not re-export it; reach it via the
 * `@founders-coffee/observability/server-init` subpath.
 */
import { setLogger } from './logger.js';
import { createServerLogger } from './server.js';

setLogger(createServerLogger());
