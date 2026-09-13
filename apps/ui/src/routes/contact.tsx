import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, type Locale } from '@founders-coffee/i18n';

import { CompanyPage } from '../components/company/CompanyPage';
import { contactContent } from '../content/company';
import { readCookieHeader } from '../lib/cookies';
import { companyPageHead } from '../lib/seo-company';

export const Route = createFileRoute('/contact')({
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: () => {
    throw redirect({
      to: '/$market/$city',
      params: { market: detectLocale(readCookieHeader()), city: 'contact' },
    });
  },
  component: () => {
    const { locale } = Route.useRouteContext();
    return (
      <CompanyPage
        locale={locale}
        content={contactContent[locale]}
        showEmailActions
        related={['privacy', 'terms']}
      />
    );
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale;
    const content = contactContent[locale];
    return companyPageHead({
      locale,
      path: '/contact',
      title: content.title,
      description: content.description,
    });
  },
});
