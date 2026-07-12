import { Link } from '@tanstack/react-router'

import { formatDate, going_count, type Locale } from '@founders-coffee/i18n'
import type { EventFeedItem } from '@founders-coffee/server-fns'

import { Hover3D } from '../ui/Hover3D'

type EventCardProps = {
  event: EventFeedItem
  locale: Locale
  timezone: string
  marketSlug: string
}

export const EventCard = ({ event, locale, timezone, marketSlug }: EventCardProps) => {
  const start = new Date(event.startsAt)
  const weekday = formatDate(start, locale, { timeZone: timezone, weekday: 'short' })
  const day = formatDate(start, locale, { timeZone: timezone, day: 'numeric' })
  const month = formatDate(start, locale, { timeZone: timezone, month: 'short' })
  const time = formatDate(start, locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
  const cityName = locale === 'ar' ? event.cityNameAr : event.cityName

  return (
    <Hover3D>
      <Link to="/$market/e/$slug" params={{ market: marketSlug, slug: event.slug }} className="block">
        <article className="card card-side max-w-[720px] border border-base-300 bg-base-200">
          <div className="m-2 flex min-w-16 flex-col items-center justify-center gap-0.5 rounded-box bg-primary/10 px-3 py-2 text-primary">
            <span className="text-xs font-bold uppercase tracking-wide">{weekday}</span>
            <span className="text-2xl font-extrabold leading-none">{day}</span>
            <span className="text-xs font-bold uppercase opacity-80">{month}</span>
          </div>

          <div className="card-body gap-1 p-3 pe-4">
            <h3 className="card-title text-base leading-snug">{event.title}</h3>
            <p className="text-sm text-base-content/60">
              {time} <span className="opacity-40">·</span> {event.venue}{locale === 'ar' ? '،' : ','} {cityName}
            </p>
            {event.goingCount != null ? (
              <p className="mt-1 text-xs text-base-content/60">
                {going_count({ count: event.goingCount }, { locale })}
              </p>
            ) : null}
          </div>
        </article>
      </Link>
    </Hover3D>
  )
}
