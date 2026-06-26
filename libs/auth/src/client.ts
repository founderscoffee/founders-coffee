import { createAuthClient as createBetterAuthClient } from 'better-auth/client';
import { adminClient, emailOTPClient } from 'better-auth/client/plugins';

/**
 * Frontend auth client. Consumed by apps' `features/<domain>/api.ts` + hooks
 * (TanStack Query). Passwordless email-OTP + admin (RBAC) client plugins mirror
 * the server config.
 */
export function createAuthClient(opts?: { baseURL?: string }) {
  return createBetterAuthClient({
    ...(opts?.baseURL ? { baseURL: opts.baseURL } : {}),
    plugins: [emailOTPClient(), adminClient()],
  });
}

export type AuthClient = ReturnType<typeof createAuthClient>;
