import { createFileRoute } from '@tanstack/react-router'
import { getCookies } from '@tanstack/react-start/server'

import { getCities, getStates } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'

import { OnboardingPage } from '../components/OnboardingPage'

export const Route = createFileRoute('/onboarding')({
  component: () => {
    const { locale, markets } = Route.useRouteContext()
    const { states, cities, initialCountry } = Route.useLoaderData()
    return <OnboardingPage locale={locale} markets={markets} states={states} cities={cities} initialCountry={initialCountry} />
  },
  loader: async ({ context, location }): Promise<{ states: readonly geo.GeoState[]; cities: readonly geo.GeoCity[]; initialCountry: string }> => {
    const geoCookie = getCookies()['fc_geo'] ?? 'algeria'
    const initialCountry = context.markets.find((m: { code: string }) => m.code === geoCookie.toUpperCase())?.code ?? 'DZ'
    const states = await getStates({ data: { country: initialCountry } })
    const stateParam = new URLSearchParams(location.search).get('state') ?? ''
    const cities = stateParam ? await getCities({ data: { country: initialCountry, state: stateParam } }) : []
    return { states, cities, initialCountry }
  },
})
