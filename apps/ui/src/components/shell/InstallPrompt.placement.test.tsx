import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENGAGED_AFTER_MS,
  RETURN_AFTER_MS,
  RETURN_SETTLE_MS,
} from '../../lib/install-prompt';
import {
  IPHONE_SAFARI,
  NOW,
  setDisplay,
  setUserAgent,
  sheet,
  tap,
  wait,
} from './install-prompt.fixtures';
import { InstallPrompt } from './InstallPrompt';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  setDisplay(false);
  setUserAgent(IPHONE_SAFARI);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});

const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('where the install sheet gives way', () => {
  it('waits out a task in progress and opens on the next page', () => {
    const { rerender } = render(<InstallPrompt locale="en" canShow={false} />);
    tap();
    wait(ENGAGED_AFTER_MS);

    expect(
      sheet(),
      'a sign-in code or a form’s last step was on screen',
    ).toBeNull();

    rerender(<InstallPrompt locale="en" canShow />);
    expect(sheet()).not.toBeNull();
  });

  it('steps aside while a dialog is open and comes back after it closes', async () => {
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    render(<InstallPrompt locale="en" canShow />);
    tap();
    wait(ENGAGED_AFTER_MS);
    expect(sheet()).not.toBeNull();

    await act(async () => {
      dialog.setAttribute('open', '');
    });
    expect(sheet()).toBeNull();

    await act(async () => {
      dialog.removeAttribute('open');
    });
    expect(sheet()).not.toBeNull();
  });

  it('never opens over a dialog already open', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    render(<InstallPrompt locale="en" canShow />);
    tap();

    wait(ENGAGED_AFTER_MS);

    expect(sheet()).toBeNull();
  });
});

describe('a reader coming back to a tab the phone kept open', () => {
  it('counts half an hour away as a second visit', () => {
    render(<InstallPrompt locale="en" canShow />);
    setVisibility('hidden');
    vi.setSystemTime(NOW + RETURN_AFTER_MS);
    setVisibility('visible');

    wait(RETURN_SETTLE_MS);

    expect(sheet()).not.toBeNull();
  });

  it('treats a ten-minute break as the same visit, still waiting for a tap', () => {
    render(<InstallPrompt locale="en" canShow />);
    vi.setSystemTime(NOW + 25 * 60_000);
    setVisibility('hidden');
    vi.setSystemTime(NOW + 35 * 60_000);
    setVisibility('visible');

    wait(ENGAGED_AFTER_MS);

    expect(sheet()).toBeNull();
  });
});

describe('the sheet in the page', () => {
  it('renders nothing on the server, so hydration has nothing to correct', () => {
    expect(renderToString(<InstallPrompt locale="en" canShow />)).toBe(
      '<div aria-live="polite" class="pointer-events-none fixed inset-x-0 bottom-0 z-40"></div>',
    );
  });

  it('hands the keyboard to the page when it closes, rather than dropping it', () => {
    render(
      <>
        <main id="main-content" tabIndex={-1} />
        <InstallPrompt locale="en" canShow />
      </>,
    );
    tap();
    wait(ENGAGED_AFTER_MS);
    const done = screen.getByRole('button', { name: 'Got it' });
    done.focus();

    fireEvent.keyDown(done, { key: 'Escape' });

    expect(document.activeElement?.id).toBe('main-content');
  });
});
