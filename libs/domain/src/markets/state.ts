import { AppError, err, ok, type Result } from '@founders-coffee/core';

export type MarketState = 'dark' | 'open' | 'active';

const TRANSITIONS: Record<MarketState, readonly MarketState[]> = {
  dark: ['open'],
  open: ['active', 'dark'],
  active: ['open'],
};

export const VISIBLE_STATES: readonly MarketState[] = ['open', 'active'];

export const canTransition = (from: MarketState, to: MarketState): boolean =>
  TRANSITIONS[from].includes(to);

export const transition = (
  from: MarketState,
  to: MarketState,
): Result<MarketState> =>
  canTransition(from, to)
    ? ok(to)
    : err(
        new AppError(
          'invalid_market_transition',
          `Cannot transition market from '${from}' to '${to}'`,
        ),
      );

/** A market is publicly visible unless it is `dark` (FR-G3). */
export const isMarketVisible = (state: MarketState): boolean =>
  VISIBLE_STATES.includes(state);
