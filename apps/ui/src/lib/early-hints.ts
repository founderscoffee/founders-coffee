import type { ResponseLinkHeaderEntry } from '@tanstack/react-start/server';

import { LOCALES } from '@founders-coffee/i18n';

import { isPrivatePath } from './indexation';

const PUBLIC_LOCALES = new Set<string>(LOCALES);
const ASSET_PATH_PREFIX = '/assets/';

const isHtmlRequest = (
  request: Pick<Request, 'headers' | 'method'>,
): boolean => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('accept');
  return !accept || accept.includes('text/html') || accept.includes('*/*');
};

/**
 * Whether a page is public in shape and so may advertise its assets as Early Hints.
 *
 * The shape is a language followed by a market or company page, a city, or a meetup. Most private
 * screens have that shape too (`/en/login`, `/en/u/{id}`), so they are refused by
 * {@link isPrivatePath}, the list the Worker marks `private, no-store` from, rather than by a list
 * kept here. The one kept here had lost the feedback, edit and member-profile screens, and it
 * matched a screen's name at any depth, which took the hints away from a meetup whose slug is
 * `login`.
 */
export const isPublicEarlyHintsPath = (pathname: string): boolean => {
  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[0];
  if (!locale || !PUBLIC_LOCALES.has(locale)) return false;
  if (isPrivatePath(pathname)) return false;
  if (segments.length === 2) return true;
  if (segments.length === 3) return true;
  return segments.length === 4 && segments[2] === 'e';
};

export const shouldEmitEarlyHints = (
  request: Pick<Request, 'headers' | 'method'>,
  pathname: string,
): boolean => isHtmlRequest(request) && isPublicEarlyHintsPath(pathname);

export const isCacheSafeEarlyHint = (
  entry: ResponseLinkHeaderEntry,
  origin: string,
): boolean => {
  if (entry.phase !== 'static' && entry.phase !== 'dynamic') return false;
  if (entry.hint.rel !== 'preload' && entry.hint.rel !== 'modulepreload')
    return false;
  try {
    const url = new URL(entry.hint.href, origin);
    return (
      url.origin === origin &&
      url.pathname.startsWith(ASSET_PATH_PREFIX) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
};

export const removeEarlyHintsFromResponse = (response: Response): Response => {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (
    response.status >= 200 &&
    response.status < 300 &&
    contentType.includes('text/html')
  )
    return response;
  if (!response.headers.has('Link')) return response;

  const headers = new Headers(response.headers);
  headers.delete('Link');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
