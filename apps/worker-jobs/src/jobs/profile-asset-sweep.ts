import {
  deleteProfileAsset,
  listCollectableProfileAssets,
  type Db,
} from '@founders-coffee/db';
import type { PhotoStore } from '@founders-coffee/infra';
import { logger } from '@founders-coffee/observability';

export interface AssetSweepResult {
  readonly collected: number;
  readonly objectsRemoved: number;
  readonly failed: number;
}

/**
 * Collect the photos nothing points at any more.
 *
 * Two kinds arrive here and both are ordinary rather than exceptional: a reservation whose member
 * closed the tab before uploading, and a photo that was replaced or withdrawn. Removal is deliberately
 * not done inside the request that withdrew it — an R2 round trip and its failure modes have no
 * business inside a request that has already told a member their photo is gone.
 *
 * Bytes go before the row does. A row without objects is collected again on the next pass and costs
 * one wasted delete; an object without a row is a byte nobody can name and nobody will ever remove.
 * Each asset is handled on its own so that one failure does not strand the rest of the batch.
 */
export const sweepProfileAssets = async (
  db: Db,
  store: PhotoStore,
  now = new Date(),
  limit = 50,
): Promise<AssetSweepResult> => {
  const due = await listCollectableProfileAssets(db, now, limit);
  let objectsRemoved = 0;
  let collected = 0;
  let failed = 0;

  for (const asset of due) {
    try {
      objectsRemoved += await store.deletePrefix(`${asset.objectKey}/`);
      await deleteProfileAsset(db, asset.id);
      collected += 1;
    } catch {
      failed += 1;
      logger.warn('profile_asset_sweep_failed', { assetId: asset.id });
    }
  }

  if (collected > 0 || failed > 0)
    logger.info('profile_asset_sweep', { collected, objectsRemoved, failed });
  return { collected, objectsRemoved, failed };
};
