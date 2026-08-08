import { createFileRoute } from '@tanstack/react-router'

import type { Locale } from '@founders-coffee/i18n'

import { CompanyPage } from '../components/company/CompanyPage'
import { contactContent } from '../content/company'
import { companyPageHead } from '../lib/seo'

export const Route = createFileRoute('/contact')({
  staticData: { prerender: true },
  component: () => {
    const { locale } = Route.useRouteContext()
    return (
      <CompanyPage
        locale={locale}
        content={contactContent[locale]}
        showEmailActions
        related={['privacy', 'terms']}
      />
    )
  },
  head: ({ match }) => {
    const locale = (match.context.locale ?? 'ar') as Locale
    const content = contactContent[locale]
    return companyPageHead({
      locale,
      path: '/contact',
      title: content.title,
      description: content.description,
    })
  },
})
