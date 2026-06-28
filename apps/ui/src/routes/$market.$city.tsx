import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { city_empty_body, city_empty_cta, city_empty_title, type Locale } from '@founders-coffee/i18n'
import { getCityLanding, type MarketCity } from '@founders-coffee/server-fns'
import { buttonVariants, Card, CardBody } from '@founders-coffee/ui'

const CityLanding = () => {
  const { locale } = Route.useRouteContext()
  const { city } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card>
        <CardBody className="items-center text-center">
          <h1 className="text-3xl font-bold text-primary">
            {city_empty_title({ city: city.name }, { locale })}
          </h1>
          <p className="mt-3 text-base-content/70">{city_empty_body({}, { locale })}</p>
          {/* Forward-link to /login (P1-003). Plain anchor: TanStack's type-safe Link rejects the
              not-yet-existing route; /login 404s (notFoundComponent) until auth UI lands. */}
          <a href="/login" className={`${buttonVariants({ variant: 'primary' })} mt-6`}>
            {city_empty_cta({}, { locale })}
          </a>
        </CardBody>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/$market/$city')({
  component: CityLanding,
  loader: async ({ params }): Promise<MarketCity> => {
    try {
      const { market, city } = await getCityLanding({
        data: { marketKey: params.market, citySlug: params.city },
      })
      /* Canonicalize the code alias (/dz/algiers → /algeria/algiers). */
      if (params.market !== market.slug) {
        throw redirect({ to: '/$market/$city', params: { market: market.slug, city: params.city } })
      }
      return { market, city }
    } catch (error) {
      const code = appErrorCode(error)
      if (code === 'market_not_found' || code === 'city_not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.city.name ?? 'founders.coffee'} — founders.coffee` },
      {
        name: 'description',
        content: city_empty_body({}, { locale: (loaderData?.market.defaultLocale ?? 'ar') as Locale }),
      },
    ],
  }),
})
