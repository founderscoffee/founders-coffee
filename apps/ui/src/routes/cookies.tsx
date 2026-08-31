import { createFileRoute } from '@tanstack/react-router';

import type { Locale } from '@founders-coffee/i18n';

import { CompanyPage } from '../components/company/CompanyPage';
import { cookiesContent } from '../content/company';
import { companyPageHead } from '../lib/seo';

export const Route = createFileRoute('/cookies')({
  staticData: { prerender: true },
  component: () => {
    const { locale } = Route.useRouteContext();
    return (
      <CompanyPage
        locale={locale}
        content={cookiesContent[locale]}
        related={['privacy', 'terms']}
        showLegalDraftNotice
      />
    );
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale;
    const content = cookiesContent[locale];
    return companyPageHead({
      locale,
      path: '/cookies',
      title: content.title,
      description: content.description,
    });
  },
});
