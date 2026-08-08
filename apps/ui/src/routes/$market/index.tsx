import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { market_hero_desc, type Locale } from '@founders-coffee/i18n'
import { getMarketLanding, type MarketWithCities } from '@founders-coffee/server-fns'

import { MarketLanding } from '../../components/landing/MarketLanding'

export const Route = createFileRoute('/$market/')({
  staticData: { prerender: true },
  pendingComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="loading loading-dots loading-lg text-primary" />
    </div>
  ),
  component: () => {
    const { locale } = Route.useRouteContext()
    const { market, cities, events, cityEventCounts, trending } = Route.useLoaderData()
    return (
      <MarketLanding
        locale={locale}
        market={market}
        cities={cities}
        cityEventCounts={cityEventCounts}
        events={events}
        trending={trending}
      />
    )
  },
  loader: async ({ params }): Promise<MarketWithCities> => {
    try {
      const { market, cities, events, cityEventCounts, trending } = await getMarketLanding({
        data: { key: params.market },
      })
      if (params.market !== market.slug) {
        throw redirect({ to: '/$market', params: { market: market.slug } })
      }
      return { market, cities, events, cityEventCounts, trending }
    } catch (error) {
      if (appErrorCode(error) === 'market_not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.market.name ?? 'founders.coffee'} - founders.coffee` },
      {
        name: 'description',
        content: market_hero_desc({}, { locale: (loaderData?.market.defaultLocale ?? 'ar') as Locale }),
      },
    ],
  }),
})
