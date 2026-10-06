const HTML_ONLY_REFUSAL = 'Only HTML requests are supported here';

const PAGE_TYPES = ['*/*', 'text/html'];

/**
 * Whether `request` takes an HTML page, read the way TanStack Start reads it before rendering one:
 * an `Accept` with a part naming HTML or any type at all, or no `Accept`.
 */
const acceptsPage = (request: Request): boolean =>
  (request.headers.get('Accept') || '*/*')
    .split(',')
    .some((part) => PAGE_TYPES.some((type) => part.trim().startsWith(type)));

const isHtmlOnlyRefusal = (body: unknown): boolean =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  body.error === HTML_ONLY_REFUSAL;

/**
 * Answer 406 where TanStack Start refused to render a page for a client that takes no HTML.
 *
 * Start renders a page only for a request that accepts HTML, and answers any other, such as a bot
 * asking for `application/json`, with a 500 and `{"error":"Only HTML requests are supported
 * here"}`. Browsers always accept HTML, so no visitor met it, but every bot that did counted as a
 * server error: on 2026-10-04 a registry scanner and a crawler of AI-agent files made seven, and
 * turned the daily report red. The client asked for something no page here is, which is what 406
 * says. Only that refusal changes: any other 500, including one a JSON route such as `/events.json`
 * answers, passes as it came.
 */
export const withNotAcceptableForPages = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  if (response.status !== 500 || acceptsPage(request)) return response;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => undefined);
  if (!isHtmlOnlyRefusal(body)) return response;
  return new Response('Not acceptable', {
    status: 406,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', Vary: 'Accept' },
  });
};
