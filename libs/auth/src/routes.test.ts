import { describe, expect, it } from 'vitest';

import { isPublicAuthRoute, PUBLIC_AUTH_ROUTES } from './routes.js';

describe('isPublicAuthRoute', () => {
  it.each([
    ['GET', '/api/auth/get-session'],
    ['POST', '/api/auth/email-otp/send-verification-otp'],
    ['POST', '/api/auth/sign-in/email-otp'],
    ['POST', '/api/auth/sign-in/social'],
    ['GET', '/api/auth/callback/google'],
    ['GET', '/api/auth/callback/github'],
    ['GET', '/api/auth/error'],
    ['POST', '/api/auth/sign-out'],
  ])('serves %s %s, which the apps call', (method, pathname) => {
    expect(isPublicAuthRoute(pathname, method)).toBe(true);
  });

  it.each([
    ['POST', '/api/auth/email-otp/request-password-reset'],
    ['POST', '/api/auth/forget-password/email-otp'],
    ['POST', '/api/auth/email-otp/reset-password'],
    ['POST', '/api/auth/request-password-reset'],
    ['POST', '/api/auth/phone-number/send-otp'],
    ['POST', '/api/auth/phone-number/request-password-reset'],
    ['POST', '/api/auth/sign-in/phone-number'],
    ['POST', '/api/auth/email-otp/check-verification-otp'],
    ['POST', '/api/auth/email-otp/request-email-change'],
    ['POST', '/api/auth/email-otp/change-email'],
    ['GET', '/api/auth/admin/list-users'],
    ['POST', '/api/auth/admin/set-role'],
    ['GET', '/api/auth/list-sessions'],
    ['GET', '/api/auth/list-accounts'],
    ['POST', '/api/auth/get-access-token'],
    ['POST', '/api/auth/delete-user'],
    ['GET', '/api/auth/ok'],
  ])('refuses %s %s, which no app calls', (method, pathname) => {
    expect(isPublicAuthRoute(pathname, method)).toBe(false);
  });

  it.each([
    ['POST', '/api/auth/get-session'],
    ['GET', '/api/auth/sign-out'],
    ['GET', '/api/auth/email-otp/send-verification-otp'],
    ['POST', '/api/auth/callback/google'],
  ])(
    'refuses %s %s, a served path under the wrong method',
    (method, pathname) => {
      expect(isPublicAuthRoute(pathname, method)).toBe(false);
    },
  );

  it.each([
    '/api/auth/get-session/',
    '/api/auth/GET-SESSION',
    '/api/auth//get-session',
    '/api/auth/callback/google/extra',
    '/api/auth/callback/facebook',
    '/get-session',
    '/api/authget-session',
  ])('refuses the near miss %s', (pathname) => {
    expect(isPublicAuthRoute(pathname, 'GET')).toBe(false);
  });

  it('lists each route once', () => {
    expect(new Set(PUBLIC_AUTH_ROUTES).size).toBe(PUBLIC_AUTH_ROUTES.length);
  });
});
