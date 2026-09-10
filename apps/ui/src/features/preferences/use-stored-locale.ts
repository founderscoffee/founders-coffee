import { useEffect } from 'react';

import type { Locale } from '@founders-coffee/i18n';

import { authClient } from '../../lib/auth';
import { adoptStoredLocale, localeNeedsReconciling } from './stored-locale';

/**
 * Bring this device's language into line with the signed-in member's saved one.
 *
 * Runs in the root layout because it has to apply on every page, not only the one that sets the
 * preference — a member who saves French and then opens the app on a different browser should not
 * have to visit their preferences again for the setting to mean anything.
 *
 * The session already carries `localePref`, so this costs no request. It is visible to the client
 * only because `authClient` declares it through `inferAdditionalFields`: the field is added to
 * `user` on the server, and the browser's session type would otherwise stop at Better Auth's
 * built-in user. Declaring it there rather than inferring it from the server `auth` instance keeps
 * the auth configuration — secrets, adapters, D1 — out of the browser bundle.
 */
export const useStoredLocale = (active: Locale): void => {
  const session = authClient.useSession();
  const stored = session.data?.user.localePref;

  useEffect(() => {
    if (localeNeedsReconciling(stored, active))
      adoptStoredLocale(stored, () => window.location.reload());
  }, [stored, active]);
};
