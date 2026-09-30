import { isAPIError } from 'better-auth/api';

import { reportError, stripQueryValues } from '@founders-coffee/observability';

/**
 * Report what a Better Auth endpoint threw, in place of Better Auth's own logging of it.
 *
 * A refusal the endpoint meant, an `APIError` below 500 such as a wrong code, is its response and
 * nothing more. Anything else goes to `reportError`, stripped of any failed query's values in place
 * first: better-call prints the same error to `console` itself once this returns, and the queries
 * behind a sign-in bind the address, the code and the session token.
 */
export const reportAuthFailure = (error: unknown): void => {
  if (isAPIError(error) && error.statusCode < 500) return;
  reportError(stripQueryValues(error), { source: 'better-auth' });
};
