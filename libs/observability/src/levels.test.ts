import { describe, expect, it } from 'vitest';
import { LOG_LEVEL_ORDER, parseLogLevel, shouldLog } from './levels.js';

describe('log levels', () => {
  it('orders levels by severity', () => {
    expect(LOG_LEVEL_ORDER.debug).toBeLessThan(LOG_LEVEL_ORDER.info);
    expect(LOG_LEVEL_ORDER.info).toBeLessThan(LOG_LEVEL_ORDER.warn);
    expect(LOG_LEVEL_ORDER.warn).toBeLessThan(LOG_LEVEL_ORDER.error);
    expect(LOG_LEVEL_ORDER.error).toBeLessThan(LOG_LEVEL_ORDER.fatal);
  });

  it('shouldLog respects the threshold', () => {
    expect(shouldLog('error', 'info')).toBe(true);
    expect(shouldLog('debug', 'info')).toBe(false);
    expect(shouldLog('info', 'info')).toBe(true);
  });

  it('parseLogLevel accepts known levels case-insensitively', () => {
    expect(parseLogLevel('WARN')).toBe('warn');
    expect(parseLogLevel('  Error ')).toBe('error');
  });

  it('parseLogLevel falls back on unknown/empty input', () => {
    expect(parseLogLevel(undefined)).toBe('info');
    expect(parseLogLevel('nope')).toBe('info');
    expect(parseLogLevel('nope', 'debug')).toBe('debug');
  });
});
