import { beforeAll, describe, expect, it, vi } from 'vitest';

import { setLogger, type Logger } from '@founders-coffee/observability';
import { getRequestContext } from '@founders-coffee/observability/context';

import { withRequestContext } from './request-context.js';

const consoleLogger: Logger = {
  debug: (m) => console.debug(m),
  info: (m) => console.info(m),
  warn: (m) => console.warn(m),
  error: (m, c) => console.error(m, c),
  fatal: (m) => console.error(m),
  child: () => consoleLogger,
};

describe('withRequestContext', () => {
  beforeAll(() => setLogger(consoleLogger));

  it('generates a requestId available in the request context', async () => {
    let captured: string | undefined;
    await withRequestContext(async () => {
      captured = getRequestContext().requestId;
    });
    expect(captured).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('propagates the requestId across awaits', async () => {
    let captured: string | undefined;
    await withRequestContext(async () => {
      await Promise.resolve();
      await Promise.resolve();
      captured = getRequestContext().requestId;
    });
    expect(captured).toBeTruthy();
  });

  it('logs and re-throws on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      withRequestContext(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('uses a fresh requestId per call', async () => {
    const ids: string[] = [];
    await withRequestContext(async () => {
      ids.push(getRequestContext().requestId!);
    });
    await withRequestContext(async () => {
      ids.push(getRequestContext().requestId!);
    });
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
