import { z } from 'zod';

export type PublicPaginationCursor = {
  readonly startsAt: number;
  readonly id: string;
};

/**
 * Validate the public feed cursor carried in the URL: both halves, or neither.
 *
 * An incomplete pair resolves to both keys set to `undefined` rather than to `{}`, because the
 * router merges a validator's result over the raw search (`{ ...parentSearch, ...validated }`).
 * Spreading `{}` overrides nothing, so `?afterId=` alone would survive validation and reach
 * `landingPaginationSchema`, whose `refine` rejects a half cursor — a 500 on a crawlable URL.
 * Naming both keys is what actually erases them, and `encode` skips `undefined`, so the URL stays
 * clean and the router redirects to the canonical page instead.
 */
export const publicPaginationSearchSchema = z
  .object({
    afterStartsAt: z.coerce.number().int().positive().optional(),
    afterId: z.string().trim().min(1).max(64).optional(),
  })
  .transform((search) =>
    search.afterStartsAt !== undefined && search.afterId
      ? search
      : { afterStartsAt: undefined, afterId: undefined },
  );

export type PublicPaginationSearch = z.infer<
  typeof publicPaginationSearchSchema
>;

/**
 * Validate the hosted-history cursor, under the same pairing rule as the public feed.
 *
 * Kept symmetrical with `publicPaginationSearchSchema` deliberately: no resolver behind this one
 * rejects a half cursor today, so returning `{}` merely fails to strip rather than erroring, but
 * the first resolver that adds the pairing check would inherit the same 500.
 */
export const hostedPaginationSearchSchema = z
  .object({
    beforeStartsAt: z.coerce.number().int().positive().optional(),
    beforeId: z.string().trim().min(1).max(64).optional(),
  })
  .transform((search) =>
    search.beforeStartsAt !== undefined && search.beforeId
      ? search
      : { beforeStartsAt: undefined, beforeId: undefined },
  );

export type HostedPaginationSearch = z.infer<
  typeof hostedPaginationSearchSchema
>;

export const paginationSearch = (
  cursor: PublicPaginationCursor | null | undefined,
): PublicPaginationSearch =>
  cursor ? { afterStartsAt: cursor.startsAt, afterId: cursor.id } : {};

export const hostedPaginationSearch = (
  cursor: PublicPaginationCursor | null | undefined,
): HostedPaginationSearch =>
  cursor ? { beforeStartsAt: cursor.startsAt, beforeId: cursor.id } : {};

/**
 * Forward a feed cursor to a server function only when both halves are present.
 *
 * `landingPaginationSchema` rejects a half cursor outright, so a loader that spreads its deps into
 * the payload must not hand one over. The search schema already normalises what arrives from the
 * URL; this is the same invariant enforced at the data boundary, where the server actually requires
 * it, so a future caller building deps by hand cannot reintroduce the 500.
 */
export const cursorPairOnly = (
  deps: PublicPaginationSearch,
): PublicPaginationSearch =>
  deps.afterStartsAt !== undefined && deps.afterId
    ? deps
    : { afterStartsAt: undefined, afterId: undefined };

export const paginationQuery = (
  search: PublicPaginationSearch | PublicPaginationCursor | null | undefined,
): string | undefined => {
  if (!search) return undefined;
  const afterStartsAt =
    'startsAt' in search ? search.startsAt : search.afterStartsAt;
  const afterId = 'startsAt' in search ? search.id : search.afterId;
  if (afterStartsAt === undefined || !afterId) return undefined;
  return new URLSearchParams({
    afterStartsAt: String(afterStartsAt),
    afterId,
  }).toString();
};

export const hostedPaginationQuery = (
  search: HostedPaginationSearch | PublicPaginationCursor | null | undefined,
): string | undefined => {
  if (!search) return undefined;
  const beforeStartsAt =
    'startsAt' in search ? search.startsAt : search.beforeStartsAt;
  const beforeId = 'startsAt' in search ? search.id : search.beforeId;
  if (beforeStartsAt === undefined || !beforeId) return undefined;
  return new URLSearchParams({
    beforeStartsAt: String(beforeStartsAt),
    beforeId,
  }).toString();
};
