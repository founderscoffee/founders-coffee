import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'

import {
  host_back,
  host_capacity,
  host_capacity_unlimited,
  host_category,
  host_desc_label,
  host_desc_ph,
  host_language,
  host_next,
  host_pick_datetime,
  host_publish,
  host_select_venue,
  host_step1,
  host_step2,
  host_step3,
  host_title_label,
  host_title_ph,
  type Locale,
} from '@founders-coffee/i18n'
import { Button, Input } from '@founders-coffee/ui'
import type { geo } from '@founders-coffee/domain'

import { useCreateEvent } from '../features/events/hooks'
import { COUNTRIES } from '../lib/constants'

const MapPicker = lazy(() => import('./MapPicker').then((m) => ({ default: m.MapPicker })))
const DatetimePicker = lazy(() => import('./DatetimePicker').then((m) => ({ default: m.DatetimePicker })))

const LANGUAGES = [
  { value: 'ar', label: 'العربية', labelEn: 'Arabic' },
  { value: 'en', label: 'English', labelEn: 'English' },
  { value: 'fr', label: 'Français', labelEn: 'French' },
  { value: 'ar_en', label: 'العربية + English', labelEn: 'Arabic + English' },
  { value: 'ar_fr', label: 'العربية + Français', labelEn: 'Arabic + French' },
] as const

const CATEGORIES = [
  { value: 'coffee-meetup', labelAr: 'لقاء قهوة', labelEn: 'Coffee Meetup' },
  { value: 'workshop', labelAr: 'ورشة', labelEn: 'Workshop' },
  { value: 'demo-day', labelAr: 'يوم العروض', labelEn: 'Demo Day' },
] as const

type HostCreatePageProps = {
  locale: Locale
  states: readonly geo.GeoState[]
  cities: readonly geo.GeoCity[]
  mapboxToken: string
}

export const HostCreatePage = ({ locale, states, cities, mapboxToken }: HostCreatePageProps) => {
  const navigate = useNavigate()
  const createEventMutation = useCreateEvent()

  const [step, setStep] = useState(1)
  const [country, setCountry] = useState('DZ')
  const [stateCode, setStateCode] = useState('')
  const [cityCode, setCityCode] = useState('')
  const [venue, setVenue] = useState<{ name: string; address: string; lat: number; lng: number } | null>(null)
  const [startsAt, setStartsAt] = useState<number | null>(null)
  const [capacity, setCapacity] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState(locale === 'ar' ? 'ar' : locale)
  const [category, setCategory] = useState('coffee-meetup')
  const [publishing, setPublishing] = useState(false)

  const canProceed = () => {
    if (step === 1) return country && stateCode && cityCode && venue
    if (step === 2) return startsAt !== null
    if (step === 3) return title.length >= 3 && description.length >= 10
    return false
  }

  const handlePublish = async () => {
    if (!venue || startsAt === null) return
    setPublishing(true)
    try {
      await createEventMutation.mutateAsync({
        data: {
          marketCode: country,
          stateCode,
          cityCode,
          title,
          description,
          venue: venue.name,
          startsAt,
          capacity,
          language,
          category,
        },
      })
      const marketSlug = COUNTRIES.find((c) => c.code === country)?.name.toLowerCase().replace(/\s+/g, '-') ?? 'algeria'
      navigate({ to: '/$market', params: { market: marketSlug } })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <ul className="steps steps-horizontal mb-8 w-full">
        <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>{host_step1({}, { locale })}</li>
        <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>{host_step2({}, { locale })}</li>
        <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>{host_step3({}, { locale })}</li>
      </ul>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">{host_step1({}, { locale })}</h2>

          <select className="select select-bordered select-sm" value={country} onChange={(e) => { setCountry(e.target.value); setStateCode(''); setCityCode('') }}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{locale === 'ar' ? c.nameAr : c.name}</option>
            ))}
          </select>

          <select className="select select-bordered select-sm" value={stateCode} onChange={(e) => { setStateCode(e.target.value); setCityCode('') }}>
            <option value="">—</option>
            {states.map((s: geo.GeoState) => (
              <option key={s.code} value={s.code}>{locale === 'ar' ? s.nameAr : s.name}</option>
            ))}
          </select>

          <select className="select select-bordered select-sm" value={cityCode} onChange={(e) => setCityCode(e.target.value)}>
            <option value="">—</option>
            {cities.map((c: geo.GeoCity) => (
              <option key={c.code} value={c.code}>{locale === 'ar' ? c.nameAr : c.name}</option>
            ))}
          </select>

          {mapboxToken && cityCode && (
            <div>
              <p className="mb-2 text-sm text-base-content/60">{host_select_venue({}, { locale })}</p>
              <Suspense fallback={<div className="h-72 rounded-box bg-base-200" />}>
                <MapPicker country={country} token={mapboxToken} onSelect={setVenue} />
              </Suspense>
            </div>
          )}

          <Button onClick={() => setStep(2)} disabled={!canProceed()} isFullWidth>
            {host_next({}, { locale })}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">{host_pick_datetime({}, { locale })}</h2>

          <Suspense fallback={<div className="h-72 rounded-box bg-base-200" />}>
            <DatetimePicker value={startsAt} onChange={setStartsAt} />
          </Suspense>

          <label className="form-control">
            <span className="mb-1 text-sm text-base-content/70">{host_capacity({}, { locale })}</span>
            <select className="select select-bordered" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
              <option value={0}>{host_capacity_unlimited({}, { locale })}</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">
              {host_back({}, { locale })}
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceed()} className="flex-1">
              {host_next({}, { locale })}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">{host_step3({}, { locale })}</h2>

          {venue && (
            <div className="rounded-box bg-base-200 p-3 text-sm">
              <p className="font-semibold">📍 {venue.name}</p>
              <p className="text-base-content/60">{venue.address}</p>
            </div>
          )}

          <label className="form-control">
            <span className="mb-1 text-sm text-base-content/70">{host_title_label({}, { locale })}</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={host_title_ph({}, { locale })} maxLength={120} />
          </label>

          <label className="form-control">
            <span className="mb-1 text-sm text-base-content/70">{host_desc_label({}, { locale })}</span>
            <textarea
              className="textarea textarea-bordered"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={host_desc_ph({}, { locale })}
              maxLength={2000}
            />
          </label>

          <label className="form-control">
            <span className="mb-1 text-sm text-base-content/70">{host_language({}, { locale })}</span>
            <select className="select select-bordered" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{locale === 'ar' ? l.label : l.labelEn}</option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="mb-1 text-sm text-base-content/70">{host_category({}, { locale })}</span>
            <select className="select select-bordered" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{locale === 'ar' ? c.labelAr : c.labelEn}</option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)} className="flex-1">
              {host_back({}, { locale })}
            </Button>
            <Button variant="primary" onClick={handlePublish} disabled={!canProceed() || publishing} className="flex-1">
              {host_publish({}, { locale })}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
