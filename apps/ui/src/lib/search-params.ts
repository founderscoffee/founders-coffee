import { parseSearchWith, stringifySearchWith } from '@tanstack/router-core';

/**
 * How the router reads a query string: as written rather than as JSON, so `?q="x"` keeps its
 * quotes. Only a plain number or `true`/`false` becomes one, which router-core decides before this
 * parser sees the value.
 *
 * It lives apart from `router.tsx` because the router is not its only reader. A redirect to a path
 * has to hand the router a query already read this way (`pathDestination`), and a query read any
 * other way would be written back out as a different address.
 */
export const parseSearch = parseSearchWith((val: string) => val);

export const stringifySearch = stringifySearchWith(JSON.stringify, () => {
  throw 0;
});
