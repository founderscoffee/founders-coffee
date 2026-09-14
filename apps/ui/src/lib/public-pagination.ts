import { z } from 'zod';

export type PublicPaginationCursor = {
  readonly startsAt: number;
  readonly id: string;
};

export const publicPaginationSearchSchema = z
  .object({
    afterStartsAt: z.coerce.number().int().positive().optional(),
    afterId: z.string().trim().min(1).max(64).optional(),
  })
  .transform((search) =>
    search.afterStartsAt !== undefined && search.afterId ? search : {},
  );

export type PublicPaginationSearch = z.infer<
  typeof publicPaginationSearchSchema
>;

export const hostedPaginationSearchSchema = z
  .object({
    beforeStartsAt: z.coerce.number().int().positive().optional(),
    beforeId: z.string().trim().min(1).max(64).optional(),
  })
  .transform((search) =>
    search.beforeStartsAt !== undefined && search.beforeId ? search : {},
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
