import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  alertFailure,
  CLOSEOUT_INTENT_FAILED_METRIC,
  SCHEDULE_ARM_FAILED_METRIC,
} from './alerts.js';

const points = () =>
  vi
    .mocked(env.ANALYTICS.writeDataPoint)
    .mock.calls.map(([point]) => point as AnalyticsEngineDataPoint);

const recorder = () => vi.spyOn(env.ANALYTICS, 'writeDataPoint');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a swallowed failure still reaches somewhere alertable', () => {
  it('writes one data point naming the failure', () => {
    recorder();

    alertFailure(CLOSEOUT_INTENT_FAILED_METRIC, 'DZ');

    expect(points()).toHaveLength(1);
    expect(points()[0]?.blobs?.[0]).toBe('closeout_intent_failed');
  });

  it('indexes it by market, so a threshold can be set per market', () => {
    recorder();

    alertFailure(CLOSEOUT_INTENT_FAILED_METRIC, 'DZ');

    expect(points()[0]?.indexes).toEqual(['DZ']);
  });

  it('falls back to the global index where there is no market to name', () => {
    recorder();

    alertFailure(SCHEDULE_ARM_FAILED_METRIC);

    expect(points()[0]?.indexes).toEqual(['global']);
  });

  it('never becomes the throw the caller was built to avoid', () => {
    recorder().mockImplementation(() => {
      throw new Error('dataset unavailable');
    });

    expect(() => alertFailure(SCHEDULE_ARM_FAILED_METRIC)).not.toThrow();
  });
});
