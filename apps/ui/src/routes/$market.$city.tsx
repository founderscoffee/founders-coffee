import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { city_empty_body, type Locale } from '@founders-coffee/i18n'
import { getCityLanding, type MarketCity } from '@founders-coffee/server-fns'

import { CityLanding } from '../components/landing/CityLanding'

export const Route = createFileRoute('/$market/$city')({
  staticData: { prerender: true },
  component: () => {
    const { locale } = Route.useRouteContext()
    const { market, city, events } = Route.useLoaderData()
    return <CityLanding locale={locale} market={market} city={city} events={events} />
  },
  loader: async ({ params }): Promise<MarketCity> => {
    try {
      const { market, city, events } = await getCityLanding({
        data: { marketKey: params.market, citySlug: params.city },
      })
      if (params.market !== market.slug) {
        throw redirect({ to: '/$market/$city', params: { market: market.slug, city: params.city } })
      }
      return { market, city, events }
    } catch (error) {
      const code = appErrorCode(error)
      if (code === 'market_not_found' || code === 'city_not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => {
    const locale = (loaderData?.market.defaultLocale ?? 'ar') as Locale
    const cityName = loaderData?.city.name ?? 'founders.coffee'
    const isEmpty = (loaderData?.events.length ?? 0) === 0
    const citySlug = loaderData?.city.slug ?? ''
    const marketSlug = loaderData?.market.slug ?? ''

    return {
      meta: [
        { title: `${cityName} — founders.coffee` },
        {
          name: 'description',
          content: city_empty_body({}, { locale }),
        },
        ...(isEmpty
          ? [{ name: 'robots' as const, content: 'noindex,follow' }]
          : [{ name: 'robots' as const, content: 'index,follow' }]),
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: `${cityName} — founders.coffee community`,
            description: city_empty_body({}, { locale }),
            url: `https://founders.coffee/${marketSlug}/${citySlug}`,
          }),
        },
      ],
    }
  },
})
