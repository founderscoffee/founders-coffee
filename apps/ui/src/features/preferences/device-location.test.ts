import { afterEach, describe, expect, it } from 'vitest';

import {
  forgetRememberedMarket,
  marketCodeFor,
  rememberedMarket,
} from './device-location';

const MARKETS = [
  { code: 'DZ', slug: 'algeria' },
  { code: 'EG', slug: 'egypt' },
];

const remember = (value: string) => {
  document.cookie = `fc_geo=${value}; path=/`;
};

afterEach(() => forgetRememberedMarket());

describe('rememberedMarket', () => {
  it('reads what this browser was told to remember', () => {
    remember('egypt');
    expect(rememberedMarket()).toBe('egypt');
  });

  it('is null when nothing was remembered', () => {
    expect(rememberedMarket()).toBeNull();
  });

  it('is not confused by another cookie whose name ends the same way', () => {
    document.cookie = 'not_fc_geo=tunisia; path=/';
    expect(rememberedMarket()).toBeNull();
    document.cookie = 'not_fc_geo=; path=/; max-age=0';
  });
});

describe('forgetRememberedMarket', () => {
  it('leaves nothing behind, not an empty value', () => {
    remember('algeria');

    forgetRememberedMarket();

    expect(rememberedMarket()).toBeNull();
    expect(document.cookie).not.toContain('fc_geo');
  });
});

describe('marketCodeFor', () => {
  it('uses the market this browser remembers', () => {
    remember('egypt');
    expect(marketCodeFor(MARKETS)).toBe('EG');
  });

  it('falls back to the first visible market with nothing remembered', () => {
    expect(marketCodeFor(MARKETS)).toBe('DZ');
  });

  it('falls back rather than trusting a market that has gone dark', () => {
    remember('somewhere-retired');
    expect(marketCodeFor(MARKETS)).toBe('DZ');
  });

  it('has an answer even with no markets loaded', () => {
    expect(marketCodeFor([])).toBe('DZ');
  });
});
