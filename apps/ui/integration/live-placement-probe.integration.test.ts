import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import worker from '../src/server';

const PROBE_URL = 'https://staging.founders.coffee/api/live-placement-probe';

const probe = async (
  requestEnv: typeof env = env,
  method = 'GET',
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(PROBE_URL, {
      method,
      cf: { colo: 'BCN', country: 'DZ', clientTcpRtt: 42 },
    }),
    requestEnv,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('the live room placement probe (#88)', () => {
  it('times five round trips to a room created under each candidate hint', async () => {
    const response = await probe();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({
      colo: 'BCN',
      country: 'DZ',
      clientTcpRttMs: 42,
      hints: ['weur', 'me', 'afr'].map((hint) => ({
        hint,
        roomStatus: 405,
        roundTripMs: Array.from({ length: 5 }, () => expect.any(Number)),
      })),
    });
  });

  it('is not served in production', async () => {
    const response = await probe({
      ...env,
      APP_ENVIRONMENT: 'production',
      APP_URL: 'https://founders.coffee',
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).not.toContain(
      'application/json',
    );
  });

  it('answers nothing but a read', async () => {
    const response = await probe(env, 'POST');

    expect(response.headers.get('content-type') ?? '').not.toContain(
      'application/json',
    );
  });
});
