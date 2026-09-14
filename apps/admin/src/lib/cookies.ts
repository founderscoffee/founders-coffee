import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookies } from '@tanstack/react-start/server';

/**
 * Decodes a cookie value, falling back to the raw text when it is not valid percent-encoding.
 * The browser hands us every cookie in the jar, including third-party ones we do not control,
 * so a single malformed value must not take down the whole parse.
 */
const decodeValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseCookieJar = (jar: string): Record<string, string> =>
  Object.fromEntries(
    jar
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const separator = part.indexOf('=');
        return separator < 0
          ? ([part, ''] as const)
          : ([
              part.slice(0, separator),
              decodeValue(part.slice(separator + 1)),
            ] as const);
      }),
  );

/**
 * Cookie access that survives a client-side navigation. TanStack Router re-runs `beforeLoad` and
 * `loader` in the browser, where the server-only `getCookies()` throws `No StartEvent found in
 * AsyncLocalStorage` because the request it reads exists only during SSR. The same values are
 * already in `document.cookie`, so the client implementation reads them from there.
 */
export const readCookies = createIsomorphicFn()
  .server((): Record<string, string> => getCookies())
  .client((): Record<string, string> => parseCookieJar(document.cookie));

/** The active cookies rendered back as a `Cookie` header, for parsers that expect one. */
export const readCookieHeader = (): string | null => {
  const entries = Object.entries(readCookies());
  return entries.length === 0
    ? null
    : entries.map(([name, value]) => `${name}=${value}`).join('; ');
};
