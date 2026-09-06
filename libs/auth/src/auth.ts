import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  admin,
  bearer,
  captcha,
  emailOTP,
  phoneNumber,
} from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { AppError, optionalEnv } from '@founders-coffee/core';
import {
  account,
  createDb,
  session,
  user,
  verification,
} from '@founders-coffee/db';

import { captchaEndpointsFor } from './captcha.js';
import type { EmailProvider } from './providers/email.js';
import { DevEmailProvider } from './providers/email.js';
import type { SmsProvider } from './providers/sms.js';
import { DevSmsProvider, TwilioVerifySmsProvider } from './providers/sms.js';
import { ac, roles } from './rbac.js';

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  APP_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TWILIO_SID?: string;
  TWILIO_AID?: string;
  TWILIO_SEC?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_DISABLED?: string;
}

export interface AuthDeps {
  emailProvider?: EmailProvider;
  smsProvider?: SmsProvider;
}

/**
 * Build an SmsProvider from auth env vars. Returns `DevSmsProvider` when Twilio
 * env vars are absent (dev + tests) or `TwilioVerifySmsProvider` when all three
 * vars are present.
 */
const smsProviderFromEnv = (env: AuthEnv): SmsProvider => {
  if (env.TWILIO_SID && env.TWILIO_AID && env.TWILIO_SEC) {
    return new TwilioVerifySmsProvider({
      TWILIO_SID: env.TWILIO_SID,
      TWILIO_AID: env.TWILIO_AID,
      TWILIO_SEC: env.TWILIO_SEC,
    });
  }
  return new DevSmsProvider();
};

/**
 * Build a Better Auth instance bound to the request's D1.
 *
 * CRITICAL: construct this **per request** (inside the handler / server-function),
 * never cache at module scope — `env.DB` only exists in request context, and a
 * module singleton + a per-request instance contend for D1's write lock
 * (the TanStack #5323 ~30s-hang trap).
 *
 * Auth model (FR-A4/D4): passwordless phone-OTP (Twilio Verify, primary) + email-OTP (secondary/billing) + OAuth (Google/GitHub/LinkedIn);
 * sessions in D1 (never KV); D1-backed auth rate-limiting; strict account linking.
 *
 * `ipAddressHeaders` is pinned to `cf-connecting-ip` rather than Better Auth's default
 * `x-forwarded-for`: on Workers only the former is set by the edge and cannot be forged by the
 * client (AGENTS §11.5). Both the D1-backed rate limiter and the captcha plugin's `remoteip` key off
 * this, so the default would let a client choose its own rate-limit bucket.
 *
 * The captcha plugin is registered unconditionally (see `captchaEndpointsFor` for why) and an absent
 * secret key is not a bypass: the plugin errors on the gated endpoints, and `createAuthHandler`
 * refuses them outright with a clearer 503 before it gets that far.
 */
export const createAuth = (env: AuthEnv, deps: AuthDeps = {}) => {
  const emailProvider = deps.emailProvider ?? new DevEmailProvider();
  const smsProvider = deps.smsProvider ?? smsProviderFromEnv(env);
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
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'github'],
        allowDifferentEmails: false,
      },
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },
    user: {
      additionalFields: {
        homeMarketCode: { type: 'string', required: false, input: false },
        homeState: { type: 'string', required: false, input: false },
        homeCityId: { type: 'string', required: false, input: false },
        localePref: { type: 'string', required: false, input: false },
      },
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: 'lax',
        httpOnly: true,
        secure: true,
      },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    rateLimit: { storage: 'database' },
    plugins: [
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: env.TURNSTILE_SECRET_KEY ?? '',
        endpoints: captchaEndpointsFor(env.TURNSTILE_DISABLED === 'true'),
      }),
      emailOTP({
        sendVerificationOTP: async ({ email, otp, type }) => {
          await emailProvider.sendOtp({ email, otp, type });
        },
        storeOTP: 'hashed',
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
      }),
      phoneNumber({
        sendOTP: async ({ phoneNumber: phone, code }) => {
          const result = await smsProvider.sendOtp({
            phoneNumber: phone,
            code,
          });
          if (result?.fraudGuardBlocked) {
            throw new AppError(
              'fraud_guard_blocked',
              'This number is temporarily blocked. Try email instead.',
            );
          }
        },
        verifyOTP: smsProvider.verifyOtp
          ? (
              (verifyOtp) =>
              ({
                phoneNumber: phone,
                code,
              }: {
                phoneNumber: string;
                code: string;
              }) =>
                verifyOtp({ phoneNumber: phone, code })
            )(smsProvider.verifyOtp)
          : undefined,
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
      }),
      admin({ ac, roles, defaultRole: 'member', adminRoles: ['admin'] }),
      bearer(),
      tanstackStartCookies(),
    ],
  });

  return { auth, emailProvider, smsProvider };
};

export type AuthInstance = ReturnType<typeof createAuth>['auth'];

/** True if at least one OAuth provider is configured (drives UI: show social buttons). */
export const hasSocialProviders = (env: AuthEnv): boolean => {
  const envVars = env as unknown as Record<string, string | undefined>;
  return (['GOOGLE', 'GITHUB'] as const).some(
    (p) =>
      optionalEnv(envVars, `${p}_CLIENT_ID`) &&
      optionalEnv(envVars, `${p}_CLIENT_SECRET`),
  );
};
