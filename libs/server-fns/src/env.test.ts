import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { workerEnv } from './env.js';

describe('workerEnv', () => {
  it('returns the live runtime env, not a copy', () => {
    expect(workerEnv()).toBe(env);
  });

  it('exposes the bindings the test worker declares', () => {
    const runtime = workerEnv();
    expect(runtime.DB).toBeDefined();
    expect(runtime.RATE_LIMITER).toBeDefined();
    expect(runtime.APP_URL).toBe('http://localhost');
    expect(runtime.APP_ENVIRONMENT).toBe('development');
  });

  it('leaves an unset binding undefined rather than throwing', () => {
    expect(workerEnv().MAPBOX_TOKEN).toBeUndefined();
    expect(workerEnv().FIREBASE_PROJECT_ID).toBeUndefined();
  });
});
