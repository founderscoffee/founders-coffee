import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { offline_notice, type Locale } from '@founders-coffee/i18n';

import { OfflineNotice } from './OfflineNotice';

const setOnLine = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });

const goOffline = () => {
  setOnLine(false);
  act(() => void window.dispatchEvent(new Event('offline')));
};

afterEach(() => {
  cleanup();
  setOnLine(true);
});

describe('offline notice', () => {
  it('says nothing while the network is there', () => {
    render(<OfflineNotice locale="ar" />);

    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it.each<Locale>(['ar', 'fr', 'en'])(
    'tells the visitor what they are looking at in %s',
    (locale) => {
      render(<OfflineNotice locale={locale} />);
      goOffline();

      expect(screen.getByRole('alert').textContent).toBe(
        offline_notice({}, { locale }),
      );
      expect(
        screen.getByRole('alert').className,
        'the notice was amber text on an amber strip, so only its colour marked it as a warning',
      ).toContain('alert-warning');
    },
  );

  it('announces the change, rather than appearing as a new live region', () => {
    render(<OfflineNotice locale="en" />);
    const region = screen.getByRole('alert');

    goOffline();

    expect(screen.getByRole('alert')).toBe(region);
  });

  it('clears itself when the network comes back', () => {
    render(<OfflineNotice locale="en" />);
    goOffline();

    setOnLine(true);
    act(() => void window.dispatchEvent(new Event('online')));

    expect(screen.getByRole('alert').textContent).toBe('');
  });
});
