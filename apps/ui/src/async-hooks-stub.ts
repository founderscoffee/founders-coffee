/**
 * Client-environment stub for `node:async_hooks` (aliased in `vite.config.ts`, `client` env only).
 * Shared isomorphic libs — better-auth's core + the observability server logger — import
 * `AsyncLocalStorage` for SERVER-side request context; their browser-facing code never invokes it.
 * Vite externalizes the Node built-in and throws on access; this no-op stub lets the import resolve
 * without dragging Node into the browser bundle. SSR builds keep the real `node:async_hooks`.
 */
export class AsyncLocalStorage<T = unknown> {
  enterWith(_store: T): void {}

  disable(): void {}

  exit(callback: () => void): void {
    callback()
  }

  run<TResult>(_store: T, callback: () => TResult): TResult {
    return callback()
  }

  getStore(): T | undefined {
    return undefined
  }
}
