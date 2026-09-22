import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareEventButton } from './ShareEventButton';

const TITLE = 'Founders breakfast';

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
  for (const key of keys) Reflect.deleteProperty(navigator, key);
};

const renderButton = () =>
  render(<ShareEventButton locale="en" title={TITLE} label="Share" />);

const clickShare = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
};

afterEach(() => {
  cleanup();
  dropFromNavigator('share', 'clipboard');
  vi.restoreAllMocks();
});

describe('ShareEventButton', () => {
  it('hands the meetup to the share sheet and opens no dialog', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    withNavigator({ share });
    window.history.replaceState({}, '', '/en/algeria/e/founders-breakfast');
    renderButton();

    clickShare();

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]?.[0]).toEqual({
      title: TITLE,
      text: `Join me at ${TITLE}`,
      url: `${window.location.origin}/en/algeria/e/founders-breakfast`,
    });
    expect(
      document.querySelector('dialog[open]'),
      'a working share sheet should not also push a dialog at the reader',
    ).toBeNull();
  });

  it('stays quiet when the reader closes the sheet', async () => {
    const abort = new Error('cancelled');
    abort.name = 'AbortError';
    const share = vi.fn().mockRejectedValue(abort);
    withNavigator({ share });
    renderButton();

    clickShare();

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(
      document.querySelector('dialog[open]'),
      'closing the sheet is a decision, not a failure to route around',
    ).toBeNull();
  });

  it('opens the dialog where there is no share sheet', async () => {
    dropFromNavigator('share');
    renderButton();

    clickShare();

    await waitFor(() =>
      expect(document.querySelector('dialog[open]')).not.toBeNull(),
    );
    expect(screen.getByRole('heading', { name: 'Share' })).toBeTruthy();
  });

  it('opens the dialog when the sheet is refused rather than closed', async () => {
    const refused = new Error('policy');
    refused.name = 'NotAllowedError';
    withNavigator({ share: vi.fn().mockRejectedValue(refused) });
    renderButton();

    clickShare();

    await waitFor(() =>
      expect(document.querySelector('dialog[open]')).not.toBeNull(),
    );
  });
});
