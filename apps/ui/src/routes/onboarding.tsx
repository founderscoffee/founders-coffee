import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import {
  onboarding_city,
  onboarding_country,
  onboarding_save,
  onboarding_search_city,
  onboarding_state,
  onboarding_subtitle,
  onboarding_title,
} from '@founders-coffee/i18n'
import { getCities, getStates, setHomeLocation } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'
import { getCookies } from '@tanstack/react-start/server'

const COUNTRIES = [
  { code: 'DZ', name: '🇩🇿 Algeria', nameAr: '🇩🇿 الجزائر' },
  { code: 'EG', name: '🇪🇬 Egypt', nameAr: '🇪🇬 مصر' },
  { code: 'SA', name: '🇸🇦 Saudi Arabia', nameAr: '🇸🇦 السعودية' },
] as const

const OnboardingPage = () => {
  const { locale } = Route.useRouteContext()
  const navigate = useNavigate()

  const geoCookie = getCookies()['fc_geo'] ?? 'algeria'

  const initialCountry = useMemo(() => {
    const match = COUNTRIES.find((c) => c.code === geoCookie.toUpperCase())
    return match?.code ?? 'DZ'
  }, [geoCookie])

  const [country, setCountry] = useState<string>(initialCountry)
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [showCityList, setShowCityList] = useState(false)
  const [saving, setSaving] = useState(false)

  const { states, cities } = Route.useLoaderData()

  const filteredCities = useMemo(
    () =>
      citySearch
        ? cities.filter(
            (c) =>
              c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
              c.nameAr.includes(citySearch),
          )
        : cities,
    [cities, citySearch],
  )

  const handleCountryChange = (code: string) => {
    setCountry(code)
    setState('')
    setCity('')
    setCitySearch('')
  }

  const handleStateChange = (code: string) => {
    setState(code)
    setCity('')
    setCitySearch('')
  }

  const handleSave = async () => {
    if (!country || !state || !city) return
    setSaving(true)
    await setHomeLocation({ data: { marketCode: country, state, city } })
    const marketSlug = COUNTRIES.find((c) => c.code === country)?.name.toLowerCase().replace(' ', '-') ?? 'algeria'
    navigate({ to: '/$market', params: { market: marketSlug } })
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card border border-base-300 bg-base-200">
        <div className="card-body gap-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{onboarding_title({}, { locale })}</h1>
            <p className="mt-1 text-sm text-base-content/60">
              {onboarding_subtitle({}, { locale })}
            </p>
          </div>

          {/* Steps indicator */}
          <ul className="steps steps-horizontal w-full">
            <li className={`step ${country ? 'step-primary' : ''}`}>{onboarding_country({}, { locale })}</li>
            <li className={`step ${state ? 'step-primary' : ''}`}>{onboarding_state({}, { locale })}</li>
            <li className={`step ${city ? 'step-primary' : ''}`}>{onboarding_city({}, { locale })}</li>
          </ul>

          {/* Country */}
          <label className="form-control">
            <span className="mb-1 text-sm text-base-content/70">
              {onboarding_country({}, { locale })}
            </span>
            <select
              className="select select-bordered"
              value={country}
              onChange={(e) => handleCountryChange(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {locale === 'ar' ? c.nameAr : c.name}
                </option>
              ))}
            </select>
          </label>

          {/* State */}
          <label className="form-control">
            <span className="mb-1 text-sm text-base-content/70">
              {onboarding_state({}, { locale })}
            </span>
            <select
              className="select select-bordered"
              value={state}
              onChange={(e) => handleStateChange(e.target.value)}
              disabled={!country}
            >
              <option value="">—</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {locale === 'ar' ? s.nameAr : s.name}
                </option>
              ))}
            </select>
          </label>

          {/* City (searchable combobox) */}
          <div className="form-control">
            <span className="mb-1 text-sm text-base-content/70">
              {onboarding_city({}, { locale })}
            </span>
            <div className="dropdown w-full">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={onboarding_search_city({}, { locale })}
                value={city ? `${locale === 'ar' ? cities.find((c) => c.code === city)?.nameAr : cities.find((c) => c.code === city)?.name ?? citySearch}` : citySearch}
                onChange={(e) => {
                  setCitySearch(e.target.value)
                  setCity('')
                  setShowCityList(true)
                }}
                onFocus={() => setShowCityList(true)}
                onBlur={() => setTimeout(() => setShowCityList(false), 200)}
                disabled={!state}
              />
              {showCityList && filteredCities.length > 0 && (
                <ul className="dropdown-content z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg" role="listbox">
                  {filteredCities.slice(0, 50).map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        className="flex w-full justify-between px-4 py-2 text-start text-sm hover:bg-base-200"
                        onClick={() => {
                          setCity(c.code)
                          setCitySearch('')
                          setShowCityList(false)
                        }}
                      >
                        <span>{locale === 'ar' ? c.nameAr : c.name}</span>
                        <span className="text-base-content/40">{c.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary mt-2"
            disabled={!country || !state || !city || saving}
            onClick={handleSave}
          >
            {onboarding_save({}, { locale })}
          </button>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
  loader: async ({ location }): Promise<{ states: readonly geo.GeoState[]; cities: readonly geo.GeoCity[] }> => {
    const country = new URLSearchParams(location.search).get('country') ?? getCookies()['fc_geo']?.toUpperCase() ?? 'DZ'
    const states = await getStates({ data: { country } })
    const stateParam = new URLSearchParams(location.search).get('state') ?? ''
    const cities = stateParam ? await getCities({ data: { country, state: stateParam } }) : []
    return { states, cities }
  },
})
