import { createFileRoute } from '@tanstack/react-router'
import { getCookies } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getMapboxToken } from '@founders-coffee/server-fns'

import { HostCreatePage } from '../components/HostCreatePage'

export const Route = createFileRoute('/host/create')({
  validateSearch: z.object({ city: z.string().optional() }),
  component: () => {
    const { locale, markets } = Route.useRouteContext()
    const { mapboxToken, initialCountry } = Route.useLoaderData()
    const { city: cityFromUrl } = Route.useSearch()
    return (
      <HostCreatePage
        locale={locale}
        markets={markets}
        mapboxToken={mapboxToken}
        initialCountry={initialCountry}
        initialCityCode={cityFromUrl}
      />
    )
  },
  loader: async ({ context }): Promise<{ mapboxToken: string; initialCountry: string }> => {
    const geoCookie = getCookies()['fc_geo'] ?? 'algeria'
    const initialCountry = context.markets.find((m: { code: string }) => m.code === geoCookie.toUpperCase())?.code ?? 'DZ'
    const mapboxToken = await getMapboxToken()
    return { mapboxToken, initialCountry }
  },
})
