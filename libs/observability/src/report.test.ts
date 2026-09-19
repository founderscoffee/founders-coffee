import { AppError } from '@founders-coffee/core';
import { describe, expect, it } from 'vitest';

import { reportError } from './report.js';
import { createServerLogger } from './server.js';
import type { LogEntry } from './types.js';
import type { LogTransport } from './transports.js';

const captureLogger = (): {
  logger: ReturnType<typeof createServerLogger>;
  entries: LogEntry[];
} => {
  const entries: LogEntry[] = [];
  return {
    logger: createServerLogger({
      transport: ((e: LogEntry) => void entries.push(e)) as LogTransport,
    }),
    entries,
  };
};

describe('reportError', () => {
  it('reports an AppError with its stable code + stack', () => {
    const { logger, entries } = captureLogger();
    reportError(
      new AppError('event_full', 'no seats left'),
      { market: 'DZ' },
      logger,
    );
    expect(entries[0].msg).toBe('no seats left');
    expect((entries[0] as Record<string, unknown>).code).toBe('event_full');
    expect((entries[0] as Record<string, unknown>).market).toBe('DZ');
    expect(typeof (entries[0] as Record<string, unknown>).stack).toBe('string');
    expect(entries[0].level).toBe('error');
  });

  it('drops a not-found to info so routine 404s do not read as faults', () => {
    const { logger, entries } = captureLogger();
    reportError(
      new AppError('market_not_found', 'No visible market for sw-push.js'),
      undefined,
      logger,
    );
    expect(entries[0].level).toBe('info');
    expect(entries[0].msg).toBe('No visible market for sw-push.js');
    expect((entries[0] as Record<string, unknown>).code).toBe(
      'market_not_found',
    );
  });

  it('keeps every not-found code out of error, whatever it names', () => {
    const { logger, entries } = captureLogger();
    for (const code of [
      'not_found',
      'event_not_found',
      'city_not_found',
      'rsvp_not_found',
      'order_not_found',
    ]) {
      reportError(new AppError(code, code), undefined, logger);
    }
    expect(entries.map((entry) => entry.level)).toEqual([
      'info',
      'info',
      'info',
      'info',
      'info',
    ]);
  });

  it('reports a plain Error with the constructor name as code', () => {
    const { logger, entries } = captureLogger();
    reportError(new TypeError('bad'), undefined, logger);
    expect((entries[0] as Record<string, unknown>).code).toBe('TypeError');
    expect(entries[0].level).toBe('error');
  });

  it('reports a non-Error throw as code=unknown', () => {
    const { logger, entries } = captureLogger();
    reportError('a string was thrown', undefined, logger);
    expect(entries[0].msg).toBe('a string was thrown');
    expect((entries[0] as Record<string, unknown>).code).toBe('unknown');
    expect(entries[0].level).toBe('error');
  });
});
