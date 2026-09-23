import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/core';

import { Turnstile } from './Turnstile';

type RenderOptions = {
  sitekey: string;
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  language: Locale;
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
};

const turnstile = {
  render: vi.fn((element: HTMLElement, options: RenderOptions) => {
    void element;
    void options;
    return 'widget-1';
  }),
  remove: vi.fn(),
  reset: vi.fn(),
};

const resetScriptState = () => {
  const script = document.querySelector('script[src*="turnstile"]');
  script?.remove();
};

describe('Turnstile', () => {
  beforeEach(() => {
    Object.assign(window, { turnstile });
  });

  afterEach(() => {
    cleanup();
    resetScriptState();
    vi.clearAllMocks();
    Reflect.deleteProperty(window, 'turnstile');
  });

  it('uses interaction-only managed behavior for event creation', async () => {
    const onToken = vi.fn();

    render(
      <Turnstile
        sitekey="site-key"
        action="join_waitlist"
        appearance="interaction-only"
        language="ar"
        onToken={onToken}
      />,
    );

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledOnce());
    const options = turnstile.render.mock.calls[0]?.[1];
    expect(options).toMatchObject({
      sitekey: 'site-key',
      action: 'join_waitlist',
      appearance: 'interaction-only',
    });

    act(() => options?.callback('single-use-token'));
    expect(onToken).toHaveBeenLastCalledWith('single-use-token');
    act(() => options?.['expired-callback']());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
  });

  it.each(['error-callback', 'timeout-callback'] as const)(
    'clears the token and resets the widget after %s',
    async (callbackName) => {
      const onToken = vi.fn();

      render(<Turnstile sitekey="site-key" language="ar" onToken={onToken} />);

      await waitFor(() => expect(turnstile.render).toHaveBeenCalledOnce());
      const options = turnstile.render.mock.calls[0]?.[1];

      act(() => options?.[callbackName]());
      expect(onToken).toHaveBeenLastCalledWith(null);
      expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
    },
  );

  it('removes and reissues the widget when the reset key changes', async () => {
    const onToken = vi.fn();
    const view = render(
      <Turnstile
        sitekey="site-key"
        language="ar"
        resetKey={0}
        onToken={onToken}
      />,
    );
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledOnce());

    view.rerender(
      <Turnstile
        sitekey="site-key"
        language="ar"
        resetKey={1}
        onToken={onToken}
      />,
    );

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(2));
    expect(turnstile.remove).toHaveBeenCalledWith('widget-1');
  });

  it.each(LOCALES)(
    'asks for the challenge in %s, the locale the page is in rather than the browser\u2019s',
    async (language) => {
      render(
        <Turnstile sitekey="site-key" language={language} onToken={vi.fn()} />,
      );

      await waitFor(() => expect(turnstile.render).toHaveBeenCalledOnce());
      expect(turnstile.render.mock.calls[0]?.[1]).toMatchObject({ language });
    },
  );

  it('reissues the widget in the new language when the reader switches locale', async () => {
    const onToken = vi.fn();
    const view = render(
      <Turnstile sitekey="site-key" language="en" onToken={onToken} />,
    );
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledOnce());

    view.rerender(
      <Turnstile sitekey="site-key" language="ar" onToken={onToken} />,
    );

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(2));
    expect(turnstile.remove).toHaveBeenCalledWith('widget-1');
    expect(turnstile.render.mock.calls[1]?.[1]).toMatchObject({
      language: 'ar',
    });
  });
});
