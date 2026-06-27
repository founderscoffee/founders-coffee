import { AppError } from '@founders-coffee/core';
import { describe, expect, it } from 'vitest';

import { reportError } from './report.js';
import { createServerLogger } from './server.js';
import type { LogEntry } from './types.js';
import type { LogTransport } from './transports.js';

const captureLogger = (): { logger: ReturnType<typeof createServerLogger>; entries: LogEntry[] } => {
  const entries: LogEntry[] = [];
  return { logger: createServerLogger({ transport: ((e: LogEntry) => void entries.push(e)) as LogTransport }), entries };
};

describe('reportError', () => {
  it('reports an AppError with its stable code + stack', () => {
    const { logger, entries } = captureLogger();
    reportError(new AppError('not_found', 'missing thing'), { market: 'DZ' }, logger);
    expect(entries[0].msg).toBe('missing thing');
    expect((entries[0] as Record<string, unknown>).code).toBe('not_found');
    expect((entries[0] as Record<string, unknown>).market).toBe('DZ');
    expect(typeof (entries[0] as Record<string, unknown>).stack).toBe('string');
  });

  it('reports a plain Error with the constructor name as code', () => {
    const { logger, entries } = captureLogger();
    reportError(new TypeError('bad'), undefined, logger);
    expect((entries[0] as Record<string, unknown>).code).toBe('TypeError');
  });

  it('reports a non-Error throw as code=unknown', () => {
    const { logger, entries } = captureLogger();
    reportError('a string was thrown', undefined, logger);
    expect(entries[0].msg).toBe('a string was thrown');
    expect((entries[0] as Record<string, unknown>).code).toBe('unknown');
  });
});
