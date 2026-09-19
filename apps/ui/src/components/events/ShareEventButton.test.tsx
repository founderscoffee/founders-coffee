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
  render(
    <ShareEventButton
      locale="en"
      title={TITLE}
      label="Share"
      variant="panel"
    />,
  );

const clickShare = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
};

const clickCopy = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /copy link/i }));
};

afterEach(() => {
  cleanup();
  dropFromNavigator('share', 'clipboard');
  vi.restoreAllMocks();
});

describe('ShareEventButton', () => {
  it('hands the meetup to the share sheet and shows no fallback', async () => {
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
      screen.queryByRole('link', { name: /whatsapp/i }),
      'a working share sheet should not also push a fallback at the reader',
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
      screen.queryByRole('button', { name: /copy link/i }),
      'closing the sheet is a decision, not a failure to route around',
    ).toBeNull();
    expect(screen.queryByRole('link', { name: /whatsapp/i })).toBeNull();
  });

  it('offers WhatsApp and copy where there is no share sheet', async () => {
    dropFromNavigator('share');
    window.history.replaceState({}, '', '/ar/algeria/e/founders-breakfast');
    renderButton();

    clickShare();

    const whatsapp = await screen.findByRole('link', { name: /whatsapp/i });
    const href = whatsapp.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(
      `${window.location.origin}/ar/algeria/e/founders-breakfast`,
    );
    expect(screen.getByRole('button', { name: /copy link/i })).toBeTruthy();
  });

  it('confirms a copied link', async () => {
    dropFromNavigator('share');
    const writeText = vi.fn().mockResolvedValue(undefined);
    withNavigator({ clipboard: { writeText } });
    renderButton();

    clickShare();
    await clickCopy();

    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Link copied');
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('leaves the link on screen when the clipboard refuses it', async () => {
    dropFromNavigator('share');
    withNavigator({
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    window.history.replaceState({}, '', '/en/algeria/e/founders-breakfast');
    renderButton();

    clickShare();
    await clickCopy();

    const field = await screen.findByRole('textbox');
    expect(
      (field as HTMLInputElement).value,
      'a refused clipboard with no visible link leaves the reader nothing to copy by hand',
    ).toBe(`${window.location.origin}/en/algeria/e/founders-breakfast`);
  });
});
