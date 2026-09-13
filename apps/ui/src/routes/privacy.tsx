import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, type Locale } from '@founders-coffee/i18n';

import { CompanyPage } from '../components/company/CompanyPage';
import { privacyContent } from '../content/company';
import { readCookieHeader } from '../lib/cookies';
import { companyPageHead } from '../lib/seo-company';

export const Route = createFileRoute('/privacy')({
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: () => {
    throw redirect({
      to: '/$market/$city',
      params: { market: detectLocale(readCookieHeader()), city: 'privacy' },
    });
  },
  component: () => {
    const { locale } = Route.useRouteContext();
    return (
      <CompanyPage
        locale={locale}
        content={privacyContent[locale]}
        related={['terms', 'cookies']}
        showLegalDraftNotice
      />
    );
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale;
    const content = privacyContent[locale];
    return companyPageHead({
      locale,
      path: '/privacy',
      title: content.title,
      description: content.description,
    });
  },
});
