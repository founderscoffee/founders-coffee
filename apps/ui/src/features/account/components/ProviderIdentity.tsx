import type { ReactNode } from 'react';

import type { Locale } from '@founders-coffee/i18n';

import { PROVIDER_MARK } from '../../../components/auth/ProviderIcon';
import { providerLabel } from '../account-labels';
import type { AccountSummary } from '../api';

type Provider = AccountSummary['providers'][number];

export const ProviderIdentity = ({
  locale,
  provider,
}: {
  locale: Locale;
  provider: Provider;
}) => {
  const Mark =
    provider === 'google' || provider === 'github'
      ? PROVIDER_MARK[provider]
      : null;

  return (
    <span
      className="inline-flex items-center gap-1.5 leading-none"
      dir={Mark ? 'ltr' : undefined}
    >
      {Mark ? (
        <span className="inline-flex size-[18px] shrink-0 items-center justify-center">
          <Mark />
        </span>
      ) : null}
      {providerLabel(provider, locale)}
    </span>
  );
};

export const ProviderIdentityList = ({
  locale,
  providers,
  empty,
}: {
  locale: Locale;
  providers: Provider[];
  empty: ReactNode;
}) => {
  if (providers.length === 0) return <>{empty}</>;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {providers.map((provider, index) => (
        <span key={provider} className="inline-flex items-center gap-2">
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <ProviderIdentity locale={locale} provider={provider} />
        </span>
      ))}
    </span>
  );
};
