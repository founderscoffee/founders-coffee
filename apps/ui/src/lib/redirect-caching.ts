import { PRIVATE_DOCUMENT_CACHE_CONTROL } from './indexation';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Keep a redirect out of every shared cache, unless it names a policy of its own.
 *
 * A route's `headers()` never reach a redirect. TanStack Start returns `router.state.redirect`
 * before it merges the matches' headers, so every redirect the router answers leaves with what the
 * Worker adds and nothing else. Several of them pick a destination for the reader who asked: `/`,
 * `/{locale}`, the company stubs and the `$locale` layout's forwards follow the locale cookie, the
 * `fc_geo` cookie or `cf-ipcountry`, and none of them says so.
 *
 * Nothing keeps them today, because the Worker runs in front of Cloudflare's cache and a 307 has no
 * heuristic freshness. That is luck rather than policy. Workers Cache would put a cache in front of
 * the Worker, keyed on the path and query alone rather than the cookie, the language or the host,
 * and it keeps a 301 that names no policy for twenty minutes, so one stub turned permanent would
 * send the first reader's language to everyone after them. Only the route that throws a redirect
 * knows whether it depends on the reader, so this goes by the status: every redirect is private
 * unless it says otherwise, and one that sets its own `Cache-Control` keeps it.
 */
export const withoutRedirectCaching = (response: Response): Response => {
  if (
    !REDIRECT_STATUSES.has(response.status) ||
    response.headers.has('Cache-Control')
  )
    return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', PRIVATE_DOCUMENT_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
