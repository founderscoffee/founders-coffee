import { adminClient, emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * React auth client (same-origin → `/api/auth/*`). The React entry adds the `useSession` hook; the
 * plugins mirror the server (email-OTP + admin RBAC). Used by the `/login` flow + the navbar.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), adminClient()],
})
