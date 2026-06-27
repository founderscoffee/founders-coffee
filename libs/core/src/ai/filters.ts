export interface VectorFilterInput {
  readonly marketCode?: string;
  readonly type?: string;
}

/**
 * Build a Vectorize metadata-filter expression (`{ field: { $eq: value } }`) from a typed input —
 * scopes search by market + entity type. Returns `undefined` when no filters apply (unscoped search),
 * so callers can pass the result straight through to `search({ filter })`.
 */
export const buildVectorizeFilter = (
  input: VectorFilterInput,
): Record<string, unknown> | undefined => {
  const filter: Record<string, unknown> = {};
  if (input.marketCode) filter.marketCode = { $eq: input.marketCode };
  if (input.type) filter.type = { $eq: input.type };
  return Object.keys(filter).length > 0 ? filter : undefined;
};
