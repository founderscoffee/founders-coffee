import { act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { vi } from 'vitest';

const roots: Root[] = [];

/**
 * The HTML the server renders for `element`, as a browser receives it: sent as UTF-8, which has no
 * lone surrogates, so half of a character arrives as U+FFFD.
 */
export const serverHtml = (element: ReactElement): string =>
  new TextDecoder().decode(new TextEncoder().encode(renderToString(element)));

/**
 * Hydrate `html` with `element`, as a browser does with the page the server sent, and collect what
 * React reports on the way: every recoverable error, a hydration mismatch among them, and every
 * line it writes to the console.
 */
export const hydrate = async (
  element: ReactElement,
  html: string = serverHtml(element),
) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const reported: unknown[] = [];
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => void reported.push(args));
  await act(async () => {
    roots.push(
      hydrateRoot(container, element, {
        onRecoverableError: (error) => void reported.push(error),
      }),
    );
  });
  consoleError.mockRestore();
  return { container, reported };
};

/** Unmount every root `hydrate` made and empty the page, for a suite's `afterEach`. */
export const unmountHydrated = (): void => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  document.body.replaceChildren();
};
