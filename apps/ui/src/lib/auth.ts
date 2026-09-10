import {
  adminClient,
  emailOTPClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    adminClient(),
    inferAdditionalFields({
      user: { localePref: { type: 'string', required: false } },
    }),
  ],
});
