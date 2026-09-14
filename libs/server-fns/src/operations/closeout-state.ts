import { ok, type Result } from '@founders-coffee/core';
import {
  communityOperationsEnabled,
  listCloseoutStates,
  type Db,
} from '@founders-coffee/db';

export interface CloseoutStateView {
  readonly eventId: string;
  readonly closed: boolean;
  readonly outcome: 'held' | 'did_not_happen' | null;
}

/**
 * What `/activity` needs to stop offering a link that leads nowhere.
 *
 * The hosted list showed "Close it out" beside every past gathering regardless of whether one had
 * been closed out, whether the market had community operations turned on, or whether the event had a
 * recorded end at all. Two of those three are permanent noes, and the third is work the host already
 * did — all of them read to the host as the product forgetting.
 *
 * An event the caller does not host, or one that could never be closed out, is simply absent from
 * the answer. "Nothing to offer" is not "offer it again", and a caller that could not tell the two
 * apart would be back to guessing.
 *
 * The flag is evaluated once per distinct market rather than once per event: a page of twenty
 * gatherings in one market is one read, and §5's gate still decides every row. Markets are read from
 * the rows the database returned, never from anything the caller sent.
 */
export const readCloseoutStates = async (
  db: Db,
  opts: { hostId: string; eventIds: readonly string[] },
): Promise<Result<readonly CloseoutStateView[]>> => {
  const states = await listCloseoutStates(db, opts);
  const markets = [...new Set(states.map((state) => state.marketCode))];
  const enabled = new Map(
    await Promise.all(
      markets.map(
        async (market) =>
          [market, await communityOperationsEnabled(db, market)] as const,
      ),
    ),
  );

  return ok(
    states
      .filter((state) => enabled.get(state.marketCode))
      .map(({ eventId, closed, outcome }) => ({ eventId, closed, outcome })),
  );
};
