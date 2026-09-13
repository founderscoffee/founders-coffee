import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, type Locale } from '@founders-coffee/i18n';

import { CompanyPage } from '../components/company/CompanyPage';
import { aboutContent } from '../content/company';
import { readCookieHeader } from '../lib/cookies';
import { companyPageHead } from '../lib/seo-company';

export const Route = createFileRoute('/about')({
  beforeLoad: () => {
    throw redirect({
      to: '/$market/$city',
      params: { market: detectLocale(readCookieHeader()), city: 'about' },
    });
  },
  staticData: { prerender: true },
  component: () => {
    const { locale } = Route.useRouteContext();
    return (
      <CompanyPage
        locale={locale}
        content={aboutContent[locale]}
        related={['privacy', 'terms', 'cookies']}
      />
    );
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale;
    const content = aboutContent[locale];
    return companyPageHead({
      locale,
      path: '/about',
      title: content.title,
      description: content.description,
    });
  },
});
