import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, emailOTP } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { optionalEnv } from '@founders-coffee/core';
import { account, createDb, session, user, verification } from '@founders-coffee/db';

import type { EmailProvider } from './providers/email.js';
import { DevEmailProvider } from './providers/email.js';
import { ac, roles } from './rbac.js';

/**
 * Environment the auth factory needs. `DB` is the D1 binding (reached via
 * `cloudflare:workers` `env.DB` inside the request). OAuth client secrets are
 * optional — providers are only enabled when both id + secret are present, so
 * dev (email-OTP only) works without any OAuth credentials configured.
 */
export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  APP_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
}

export interface AuthDeps {
  /** Defaults to {@link DevEmailProvider}. Inject a capture-capable one in tests. */
  emailProvider?: EmailProvider;
}

/**
 * Build a Better Auth instance bound to the request's D1.
 *
 * CRITICAL: construct this **per request** (inside the handler / server-function),
 * never cache at module scope — `env.DB` only exists in request context, and a
 * module singleton + a per-request instance contend for D1's write lock
 * (the TanStack #5323 ~30s-hang trap).
 *
 * Auth model (FR-A4/D4): passwordless email-OTP + OAuth (Google/GitHub/LinkedIn);
 * sessions in D1 (never KV); D1-backed auth rate-limiting; strict account linking.
 */
export function createAuth(env: AuthEnv, deps: AuthDeps = {}) {
  const emailProvider = deps.emailProvider ?? new DevEmailProvider();
  const db = createDb(env.DB);

  const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: [env.APP_URL],
    emailAndPassword: { enabled: false },
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github', 'linkedin'],
      allowDifferentEmails: false,
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
        : {}),
      ...(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET
        ? { linkedin: { clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET } }
        : {}),
    },
    user: {
      additionalFields: {
        homeMarketCode: { type: 'string', required: false, input: false },
        homeCityId: { type: 'string', required: false, input: false },
        localePref: { type: 'string', required: false, input: false },
      },
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true, secure: true },
    },
    rateLimit: { storage: 'database' },
    plugins: [
      emailOTP({
        // Fire synchronously so the code is captured/logged before the response
        // returns (BA does not guarantee awaiting this). The real provider will
        // use `ctx.waitUntil` to avoid timing attacks. Async signature matches
        // Better Auth's expected `Promise<void>` callback type.
        sendVerificationOTP: async ({ email, otp, type }) => {
          emailProvider.sendOtp({ email, otp, type });
        },
        storeOTP: 'hashed',
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
      }),
      admin({ ac, roles, defaultRole: 'member', adminRoles: ['admin'] }),
      bearer(),
      tanstackStartCookies(),
    ],
  });

  return { auth, emailProvider };
}

export type AuthInstance = ReturnType<typeof createAuth>['auth'];

/** True if at least one OAuth provider is configured (drives UI: show social buttons). */
export function hasSocialProviders(env: AuthEnv): boolean {
  const envVars = env as unknown as Record<string, string | undefined>;
  return (['GOOGLE', 'GITHUB', 'LINKEDIN'] as const).some(
    (p) => optionalEnv(envVars, `${p}_CLIENT_ID`) && optionalEnv(envVars, `${p}_CLIENT_SECRET`),
  );
}
