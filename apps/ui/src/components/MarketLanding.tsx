import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import {
  cities_in,
  discover_events,
  discover_hackathons,
  host_in_market,
  market_hero_desc,
  market_hero_title,
  no_events_yet,
  type Locale,
} from '@founders-coffee/i18n'
import type { Market } from '@founders-coffee/db'
import type { geo } from '@founders-coffee/domain'

import { EventCard } from './EventCard'
import { sampleEvents } from '../lib/sample-events'

type MarketLandingProps = {
  locale: Locale
  market: Market
  cities: readonly geo.GeoCity[]
}

export const MarketLanding = ({ locale, market, cities }: MarketLandingProps) => {
  const [tab, setTab] = useState<'events' | 'hackathons'>('events')
  const events = import.meta.env.DEV && tab === 'events' ? sampleEvents : []

  return (
    <>
      <section className="relative overflow-hidden pb-12 pt-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(245,158,11,0.15),transparent_70%)]" />
        <div className="mx-auto max-w-5xl px-4">
          <span className="badge badge-outline badge-primary gap-1 font-semibold">
            <span className="inline-block size-1.5 rounded-full bg-primary" />
            {market.name}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-base-content">
            {market_hero_title({ market: market.name }, { locale })}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-base-content/60">
            {market_hero_desc({}, { locale })}
          </p>
          <Link to="/login" className="btn btn-primary mt-6 gap-1 text-base shadow-lg shadow-primary/30">
            {host_in_market({ market: market.name }, { locale })}
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-base-content/40">
          {cities_in({ market: market.name }, { locale })}
        </h2>
        <div className="flex flex-wrap gap-3">
          {cities.map((c) => (
            <Link
              key={c.code}
              to="/$market/$city"
              params={{ market: market.slug, city: c.slug }}
              className="btn btn-ghost gap-2 border border-base-300 hover:border-primary"
            >
              {locale === 'ar' ? c.nameAr : c.name}
              <span className="badge badge-sm bg-base-300 text-base-content/40">0</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div role="tablist" className="tabs tabs-lift mb-6">
          <button
            type="button"
            role="tab"
            className={`tab ${tab === 'events' ? 'tab-active' : ''}`}
            onClick={() => setTab('events')}
          >
            {discover_events({}, { locale })}
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === 'hackathons' ? 'tab-active' : ''}`}
            onClick={() => setTab('hackathons')}
          >
            {discover_hackathons({}, { locale })}
          </button>
        </div>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((e) => (
              <EventCard key={e.id} event={e} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-base-content/40">{no_events_yet({}, { locale })}</p>
        )}
      </section>
    </>
  )
}
