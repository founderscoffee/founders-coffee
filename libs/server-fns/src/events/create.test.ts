import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, err } from '@founders-coffee/core';
import {
  setLogger,
  type LogEntry,
  type Metrics,
} from '@founders-coffee/observability';
import { createServerLogger } from '@founders-coffee/observability/server';

import { withRequestContext } from '../request-context.js';
import type { MapProvider } from '../maps/provider.js';
import { createEventWithTelemetry, EVENTS_CREATED_METRIC } from './create.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

const FREE_TEXT = {
  title: 'Telemetry redaction meetup',
  description: 'Host-authored description that must never reach a log line.',
  venueName: 'Café des Délices',
  venueAddress: '12 Rue des Entrepreneurs, Alger',
};

const entries: LogEntry[] = [];

const captureLogs = () =>
  setLogger(
    createServerLogger({
      level: 'debug',
      transport: (entry) => {
        entries.push(entry);
      },
    }),
  );

const entryFor = (msg: string): LogEntry | undefined =>
  entries.find((entry) => entry.msg === msg);

const trackedMetrics = () => {
  const trackEvent = vi.fn();
  const metrics: Metrics = { trackEvent, trackCount: vi.fn() };
  return { metrics, trackEvent };
};

const failingProvider: MapProvider = {
  ...testMapProvider,
  describePoint: async () =>
    err(new AppError('map_venue_unsupported', 'Unsupported venue')),
};

describe('createEventWithTelemetry (real D1)', () => {
  beforeEach(() => {
    entries.length = 0;
    captureLogs();
  });
  afterEach(() => {
    entries.length = 0;
  });

  it('logs entry and success correlated by one request id, and counts the event once', async () => {
    const db = await setupDb();
    const { metrics, trackEvent } = trackedMetrics();

    const result = await withRequestContext(() =>
      createEventWithTelemetry(
        db,
        testMapProvider,
        metrics,
        TEST_HOST_ID,
        createInput({ ...FREE_TEXT, cityCode: undefined }),
      ),
    );

    expect(result.ok).toBe(true);
    const requested = entryFor('event_create_requested');
    const succeeded = entryFor('event_create_succeeded');
    expect(requested).toBeDefined();
    expect(succeeded).toBeDefined();
    expect(requested?.requestId).toEqual(succeeded?.requestId);
    expect(requested?.requestId).toBeTruthy();
    expect(requested?.cityCode).toBeNull();
    expect(succeeded).toMatchObject({
      level: 'info',
      hostId: TEST_HOST_ID,
      marketCode: 'DZ',
      cityCode: '556',
      stateCode: '16',
      language: 'fr',
      durationMinutes: 60,
    });
    expect(succeeded?.eventId).toMatch(/^evt_[0-9a-f]{32}$/);
    expect(entryFor('event_create_rejected')).toBeUndefined();

    expect(trackEvent).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledWith(EVENTS_CREATED_METRIC, {
      market: 'DZ',
      city: '556',
      locale: 'fr',
    });
  });

  it('keeps host-authored free text and coordinates out of every log entry', async () => {
    const db = await setupDb();
    const { metrics } = trackedMetrics();

    await withRequestContext(() =>
      createEventWithTelemetry(
        db,
        testMapProvider,
        metrics,
        TEST_HOST_ID,
        createInput({ ...FREE_TEXT, cityCode: undefined }),
      ),
    );

    expect(entries.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(entries);
    for (const value of Object.values(FREE_TEXT)) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).not.toContain('36.7538');
    expect(serialized).not.toContain('3.0588');
    expect(serialized).not.toContain('telemetry-redaction-meetup');
  });

  it('logs the rejecting error code and never counts a rejected write', async () => {
    const db = await setupDb();
    const { metrics, trackEvent } = trackedMetrics();

    const result = await withRequestContext(() =>
      createEventWithTelemetry(
        db,
        failingProvider,
        metrics,
        TEST_HOST_ID,
        createInput({ ...FREE_TEXT, cityCode: undefined }),
      ),
    );

    expect(result.ok).toBe(false);
    expect(entryFor('event_create_rejected')).toMatchObject({
      level: 'warn',
      errorCode: 'map_venue_unsupported',
      hostId: TEST_HOST_ID,
      marketCode: 'DZ',
      cityCode: null,
    });
    expect(entryFor('event_create_succeeded')).toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('never counts a creation the market rejects', async () => {
    const db = await setupDb();
    const { metrics, trackEvent } = trackedMetrics();

    const result = await withRequestContext(() =>
      createEventWithTelemetry(
        db,
        testMapProvider,
        metrics,
        TEST_HOST_ID,
        createInput({ ...FREE_TEXT, marketCode: 'MA', cityCode: '1' }),
      ),
    );

    expect(result.ok).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('still creates the event when the metrics binding is absent', async () => {
    const db = await setupDb();

    const result = await withRequestContext(() =>
      createEventWithTelemetry(
        db,
        testMapProvider,
        null,
        TEST_HOST_ID,
        createInput({ ...FREE_TEXT, cityCode: undefined }),
      ),
    );

    expect(result.ok).toBe(true);
    expect(entryFor('events_created_metric_unavailable')).toMatchObject({
      level: 'warn',
      marketCode: 'DZ',
    });
  });

  it('still creates the event when the metrics writer throws', async () => {
    const db = await setupDb();
    const metrics: Metrics = {
      trackEvent: () => {
        throw new Error('analytics unavailable');
      },
      trackCount: vi.fn(),
    };

    const result = await withRequestContext(() =>
      createEventWithTelemetry(
        db,
        testMapProvider,
        metrics,
        TEST_HOST_ID,
        createInput({ ...FREE_TEXT, cityCode: undefined }),
      ),
    );

    expect(result.ok).toBe(true);
    expect(entryFor('analytics unavailable')).toMatchObject({
      level: 'error',
      operation: EVENTS_CREATED_METRIC,
    });
  });
});
