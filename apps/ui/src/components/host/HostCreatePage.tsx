import { useNavigate } from '@tanstack/react-router'
import { CalendarClock, MapPin, MousePointerClick } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'

import {
  host_back,
  host_desc_label,
  host_desc_ph,
  host_duration_min,
  host_next,
  host_page_sub,
  host_page_title,
  host_publish,
  host_publish_error,
  host_step1,
  host_step1_helper,
  host_step3,
  host_step3_sub,
  host_time_past,
  host_title_label,
  host_title_ph,
  type Locale,
} from '@founders-coffee/i18n'
import type { Market } from '@founders-coffee/db'
import type { geo } from '@founders-coffee/domain'
import { Button, Input } from '@founders-coffee/ui'

import { useCreateEvent } from '../../features/events/hooks'
import { ClientOnly } from './ClientOnly'
import { DatetimePicker } from './DatetimePicker'
import type { VenueSelection } from './HostMap'
import { Stepper } from './Stepper'

const HostMap = lazy(() => import('./HostMap').then((m) => ({ default: m.HostMap })))
const VenueSearch = lazy(() => import('./VenueSearch').then((m) => ({ default: m.VenueSearch })))

type HostCreatePageProps = {
  locale: Locale
  market: Market
  city: geo.GeoCity
  mapboxToken: string
}

export const HostCreatePage = ({ locale, market, city, mapboxToken }: HostCreatePageProps) => {
  const navigate = useNavigate()
  const createEventMutation = useCreateEvent()

  const [step, setStep] = useState(1)
  const [venue, setVenue] = useState<VenueSelection | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [startsAt, setStartsAt] = useState<number | null>(null)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const cityName = locale === 'ar' ? city.nameAr : city.name
  const marketIso = market.code.toLowerCase()

  const selectVenue = (v: VenueSelection) => {
    setVenue(v)
    setSearchValue(v.address || v.name)
  }

  /** Matches TimePicker `minDuration: 30` — zero/negative ranges must not unlock Next. */
  const hasValidTimeRange =
    startsAt !== null && endsAt !== null && endsAt - startsAt >= 30 * 60_000

  const canProceed =
    step === 1
      ? !!venue
      : step === 2
        ? hasValidTimeRange
        : title.length >= 3 && description.length >= 10

  const stepTitle = step === 1 ? host_step1({}, { locale }) : host_step3({}, { locale })
  const stepSub = step === 3 ? host_step3_sub({}, { locale }) : null

  const whenLabel =
    startsAt !== null
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(startsAt))
      : ''

  /** Summary pills rendered on the stepper's connectors — the location pill on segment 1–2
   *  (once a venue is chosen), the time pill on segment 2–3 (once a datetime is chosen). */
  const stepperSegments = [
    venue ? (
      <span key="loc" className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-base-300/70 bg-base-100 px-2.5 py-1 shadow-sm">
        <MapPin className="size-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-semibold text-base-content">{venue.name}</span>
      </span>
    ) : null,
    hasValidTimeRange ? (
      <span key="time" className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-base-300/70 bg-base-100 px-2.5 py-1 shadow-sm">
        <CalendarClock className="size-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-semibold text-base-content">{whenLabel}</span>
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">{host_duration_min({ n: Math.round((endsAt - startsAt) / 60_000) }, { locale })}</span>
      </span>
    ) : null,
  ]

  const handlePublish = async () => {
    if (!venue || startsAt === null || endsAt === null) return
    setPublishing(true)
    setPublishError(null)
    try {
      await createEventMutation.mutateAsync({
        data: {
          marketCode: market.code,
          stateCode: city.stateCode,
          cityCode: city.code,
          title,
          description,
          venue: venue.name,
          startsAt,
          endsAt,
          capacity: 0,
          language: locale === 'ar' ? 'ar' : locale,
          category: 'coffee-meetup',
        },
      })
      void navigate({ to: '/$market', params: { market: market.slug } })
    } catch {
      setPublishError(host_publish_error({}, { locale }))
    } finally {
      setPublishing(false)
    }
  }

  const next = () => {
    /* Future-check lives in the handler (not in `canProceed`) so the button's disabled state stays a
       pure function of selection — Date.now() in render is a hydration-mismatch risk. Past dates are
       already blocked by the calendar; this catches a same-day past time. */
    if (step === 2 && !hasValidTimeRange) return
    if (step === 2 && startsAt !== null && startsAt <= Date.now()) {
      setPublishError(host_time_past({}, { locale }))
      return
    }
    setPublishError(null)
    return step === 3 ? handlePublish() : setStep((s) => s + 1)
  }
  const prev = () => setStep((s) => Math.max(1, s - 1))

  return (
    <div className="host-wizard-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 md:pt-12 md:pb-16">
        <header className="host-fade-up mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-base-content md:text-5xl">{host_page_title({}, { locale })}</h1>
            <p className="mt-3 text-lg text-base-content/60">{host_page_sub({}, { locale })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={prev} className="h-12 px-5 text-base font-semibold">
                {host_back({}, { locale })}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={next}
              disabled={!canProceed || publishing}
              className="h-12 min-w-28 px-6 text-base font-semibold"
            >
              {step === 3 ? host_publish({}, { locale }) : host_next({}, { locale })}
            </Button>
          </div>
        </header>

        <div className="mb-8">
          <Stepper current={step} total={3} segments={stepperSegments} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.85fr_1fr]">
          <div className="order-2 flex flex-col lg:order-1">
            {step === 2 && <div className="mb-3 hidden h-[4.5rem] lg:block" aria-hidden="true" />}
            <ClientOnly fallback={<div className="h-[400px] w-full rounded-2xl bg-base-200" />}>
              <Suspense fallback={<div className="h-[400px] w-full rounded-2xl bg-base-200" />}>
                <HostMap accessToken={mapboxToken} venue={venue} city={city} marketCode={market.code} locale={locale} onVenueSelect={selectVenue} />
              </Suspense>
            </ClientOnly>
          </div>

          <div className="order-1 lg:order-2">
            {step === 2 ? (
              <div className="host-fade-up" key={step}>
                <DatetimePicker
                  startsAt={startsAt}
                  endsAt={endsAt}
                  onChange={(s, e) => {
                    setStartsAt(s)
                    setEndsAt(e)
                    setPublishError(null)
                  }}
                  locale={locale}
                  timePlacement="top"
                />
                {publishError && <p className="mt-2 text-sm text-error" role="alert">{publishError}</p>}
              </div>
            ) : (
              <div className="flex h-[400px] flex-col rounded-[1.25rem] border border-base-300/60 bg-base-100/70 p-6 shadow-xl shadow-base-content/5 backdrop-blur-md md:p-7">
                <div className="host-fade-up flex min-h-0 flex-1 flex-col" key={step}>
                  <h2 className="text-2xl font-bold tracking-tight text-base-content">{stepTitle}</h2>
                  {stepSub && <p className="mt-1 text-base text-base-content/60">{stepSub}</p>}

                  <div className="mt-6 flex min-h-0 flex-1 flex-col">
                    {step === 1 && (
                      <div className="mt-auto flex flex-col gap-3">
                        <p className="flex items-start gap-2 text-sm text-base-content/50">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <MousePointerClick className="size-4" aria-hidden="true" />
                          </span>
                          <span>{host_step1_helper({}, { locale })}</span>
                        </p>
                        <ClientOnly fallback={<div className="h-14 rounded-xl bg-base-200" />}>
                          <Suspense fallback={<div className="h-14 rounded-xl bg-base-200" />}>
                            <VenueSearch accessToken={mapboxToken} locale={locale} cityName={cityName} marketIso={marketIso} value={searchValue} onChange={setSearchValue} onVenueSelect={selectVenue} />
                          </Suspense>
                        </ClientOnly>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
                        <label className="form-control">
                          <span className="mb-1 text-sm text-base-content/70">{host_title_label({}, { locale })}</span>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={host_title_ph({}, { locale })} maxLength={120} />
                        </label>
                        <label className="form-control">
                          <span className="mb-1 text-sm text-base-content/70">{host_desc_label({}, { locale })}</span>
                          <textarea className="textarea textarea-bordered" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={host_desc_ph({}, { locale })} maxLength={2000} />
                        </label>
                        {publishError && <p className="text-sm text-error" role="alert">{publishError}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
