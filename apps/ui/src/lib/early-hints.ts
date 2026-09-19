import type { ResponseLinkHeaderEntry } from '@tanstack/react-start/server';

import { LOCALES } from '@founders-coffee/i18n';

const PUBLIC_LOCALES = new Set<string>(LOCALES);
const ASSET_PATH_PREFIX = '/assets/';
const NON_PUBLIC_SEGMENTS = new Set([
  'account',
  'activity',
  'closeout',
  'login',
  'onboarding',
  'preferences',
  'profile',
  'notifications',
]);

const isHtmlRequest = (
  request: Pick<Request, 'headers' | 'method'>,
): boolean => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('accept');
  return !accept || accept.includes('text/html') || accept.includes('*/*');
};

export const isPublicEarlyHintsPath = (pathname: string): boolean => {
  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[0];
  if (!locale || !PUBLIC_LOCALES.has(locale)) return false;
  if (segments.some((segment) => NON_PUBLIC_SEGMENTS.has(segment)))
    return false;
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
