import { createFileRoute } from '@tanstack/react-router'

import type { Locale } from '@founders-coffee/i18n'

import { CompanyPage } from '../components/company/CompanyPage'
import { termsContent } from '../content/company'
import { companyPageHead } from '../lib/seo'

export const Route = createFileRoute('/terms')({
  staticData: { prerender: true },
  component: () => {
    const { locale } = Route.useRouteContext()
    return (
      <CompanyPage
        locale={locale}
        content={termsContent[locale]}
        related={['privacy', 'cookies']}
        showLegalDraftNotice
      />
    )
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale
    const content = termsContent[locale]
    return companyPageHead({
      locale,
      path: '/terms',
      title: content.title,
      description: content.description,
    })
  },
})
