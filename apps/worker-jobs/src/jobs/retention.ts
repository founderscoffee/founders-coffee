const RETENTION_BATCH = 500;
const RETENTION_PASSES = 10;

/**
 * Run one retention delete in batches of 500 until a batch comes back short or the night's ten
 * passes are spent: the bounded daily sweep AGENTS.md §11.5 allows (#106). `deleteBatch` deletes up
 * to `limit` rows and says how many went; this returns how many went in all.
 */
export const deleteInPasses = async (
  deleteBatch: (limit: number) => Promise<number>,
): Promise<number> => {
  let deleted = 0;
  for (let pass = 0; pass < RETENTION_PASSES; pass += 1) {
    const batch = await deleteBatch(RETENTION_BATCH);
    deleted += batch;
    if (batch < RETENTION_BATCH) break;
  }
  return deleted;
};
