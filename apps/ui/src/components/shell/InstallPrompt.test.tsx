import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENGAGED_AFTER_MS,
  RETURN_AFTER_MS,
  RETURN_SETTLE_MS,
} from '../../lib/install-prompt';
import { INSTALL_RECORD_KEY } from '../../lib/install-record';
import {
  ANDROID_CHROME,
  DESKTOP_CHROME,
  IPHONE_SAFARI,
  NOW,
  announce,
  announceBeforeStart,
  firstSeenAgo,
  installEvent,
  setDisplay,
  setUserAgent,
  settle,
  sheet,
  storedOutcome,
  tap,
  wait,
} from './install-prompt.fixtures';
import { InstallPrompt } from './InstallPrompt';

const LONG_AFTER = 10 * 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  setDisplay(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const showAndroidSheet = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  setUserAgent(ANDROID_CHROME);
  render(<InstallPrompt locale="en" canShow />);
  const install = installEvent(outcome);
  announce(install.event);
  tap();
  wait(ENGAGED_AFTER_MS);
  return install;
};

describe('the install sheet on Android', () => {
  it('opens after a tap and twenty seconds, once Chrome says the app can be installed', () => {
    setUserAgent(ANDROID_CHROME);
    render(<InstallPrompt locale="en" canShow />);
    const { event } = installEvent('accepted');
    announce(event);
    tap();

    wait(ENGAGED_AFTER_MS - 1);
    expect(sheet()).toBeNull();

    wait(1);
    expect(sheet()).not.toBeNull();
    expect(
      event.defaultPrevented,
      'Chrome’s own banner would be a second install offer under the sheet',
    ).toBe(true);
  });

  it('stays closed on a first visit nobody has tapped', () => {
    setUserAgent(ANDROID_CHROME);
    render(<InstallPrompt locale="en" canShow />);
    announce(installEvent('accepted').event);

    wait(LONG_AFTER);

    expect(sheet()).toBeNull();
  });

  it('stays closed while Chrome has not said the app can be installed', () => {
    setUserAgent(ANDROID_CHROME);
    render(<InstallPrompt locale="en" canShow />);
    tap();

    wait(LONG_AFTER);

    expect(
      sheet(),
      'its Install button is Chrome’s prompt, which does not exist until Chrome announces it',
    ).toBeNull();
  });

  it('opens three seconds into a second visit, with the announcement caught before the app started', () => {
    setUserAgent(ANDROID_CHROME);
    firstSeenAgo(RETURN_AFTER_MS);
    announceBeforeStart(installEvent('accepted').event);
    render(<InstallPrompt locale="en" canShow />);

    wait(RETURN_SETTLE_MS - 1);
    expect(sheet()).toBeNull();

    wait(1);
    expect(sheet()).not.toBeNull();
  });

  it('remembers "No thanks" on the device and never opens again there', () => {
    showAndroidSheet();

    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));

    expect(sheet()).toBeNull();
    expect(storedOutcome()).toBe('dismissed');

    cleanup();
    showAndroidSheet();
    wait(LONG_AFTER);
    expect(sheet()).toBeNull();
  });

  it('closes on Escape, which is an answer too', () => {
    showAndroidSheet();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Install' }), {
      key: 'Escape',
    });

    expect(sheet()).toBeNull();
    expect(storedOutcome()).toBe('dismissed');
  });

  it('opens Chrome’s install prompt and remembers an install', async () => {
    const { prompt } = showAndroidSheet('accepted');

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await settle();

    expect(prompt).toHaveBeenCalledOnce();
    expect(sheet()).toBeNull();
    expect(storedOutcome()).toBe('installed');
  });

  it('remembers a cancel in Chrome’s prompt as "No thanks"', async () => {
    showAndroidSheet('dismissed');

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await settle();

    expect(sheet()).toBeNull();
    expect(storedOutcome()).toBe('dismissed');
  });

  it('closes for good when the app is installed from Chrome’s menu instead', () => {
    showAndroidSheet();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(sheet()).toBeNull();
    expect(storedOutcome()).toBe('installed');
  });

  it('never opens inside the installed app', () => {
    setDisplay(true);
    showAndroidSheet();

    expect(sheet()).toBeNull();
  });
});

describe('the install sheet on an iPhone', () => {
  it('shows Safari’s two steps after a tap and twenty seconds', () => {
    setUserAgent(IPHONE_SAFARI);
    render(<InstallPrompt locale="en" canShow />);
    tap();

    wait(ENGAGED_AFTER_MS);

    const steps = screen
      .getAllByRole('listitem')
      .map((step) => step.textContent);
    expect(steps).toEqual(['Tap “Share”', 'Tap “Add to Home Screen”']);
  });

  it('closes for good on "Got it"', () => {
    setUserAgent(IPHONE_SAFARI);
    render(<InstallPrompt locale="en" canShow />);
    tap();
    wait(ENGAGED_AFTER_MS);

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(sheet()).toBeNull();
    expect(storedOutcome()).toBe('dismissed');
  });

  it('speaks the page’s language', () => {
    setUserAgent(IPHONE_SAFARI);
    render(<InstallPrompt locale="ar" canShow />);
    tap();

    wait(ENGAGED_AFTER_MS);

    expect(sheet('ثبّت التطبيق')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'حسنًا' })).toBeTruthy();
  });
});

describe('the install sheet on a computer', () => {
  it('never opens, and keeps nothing on the device', () => {
    setUserAgent(DESKTOP_CHROME);
    render(<InstallPrompt locale="en" canShow />);
    announce(installEvent('accepted').event);
    tap();

    wait(LONG_AFTER);

    expect(sheet()).toBeNull();
    expect(localStorage.getItem(INSTALL_RECORD_KEY)).toBeNull();
  });
});
