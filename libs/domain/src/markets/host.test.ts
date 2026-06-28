import { describe, expect, it } from 'vitest';

import { parseMarketCodeFromHost } from './host.js';

describe('parseMarketCodeFromHost', () => {
  it('extracts a 2-letter market code from a subdomain (uppercased)', () => {
    expect(parseMarketCodeFromHost('dz.founders.coffee')).toBe('DZ');
    expect(parseMarketCodeFromHost('MA.founders.coffee')).toBe('MA');
  });

  it('returns undefined for non-market hosts', () => {
    expect(parseMarketCodeFromHost('founders.coffee')).toBeUndefined();
    expect(parseMarketCodeFromHost('www.founders.coffee')).toBeUndefined();
    expect(parseMarketCodeFromHost('localhost')).toBeUndefined();
    expect(parseMarketCodeFromHost(null)).toBeUndefined();
  });
});
