import { createFileRoute } from '@tanstack/react-router';

import type { Locale } from '@founders-coffee/i18n';

import { CompanyPage } from '../components/company/CompanyPage';
import { aboutContent } from '../content/company';
import { companyPageHead } from '../lib/seo';

export const Route = createFileRoute('/about')({
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
