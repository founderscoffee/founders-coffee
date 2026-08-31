/**
 * Client-environment stub for `node:stream` (resolved via the `clientNodeBuiltinStubs` plugin in
 * `vite.config.ts`, client env only). TanStack Start's streaming-SSR modules statically import the
 * classic Node stream API for the Node `http.ServerResponse` render path — `Readable`
 * (`transformStreamWithRouter`, used by `Readable.fromWeb`/`toWeb`) and `PassThrough`
 * (`renderRouterToStream`, used to pipe the React render stream). That path only runs on the server.
 *
 * Vite externalizes the Node built-in in the client env and throws on the named-import binding, so
 * every statically-imported name must exist here or the browser throws "doesn't provide an export
 * named: '<X>'" and every transitively-dependent module fails to hydrate. We export the full classic
 * surface defensively; none of these are ever instantiated client-side. SSR/Workerd keeps the real
 * `node:stream`.
 */

export class Readable {
  /** Server-only; never invoked in the browser. */
  static fromWeb = (): Readable => {
    throw new Error(
      'Readable.fromWeb is server-only and not available in the browser',
    );
  };

  /** Server-only; never invoked in the browser. */
  static toWeb = (): unknown => {
    throw new Error(
      'Readable.toWeb is server-only and not available in the browser',
    );
  };
}

export class Writable {}
export class Duplex {}
export class Transform {}
export class PassThrough {}
export class Stream {}

/** Server-only; never invoked in the browser. */
export const pipeline = (): void => {
  throw new Error(
    'stream.pipeline is server-only and not available in the browser',
  );
};

/** Server-only; never invoked in the browser. */
export const finished = (): void => {
  throw new Error(
    'stream.finished is server-only and not available in the browser',
  );
};
