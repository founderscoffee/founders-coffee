import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyLink, currentShareUrl, shareNatively } from './share';

const EVENT = {
  title: 'Coffee + Code',
  text: 'Join us',
  url: 'https://founders.coffee/ar/algeria/e/coffee-code',
};

const withNavigator = (patch: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(patch)) {
    Object.defineProperty(navigator, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
};

const dropFromNavigator = (...keys: string[]) => {
  for (const key of keys) {
    Reflect.deleteProperty(navigator, key);
  }
};

afterEach(() => {
  dropFromNavigator('share', 'clipboard');
  vi.restoreAllMocks();
});

describe('currentShareUrl', () => {
  it('hands out the address without the query it was reached by', () => {
    window.history.replaceState(
      {},
      '',
      '/ar/algeria/e/coffee-code?afterId=feed-seed-17&utm_source=x#map',
    );
    expect(currentShareUrl()).toBe(
      `${window.location.origin}/ar/algeria/e/coffee-code`,
    );
  });
});

describe('shareNatively', () => {
  it('says unavailable where the browser has no share sheet', async () => {
    dropFromNavigator('share');
    expect(await shareNatively(EVENT)).toBe('unavailable');
  });

  it('passes the title, text and link to the sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    withNavigator({ share });

    expect(await shareNatively(EVENT)).toBe('shared');
    expect(share).toHaveBeenCalledWith(EVENT);
  });

  it('calls the sheet before awaiting anything, so the click still counts', async () => {
    const order: string[] = [];
    withNavigator({
      share: vi.fn(() => {
        order.push('share');
        return Promise.resolve();
      }),
    });

    const pending = shareNatively(EVENT);
    order.push('after-call');
    await pending;

    expect(
      order,
      'awaiting before navigator.share spends the transient activation and the sheet never opens',
    ).toEqual(['share', 'after-call']);
  });

  it('reads a closed sheet as dismissed, not as a reason to fall back', async () => {
    const abort = new Error('cancelled');
    abort.name = 'AbortError';
    withNavigator({ share: vi.fn().mockRejectedValue(abort) });

    expect(await shareNatively(EVENT)).toBe('dismissed');
  });

  it('falls back when the sheet is refused rather than closed', async () => {
    const refused = new Error('policy');
    refused.name = 'NotAllowedError';
    withNavigator({ share: vi.fn().mockRejectedValue(refused) });

    expect(await shareNatively(EVENT)).toBe('unavailable');
  });
});

describe('copyLink', () => {
  it('says no where the clipboard is missing', async () => {
    dropFromNavigator('clipboard');
    expect(await copyLink(EVENT.url)).toBe(false);
  });

  it('writes the link and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withNavigator({ clipboard: { writeText } });

    expect(await copyLink(EVENT.url)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(EVENT.url);
  });

  it('says no rather than throwing when the write is refused', async () => {
    withNavigator({
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    expect(await copyLink(EVENT.url)).toBe(false);
  });
});
