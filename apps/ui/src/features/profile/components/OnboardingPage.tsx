import type { Locale } from '@founders-coffee/i18n';

import { safeAuthReturnPath } from '../../../lib/redirect';
import { ProfileCompletion } from './ProfileCompletion';

export const OnboardingPage = ({
  locale,
  redirect,
}: {
  locale: Locale;
  redirect: string;
}) => (
  <section className="mx-auto max-w-lg px-5 py-12">
    <ProfileCompletion
      locale={locale}
      returnPath={safeAuthReturnPath(redirect)}
      onComplete={() => window.location.assign(safeAuthReturnPath(redirect))}
    />
  </section>
);
