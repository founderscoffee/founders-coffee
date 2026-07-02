import { createAuthClient as createBetterAuthClient } from 'better-auth/client';
import {
  adminClient,
  emailOTPClient,
  phoneNumberClient,
} from 'better-auth/client/plugins';

/**
 * Frontend auth client. Consumed by apps' `features/<domain>/api.ts` + hooks
 * (TanStack Query). Passwordless phone-OTP + email-OTP + admin (RBAC) client
 * plugins mirror the server config.
 */
export const createAuthClient = (opts?: { baseURL?: string }) =>
  createBetterAuthClient({
    ...(opts?.baseURL ? { baseURL: opts.baseURL } : {}),
    plugins: [emailOTPClient(), phoneNumberClient(), adminClient()],
  });

export type AuthClient = ReturnType<typeof createAuthClient>;
