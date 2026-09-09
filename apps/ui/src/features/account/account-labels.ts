import {
  provider_email,
  provider_github,
  provider_google,
  provider_phone,
  type Locale,
} from '@founders-coffee/i18n';
import type { AccountSummary } from './api';

type Provider = AccountSummary['providers'][number];

const PROVIDER_LABEL = {
  google: provider_google,
  github: provider_github,
  email: provider_email,
  phone: provider_phone,
} satisfies Record<Provider, unknown> as Record<
  Provider,
  (input: Record<string, never>, options: { locale: Locale }) => string
>;

/**
 * Name a sign-in method in the member's language.
 *
 * Declared with `satisfies` against the provider union so that adding a provider to the domain
 * fails the build here rather than rendering its bare identifier — `credential` on a screen is the
 * kind of thing nobody notices until a member asks what it means.
 */
export const providerLabel = (provider: Provider, locale: Locale): string =>
  PROVIDER_LABEL[provider]({}, { locale });
