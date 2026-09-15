import { describe, expect, it } from 'vitest';
import { createConfig } from './config.js';

describe('app config', () => {
  it('applies defaults for env and market', () => {
    expect(createConfig({ name: 'founders.coffee' })).toEqual({
      name: 'founders.coffee',
      env: 'development',
      defaultMarketCode: 'DZ',
    });
  });

  it('honours provided values', () => {
    expect(
      createConfig({
        name: 'founders.coffee',
        env: 'production',
        defaultMarketCode: 'EG',
      }),
    ).toEqual({
      name: 'founders.coffee',
      env: 'production',
      defaultMarketCode: 'EG',
    });
  });

  it('rejects an invalid environment', () => {
    expect(() =>
      createConfig({ name: 'x', env: 'prod' as never }),
    ).toThrowError(/Invalid AppEnvironment/);
  });
});
