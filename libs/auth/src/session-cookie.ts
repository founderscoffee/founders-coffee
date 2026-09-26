const SESSION_COOKIE = '__Secure-better-auth.session_token';

const decoded = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * The session token in a Cookie header, read from Better Auth's session cookie and no other.
 *
 * `createAuth` sets `useSecureCookies: true`, so Better Auth names that cookie
 * `__Secure-better-auth.session_token` on every origin, `http://localhost` included, and reads no
 * other name. This takes it the way Better Auth does: the first cookie of exactly that name,
 * decoded, cut at its last dot. What comes before the dot is the token the `session` table stores.
 * The signature after it is not checked here: callers look the token up in that table, and only a
 * real session's token is found there.
 *
 * One name and one copy: a header yields at most one token however many cookies it carries, so a
 * caller that looks it up in D1 makes one query, even for a header padded with junk. A header
 * without the cookie, or whose first copy is empty or unsigned, gives `null`; a malformed escape is
 * kept as sent rather than thrown.
 */
export const sessionTokenFromCookie = (
  cookieHeader: string | null,
): string | null => {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const equalsAt = pair.indexOf('=');
    if (equalsAt < 0 || pair.slice(0, equalsAt).trim() !== SESSION_COOKIE)
      continue;
    const value = decoded(pair.slice(equalsAt + 1).trim());
    const signatureAt = value.lastIndexOf('.');
    return signatureAt > 0 ? value.slice(0, signatureAt) : null;
  }
  return null;
};
