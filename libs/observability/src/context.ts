import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  readonly market?: string;
  readonly locale?: string;
  readonly userId?: string;
  readonly requestId?: string;
}

const EMPTY_CONTEXT: RequestContext = {};

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run `fn` with `ctx` as the active request context. Propagates across awaits
 * under `nodejs_compat`. P0-012 request middleware wraps each server-fn in this so
 * logs auto-carry market/request context with no manual threading.
 */
export const runWithContext = <T>(ctx: RequestContext, fn: () => T): T =>
  storage.run(ctx, fn);

/** The active request context, or `{}` when not inside a `runWithContext` scope. */
export const getRequestContext = (): RequestContext =>
  storage.getStore() ?? EMPTY_CONTEXT;
