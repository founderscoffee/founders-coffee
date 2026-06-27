import { describe, expect, it, vi } from 'vitest';

import { createClientLogger } from './client.js';
import { createBeaconTransport, type BatchTransport } from './transports.js';
import type { LogEntry } from './types.js';

const batchRecorder = (): { transport: BatchTransport; batches: LogEntry[][] } => {
  const batches: LogEntry[][] = [];
  return { transport: (entries) => void batches.push(entries), batches };
};

describe('client logger', () => {
  it('buffers entries and flushes a batch when the buffer fills', () => {
    const { transport, batches } = batchRecorder();
    const logger = createClientLogger({ transport, bufferSize: 2, level: 'debug' });
    logger.info('a');
    expect(batches).toHaveLength(0);
    logger.info('b');
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0][0].msg).toBe('a');
    expect(batches[0][1].msg).toBe('b');
  });

  it('sanitizes before buffering', () => {
    const { transport, batches } = batchRecorder();
    createClientLogger({ transport, bufferSize: 1, level: 'debug' }).info('x', { token: 'leak' });
    expect((batches[0][0] as Record<string, unknown>).token).toBe('[redacted]');
  });

  it('tags entries service=ui', () => {
    const { transport, batches } = batchRecorder();
    createClientLogger({ transport, bufferSize: 1 }).info('x');
    expect(batches[0][0].service).toBe('ui');
  });

  it('respects the level threshold', () => {
    const { transport, batches } = batchRecorder();
    const logger = createClientLogger({ transport, bufferSize: 1, level: 'warn' });
    logger.info('skipped');
    logger.warn('kept');
    expect(batches).toHaveLength(1);
    expect(batches[0][0].msg).toBe('kept');
  });

  it('child loggers bind context', () => {
    const { transport, batches } = batchRecorder();
    createClientLogger({ transport, bufferSize: 1, level: 'debug' }).child({ market: 'EG' }).info('x');
    expect(batches[0][0].market).toBe('EG');
  });

  it('does not throw when window/navigator are absent', () => {
    expect(() => createClientLogger({ bufferSize: 5 })).not.toThrow();
  });
});

describe('createBeaconTransport', () => {
  it('serializes a JSON batch via navigator.sendBeacon', () => {
    const sendBeacon = vi.fn(() => true);
    const g = globalThis as unknown as Record<string, unknown>;
    const original = g.navigator;
    g.navigator = { sendBeacon };
    try {
      const transport = createBeaconTransport('/client-logs');
      const entries = [{ ts: 't', level: 'info', msg: 'hi', service: 'ui' }] as LogEntry[];
      expect(transport(entries)).toBe(true);
      expect(sendBeacon).toHaveBeenCalledOnce();
      const [url, body] = sendBeacon.mock.calls[0] as [string, string];
      expect(url).toBe('/client-logs');
      expect(JSON.parse(body)).toEqual({ entries });
    } finally {
      if (original === undefined) delete g.navigator;
      else g.navigator = original;
    }
  });
});
