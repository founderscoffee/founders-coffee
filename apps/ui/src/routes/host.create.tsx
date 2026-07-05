import { createFileRoute } from '@tanstack/react-router'
import { getCookies } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getMapboxToken } from '@founders-coffee/server-fns'

import { HostCreatePage } from '../components/HostCreatePage'
import { COUNTRIES } from '../lib/constants'

export const Route = createFileRoute('/host/create')({
  validateSearch: z.object({ city: z.string().optional() }),
  component: () => {
    const { locale } = Route.useRouteContext()
    const { mapboxToken, initialCountry } = Route.useLoaderData()
    const { city: cityFromUrl } = Route.useSearch()
    return (
      <HostCreatePage
        locale={locale}
        mapboxToken={mapboxToken}
        initialCountry={initialCountry}
        initialCityCode={cityFromUrl}
      />
    )
  },
  loader: async (): Promise<{ mapboxToken: string; initialCountry: string }> => {
    const geoCookie = getCookies()['fc_geo'] ?? 'algeria'
    const initialCountry = COUNTRIES.find((c) => c.code === geoCookie.toUpperCase())?.code ?? 'DZ'
    const mapboxToken = await getMapboxToken()
    return { mapboxToken, initialCountry }
  },
})
