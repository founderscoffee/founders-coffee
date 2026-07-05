import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import {
  hero_search_no_match,
  onboarding_city,
  onboarding_country,
  onboarding_save,
  onboarding_search_city,
  onboarding_state,
  onboarding_subtitle,
  onboarding_title,
  type Locale,
} from '@founders-coffee/i18n'
import type { geo } from '@founders-coffee/domain'

import { useUpdateProfile } from '../features/profile/hooks'
import { CitySearchCombobox } from './CitySearchCombobox'
import { COUNTRIES } from '../lib/constants'

type OnboardingPageProps = {
  locale: Locale
  states: readonly geo.GeoState[]
  cities: readonly geo.GeoCity[]
  initialCountry: string
}

export const OnboardingPage = ({ locale, states, cities, initialCountry }: OnboardingPageProps) => {
  const navigate = useNavigate()
  const updateProfileMutation = useUpdateProfile()

  const [country, setCountry] = useState<string>(initialCountry)
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCountryChange = (code: string) => {
    setCountry(code)
    setState('')
    setCity('')
  }

  const handleStateChange = (code: string) => {
    setState(code)
    setCity('')
  }

  const handleSave = async () => {
    if (!country || !state || !city) return
    setSaving(true)
    await updateProfileMutation.mutateAsync({ data: { marketCode: country, state, city } })
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

          <ul className="steps steps-horizontal w-full">
            <li className={`step ${country ? 'step-primary' : ''}`}>{onboarding_country({}, { locale })}</li>
            <li className={`step ${state ? 'step-primary' : ''}`}>{onboarding_state({}, { locale })}</li>
            <li className={`step ${city ? 'step-primary' : ''}`}>{onboarding_city({}, { locale })}</li>
          </ul>

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

          <div className="form-control">
            <span className="mb-1 text-sm text-base-content/70">
              {onboarding_city({}, { locale })}
            </span>
            <CitySearchCombobox
              cities={cities}
              value={city}
              onSelect={setCity}
              placeholder={onboarding_search_city({}, { locale })}
              noMatchText={hero_search_no_match({ query: '{query}' }, { locale })}
              disabled={!state}
              locale={locale}
            />
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
