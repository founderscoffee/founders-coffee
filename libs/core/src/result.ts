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
