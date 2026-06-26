/**
 * Result/Error envelope — the typed error channel for server functions.
 * (AGENTS.md §7: server fns return Result; §11.5: TanStack Query unwraps via handleResult.)
 *
 * Components never hand-check `!ok`; they consume server state through TanStack Query,
 * whose error states only activate when a function *throws* — hence `handleResult`.
 */

export interface Ok<T> {
  readonly ok: true;
  readonly data: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = AppError> = Ok<T> | Err<E>;

/** Typed application error carrying a stable machine `code` + human `message`. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });

export const err = <E = AppError>(error: E): Err<E> => ({ ok: false, error });

/**
 * Unwrap a `Promise<Result>` for TanStack Query: throws on `!ok` so `useQuery` /
 * `useMutation` enter their error state automatically. The single, DRY bridge between
 * the Result envelope and React Query — never replicate `if (!data.ok)` in components.
 */
export async function handleResult<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw result.error;
  return result.data;
}
