import { createFileRoute } from '@tanstack/react-router'
import { getCookies } from '@tanstack/react-start/server'

import { getCities, getStates } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'

import { OnboardingPage } from '../components/OnboardingPage'
import { COUNTRIES } from '../lib/constants'

export const Route = createFileRoute('/onboarding')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const { states, cities, initialCountry } = Route.useLoaderData()
    return <OnboardingPage locale={locale} states={states} cities={cities} initialCountry={initialCountry} />
  },
  loader: async ({ location }): Promise<{ states: readonly geo.GeoState[]; cities: readonly geo.GeoCity[]; initialCountry: string }> => {
    const geoCookie = getCookies()['fc_geo'] ?? 'algeria'
    const initialCountry = COUNTRIES.find((c) => c.code === geoCookie.toUpperCase())?.code ?? 'DZ'
    const states = await getStates({ data: { country: initialCountry } })
    const stateParam = new URLSearchParams(location.search).get('state') ?? ''
    const cities = stateParam ? await getCities({ data: { country: initialCountry, state: stateParam } }) : []
    return { states, cities, initialCountry }
  },
})
