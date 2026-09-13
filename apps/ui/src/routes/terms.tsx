import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, type Locale } from '@founders-coffee/i18n';

import { CompanyPage } from '../components/company/CompanyPage';
import { termsContent } from '../content/company';
import { readCookieHeader } from '../lib/cookies';
import { companyPageHead } from '../lib/seo';

export const Route = createFileRoute('/terms')({
  beforeLoad: () => {
    throw redirect({
      to: '/$market/$city',
      params: { market: detectLocale(readCookieHeader()), city: 'terms' },
    });
  },
  staticData: { prerender: true },
  component: () => {
    const { locale } = Route.useRouteContext();
    return (
      <CompanyPage
        locale={locale}
        content={termsContent[locale]}
        related={['privacy', 'cookies']}
        showLegalDraftNotice
      />
    );
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale;
    const content = termsContent[locale];
    return companyPageHead({
      locale,
      path: '/terms',
      title: content.title,
      description: content.description,
    });
  },
});
