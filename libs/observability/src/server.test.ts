import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';

import { ingestClientLogs } from './ingest.js';
import { buildDataPoint, createMetrics } from './metrics.js';
import { runWithContext } from './context.js';
import { createServerLogger } from './server.js';
import type { LogEntry } from './types.js';
import type { LogTransport } from './transports.js';

const recorder = (): { transport: LogTransport; entries: LogEntry[] } => {
  const entries: LogEntry[] = [];
  return { transport: (entry) => void entries.push(entry), entries };
};

describe('server logger', () => {
  it('emits a sanitized structured entry tagged worker', () => {
    const { transport, entries } = recorder();
    createServerLogger({ transport }).info('hello', { market: 'DZ', token: 'leak' });
    expect(entries).toHaveLength(1);
    expect(entries[0].msg).toBe('hello');
    expect(entries[0].level).toBe('info');
    expect(entries[0].service).toBe('worker');
    expect((entries[0] as Record<string, unknown>).market).toBe('DZ');
    expect((entries[0] as Record<string, unknown>).token).toBe('[redacted]');
    expect(typeof entries[0].ts).toBe('string');
  });

  it('respects the level threshold', () => {
    const { transport, entries } = recorder();
    const logger = createServerLogger({ transport, level: 'warn' });
    logger.info('skipped');
    logger.warn('kept');
    expect(entries).toHaveLength(1);
    expect(entries[0].msg).toBe('kept');
  });

  it('merges AsyncLocalStorage request context into every entry', () => {
    const { transport, entries } = recorder();
    const logger = createServerLogger({ transport });
    runWithContext({ market: 'MA', requestId: 'r9' }, () => {
      logger.error('boom');
    });
    expect(entries[0].market).toBe('MA');
    expect(entries[0].requestId).toBe('r9');
  });

  it('per-call context overrides ALS context', () => {
    const { transport, entries } = recorder();
    const logger = createServerLogger({ transport });
    runWithContext({ market: 'MA' }, () => {
      logger.info('override', { market: 'EG' });
    });
    expect(entries[0].market).toBe('EG');
  });

  it('child loggers bind context', () => {
    const { transport, entries } = recorder();
    createServerLogger({ transport }).child({ market: 'EG', locale: 'ar' }).info('scoped');
    expect(entries[0].market).toBe('EG');
    expect(entries[0].locale).toBe('ar');
  });

  it('consoleTransport writes a JSON line via console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    createServerLogger({ level: 'info' }).info('c', { k: 1 });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('"msg":"c"');
    expect(spy.mock.calls[0][0]).toContain('"k":1');
    spy.mockRestore();
  });
});

describe('metrics', () => {
  it('buildDataPoint shapes event -> index/blobs/doubles', () => {
    expect(buildDataPoint('event_created', [1], { market: 'DZ', city: 'algiers' })).toEqual({
      indexes: ['DZ'],
      doubles: [1],
      blobs: ['event_created', 'algiers', ''],
    });
  });

  it('trackCount carries the numeric value', () => {
    expect(buildDataPoint('payment_amount', [1250], { market: 'DZ' }).doubles).toEqual([1250]);
  });

  it('defaults the index to global when no market', () => {
    expect(buildDataPoint('page_view', [1], {}).indexes).toEqual(['global']);
  });

  it('writes to the REAL Analytics Engine binding without throwing', () => {
    const metrics = createMetrics(env.ANALYTICS);
    expect(() => metrics.trackEvent('event_created', { market: 'DZ', city: 'algiers' })).not.toThrow();
    expect(() => metrics.trackCount('payment_amount', 1250, { market: 'DZ' })).not.toThrow();
    expect(() => metrics.trackEvent('page_view')).not.toThrow();
  });
});

describe('ingestClientLogs', () => {
  it('re-emits sanitized client entries preserving service=ui', () => {
    const { transport, entries } = recorder();
    const clientEntry = {
      ts: '2026-01-01T00:00:00.000Z',
      level: 'error',
      msg: 'client boom',
      service: 'ui',
      password: 'p',
    } as LogEntry;
    ingestClientLogs([clientEntry], transport);
    expect(entries).toHaveLength(1);
    expect(entries[0].msg).toBe('client boom');
    expect(entries[0].service).toBe('ui');
    expect((entries[0] as Record<string, unknown>).password).toBe('[redacted]');
  });
});
