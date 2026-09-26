import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { admin, captcha, emailOTP, phoneNumber } from 'better-auth/plugins';
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
  captchaBypassed?: boolean;
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

const GUARDED_ACCOUNT_PATHS = [
  '/unlink-account',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',
];

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
 * The captcha plugin is registered unconditionally (see `captchaEndpointsFor` for why) for public
 * auth requests. An absent secret key is not a bypass: the plugin errors on gated endpoints, and
 * `createAuthHandler` refuses them outright with a clearer 503 before it gets that far. The one
 * internal bypass is reserved for server-side authenticated contact operations, whose surrounding
 * server functions already require a member session and permission.
 *
 * `GUARDED_ACCOUNT_PATHS` closes the raw endpoints this product answers for itself. Each has a rule
 * that lives above Better Auth and cannot be expressed inside it: unlinking must leave a member a
 * way back in, and signing a device out must take that device's push registration with it, or the
 * revocation silently becomes permission to keep notifying it. A caller reaching the raw endpoint
 * gets neither, so the raw endpoint is closed and the guarded server function is the only door.
 *
 * `emailOTP.changeEmail.verifyCurrentEmail` is what makes a change of address an act by the person
 * who already holds it. Without it, anyone sitting at an unlocked session could move the account to
 * their own address and lock the member out with the account's own recovery flow; with it, the
 * change costs a code sent to the address currently on file, and the old one stays authoritative
 * until a second code proves the new one is real.
 *
 * A session travels in its HttpOnly cookie and nowhere else, so Better Auth's `bearer` plugin is
 * left out. Without `requireSignature` it takes the bare session token as a login, and that token
 * sits in D1 and comes back to page scripts from `get-session`; it also copies the signed token
 * into a `set-auth-token` header that scripts can read. A non-web client brings it back with
 * `requireSignature: true`, and `callerSessionToken` has to read the header from then on, or the
 * device controls cannot tell which session is asking.
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
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path === '/update-user') {
          throw new APIError('FORBIDDEN', {
            code: 'PROFILE_ENDPOINT_REQUIRED',
            message: 'Use the protected profile endpoint to edit your profile',
          });
        }
        if (GUARDED_ACCOUNT_PATHS.includes(context.path)) {
          throw new APIError('FORBIDDEN', {
            code: 'ACCOUNT_ENDPOINT_REQUIRED',
            message: 'Use the protected account endpoint for this action',
          });
        }
      }),
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'github'],
        allowDifferentEmails: false,
        updateUserInfoOnLink: false,
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
        endpoints: captchaEndpointsFor(
          env.TURNSTILE_DISABLED === 'true' || deps.captchaBypassed === true,
        ),
      }),
      emailOTP({
        sendVerificationOTP: async ({ email, otp, type }) => {
          await emailProvider.sendOtp({ email, otp, type });
        },
        storeOTP: 'hashed',
        otpLength: 6,
        expiresIn: 1800,
        allowedAttempts: 3,
        changeEmail: { enabled: true, verifyCurrentEmail: true },
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
