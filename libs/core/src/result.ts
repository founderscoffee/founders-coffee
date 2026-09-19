export interface Ok<T> {
  readonly ok: true;
  readonly data: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = AppError> = Ok<T> | Err<E>;

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
export const handleResult = async <T>(
  promise: Promise<Result<T>>,
): Promise<T> => {
  const result = await promise;
  if (!result.ok) throw result.error;
  return result.data;
};

/**
 * Type-safe read of the stable `code` from an error received client-side (e.g. a
 * TanStack Query error). TanStack serializes the thrown `AppError.code` across the
 * wire at runtime, but TypeScript types the client error generically (the [#6428]
 * gap) — this reads it without a cast at every call site. Returns `'unknown'` when
 * no code is present, so UI can fall back to a generic message.
 */
export const appErrorCode = (error: unknown): string => {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }
  return 'unknown';
};

const NOT_FOUND_CODE = /(^|_)not_found$/u;

/**
 * True when `code` names something the request asked for and the system could not find: an unknown
 * market slug, a deleted event, a root-level file request falling through to `$market/$city`.
 * Nothing broke in any of them, so whatever logs or alerts on an error should treat these as
 * routine (FC-13 — routine 404s reported at `error` bury the real errors in production).
 *
 * The contract is the `_not_found` suffix rather than a registry, so a `venue_not_found` written
 * next year is covered without anyone remembering to register it. Name a new code to match.
 *
 * Deliberately narrow. `forbidden`, `unauthenticated` and `rate_limited` are just as expected in
 * the sense that the system behaved correctly, but a burst of those is a signal worth keeping loud.
 */
export const isNotFoundCode = (code: string): boolean =>
  NOT_FOUND_CODE.test(code);
