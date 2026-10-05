import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { installCaptureScript } from '../../lib/install-prompt';
import { INSTALL_RECORD_KEY } from '../../lib/install-record';

export const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

export const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

export const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export const NOW = Date.parse('2026-10-05T10:00:00Z');

/**
 * Makes the test's browser report this user agent.
 */
export const setUserAgent = (userAgent: string): void => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
};

/**
 * Gives jsdom the display-mode query it lacks, answering as a browser tab or as the installed app.
 */
export const setDisplay = (isInstalled: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isInstalled && query === '(display-mode: standalone)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

/**
 * Chrome's install announcement, answered the given way when its prompt is shown.
 */
export const installEvent = (outcome: 'accepted' | 'dismissed') => {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  return { event, prompt };
};

/**
 * Chrome announcing the app after the page has started.
 */
export const announce = (event: Event): void => {
  act(() => {
    window.dispatchEvent(event);
  });
};

/**
 * Chrome announcing the app before the page has started, caught by the real head script.
 *
 * The script's own listener goes on a page of its own rather than the test's window, so it cannot
 * catch another test's announcement; what it holds lands on the real window, where the app reads it.
 */
export const announceBeforeStart = (event: Event): void => {
  const page = new EventTarget();
  const run = new Function(
    'addEventListener',
    'navigator',
    installCaptureScript(),
  ) as (listen: EventTarget['addEventListener'], agent: object) => void;
  run(page.addEventListener.bind(page), { userAgent: ANDROID_CHROME });
  page.dispatchEvent(event);
};

/**
 * A browser that first opened the site this long before now.
 */
export const firstSeenAgo = (milliseconds: number): void => {
  localStorage.setItem(
    INSTALL_RECORD_KEY,
    JSON.stringify({ firstSeenAt: NOW - milliseconds, outcome: null }),
  );
};

/**
 * How this browser answered the sheet, as stored.
 */
export const storedOutcome = (): unknown =>
  JSON.parse(localStorage.getItem(INSTALL_RECORD_KEY) ?? 'null')?.outcome;

/**
 * The reader tapping somewhere on the page.
 */
export const tap = (): void => {
  fireEvent.pointerDown(document.body);
};

/**
 * Lets this much time pass.
 */
export const wait = (milliseconds: number): void => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

/**
 * Lets the promises a tap started settle.
 */
export const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

/**
 * The sheet, found by its name the way a screen reader finds it.
 */
export const sheet = (name = 'Get the app'): HTMLElement | null =>
  screen.queryByRole('region', { name });
