import { describe, expect, it, vi } from 'vitest';

import { createClientLogger } from './client.js';
import { createBeaconTransport, type BatchTransport } from './transports.js';
import type { LogEntry } from './types.js';

const batchRecorder = (): {
  transport: BatchTransport;
  batches: LogEntry[][];
} => {
  const batches: LogEntry[][] = [];
  return { transport: (entries) => void batches.push(entries), batches };
};

describe('client logger', () => {
  it('buffers entries and flushes a batch when the buffer fills', () => {
    const { transport, batches } = batchRecorder();
    const logger = createClientLogger({
      transport,
      bufferSize: 2,
      level: 'debug',
    });
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
    createClientLogger({ transport, bufferSize: 1, level: 'debug' }).info('x', {
      token: 'leak',
    });
    expect((batches[0][0] as Record<string, unknown>).token).toBe('[redacted]');
  });

  it('cuts the values of a failed query out of the message before buffering', () => {
    const { transport, batches } = batchRecorder();
    createClientLogger({ transport, bufferSize: 1 }).error(
      'Failed query: insert into "chat_message" ("body") values (?)\nparams: meet at the corner café',
    );
    expect(batches[0][0].msg).toBe(
      'Failed query: insert into "chat_message" ("body") values (?)',
    );
  });

  it('tags entries service=ui', () => {
    const { transport, batches } = batchRecorder();
    createClientLogger({ transport, bufferSize: 1 }).info('x');
    expect(batches[0][0].service).toBe('ui');
  });

  it('respects the level threshold', () => {
    const { transport, batches } = batchRecorder();
    const logger = createClientLogger({
      transport,
      bufferSize: 1,
      level: 'warn',
    });
    logger.info('skipped');
    logger.warn('kept');
    expect(batches).toHaveLength(1);
    expect(batches[0][0].msg).toBe('kept');
  });

  it('child loggers bind context', () => {
    const { transport, batches } = batchRecorder();
    createClientLogger({ transport, bufferSize: 1, level: 'debug' })
      .child({ market: 'EG' })
      .info('x');
    expect(batches[0][0].market).toBe('EG');
  });

  it('does not throw when window/navigator are absent', () => {
    expect(() => createClientLogger({ bufferSize: 5 })).not.toThrow();
  });

  it('stamps each entry with the path of the page it was logged on, and nothing after it', () => {
    const { transport, batches } = batchRecorder();
    const g = globalThis as unknown as Record<string, unknown>;
    const original = g.location;
    g.location = {
      pathname: '/ar/algeria',
      search: '?afterId=evt_1',
      hash: '#market-events',
    };
    try {
      const logger = createClientLogger({ transport, bufferSize: 2 });
      logger.error('first');
      g.location = { pathname: '/ar/algeria/oran', search: '', hash: '' };
      logger.error('second');
    } finally {
      if (original === undefined) delete g.location;
      else g.location = original;
    }

    expect(batches[0].map((entry) => entry.path)).toEqual([
      '/ar/algeria',
      '/ar/algeria/oran',
    ]);
  });

  it('leaves the path out where there is no page', () => {
    const { transport, batches } = batchRecorder();
    createClientLogger({ transport, bufferSize: 1 }).error('x');
    expect(batches[0][0]).not.toHaveProperty('path');
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
      const entries = [
        { ts: 't', level: 'info', msg: 'hi', service: 'ui' },
      ] as LogEntry[];
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

  it('falls back to a keepalive fetch where there is no sendBeacon, so the batch outlives its page', () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null)));
    const g = globalThis as unknown as Record<string, unknown>;
    const original = { navigator: g.navigator, fetch: g.fetch };
    g.navigator = {};
    g.fetch = fetch;
    try {
      const entries = [
        { ts: 't', level: 'info', msg: 'hi', service: 'ui' },
      ] as LogEntry[];
      expect(createBeaconTransport('/client-logs')(entries)).toBe(true);
      expect(
        fetch,
        'a fetch without keepalive may be cancelled with the page it was sent from, losing the batch a beacon would have delivered',
      ).toHaveBeenCalledWith('/client-logs', {
        method: 'POST',
        body: JSON.stringify({ entries }),
        keepalive: true,
      });
    } finally {
      g.fetch = original.fetch;
      if (original.navigator === undefined) delete g.navigator;
      else g.navigator = original.navigator;
    }
  });
});
