import { createFileRoute } from '@tanstack/react-router'

import type { Locale } from '@founders-coffee/i18n'

import { CompanyPage } from '../components/company/CompanyPage'
import { privacyContent } from '../content/company'
import { companyPageHead } from '../lib/seo'

export const Route = createFileRoute('/privacy')({
  staticData: { prerender: true },
  component: () => {
    const { locale } = Route.useRouteContext()
    return (
      <CompanyPage
        locale={locale}
        content={privacyContent[locale]}
        related={['terms', 'cookies']}
        showLegalDraftNotice
      />
    )
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale
    const content = privacyContent[locale]
    return companyPageHead({
      locale,
      path: '/privacy',
      title: content.title,
      description: content.description,
    })
  },
})
