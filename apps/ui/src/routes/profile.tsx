import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import {
  onboarding_search_city,
  profile_edit,
  profile_home_location,
  profile_save,
  role_admin,
  role_host,
  role_member,
} from '@founders-coffee/i18n'
import { getCities, getMyProfile, getStates, setHomeLocation, type UserProfile } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'

const COUNTRIES = [
  { code: 'DZ', name: '🇩🇿 Algeria', nameAr: '🇩🇿 الجزائر' },
  { code: 'EG', name: '🇪🇬 Egypt', nameAr: '🇪🇬 مصر' },
  { code: 'SA', name: '🇸🇦 Saudi Arabia', nameAr: '🇸🇦 السعودية' },
] as const

const ROLE_LABELS: Record<string, (l: { locale: string }) => string> = {
  member: () => 'role_member',
  host: () => 'role_host',
  admin: () => 'role_admin',
}

const initials = (name: string): string =>
  name.split(' ').map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase()

const ProfilePage = () => {
  const { locale } = Route.useRouteContext()
  const { profile, states, cities } = Route.useLoaderData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [country, setCountry] = useState(profile.homeMarketCode ?? 'DZ')
  const [stateVal, setStateVal] = useState(profile.homeState ?? '')
  const [city, setCity] = useState(profile.homeCityId ?? '')

  const [citySearch, setCitySearch] = useState('')
  const [showCityList, setShowCityList] = useState(false)

  const filteredCities = citySearch
    ? cities.filter((c) => c.name.toLowerCase().includes(citySearch.toLowerCase()) || c.nameAr.includes(citySearch))
    : cities

  const roleMsg = ROLE_LABELS[profile.role] ?? ROLE_LABELS.member

  const handleSave = async () => {
    if (!country || !stateVal || !city) return
    setSaving(true)
    await setHomeLocation({ data: { marketCode: country, state: stateVal, city } })
    setEditing(false)
    setSaving(false)
    navigate({ to: '/profile' })
  }

  const selectedCity = cities.find((c) => c.code === city)

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card border border-base-300 bg-base-200">
        <div className="card-body gap-4">
          <div className="flex items-center gap-4">
            <div className="avatar avatar-placeholder">
              <div className="w-16 rounded-full bg-neutral text-neutral-content">
                <span className="text-xl font-bold">{initials(profile.name)}</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold">{profile.name}</h1>
              <span className="badge badge-sm badge-outline mt-1 gap-1">
                {roleMsg({ locale }) === 'role_member' ? role_member({}, { locale })
                  : roleMsg({ locale }) === 'role_host' ? role_host({}, { locale })
                  : role_admin({}, { locale })}
              </span>
            </div>
          </div>

          <div className="divider" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-base-content/40">
              {profile_home_location({}, { locale })}
            </h2>
            {!editing && (
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>
                {profile_edit({}, { locale })}
              </button>
            )}
          </div>

          {!editing ? (
            <div className="space-y-1 text-sm">
              <p className="text-base-content/70">
                {profile.homeCityNameAr && locale === 'ar' ? profile.homeCityNameAr : profile.homeCityName ?? '—'}
              </p>
              <p className="text-base-content/50">{profile.homeStateName ?? '—'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <select
                className="select select-bordered select-sm"
                value={country}
                onChange={(e) => { setCountry(e.target.value); setStateVal(''); setCity('') }}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{locale === 'ar' ? c.nameAr : c.name}</option>
                ))}
              </select>
              <select
                className="select select-bordered select-sm"
                value={stateVal}
                onChange={(e) => { setStateVal(e.target.value); setCity('') }}
              >
                <option value="">—</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>{locale === 'ar' ? s.nameAr : s.name}</option>
                ))}
              </select>
              <div className="dropdown w-full">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder={onboarding_search_city({}, { locale })}
                  value={city ? (locale === 'ar' ? selectedCity?.nameAr ?? citySearch : selectedCity?.name ?? citySearch) : citySearch}
                  onChange={(e) => { setCitySearch(e.target.value); setCity(''); setShowCityList(true) }}
                  onFocus={() => setShowCityList(true)}
                  onBlur={() => setTimeout(() => setShowCityList(false), 200)}
                  disabled={!stateVal}
                />
                {showCityList && filteredCities.length > 0 && (
                  <ul className="dropdown-content z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg">
                    {filteredCities.slice(0, 30).map((c) => (
                      <li key={c.code}>
                        <button
                          type="button"
                          className="flex w-full px-3 py-1.5 text-start text-xs hover:bg-base-200"
                          onClick={() => { setCity(c.code); setCitySearch(''); setShowCityList(false) }}
                        >
                          {locale === 'ar' ? c.nameAr : c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary btn-sm flex-1" disabled={saving || !country || !stateVal || !city} onClick={handleSave}>
                  {profile_save({}, { locale })}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
              </div>
            </div>
          )}

          <div className="divider" />
          <div className="text-sm text-base-content/60">{profile.email}</div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
  loaderDeps: ({ search }) => ({ country: (search as { country?: string }).country, state: (search as { state?: string }).state }),
  loader: async ({ deps }): Promise<{ profile: UserProfile; states: readonly geo.GeoState[]; cities: readonly geo.GeoCity[] }> => {
    const profile = await getMyProfile()
    const country = deps.country ?? profile.homeMarketCode ?? 'DZ'
    const states = await getStates({ data: { country } })
    const stateParam = deps.state ?? profile.homeState ?? ''
    const cities = stateParam ? await getCities({ data: { country, state: stateParam } }) : []
    return { profile, states, cities }
  },
})
