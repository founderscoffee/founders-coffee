import { going_count, type Locale } from '@founders-coffee/i18n'

import type { SampleEvent } from '../lib/sample-events'

import { Hover3D } from './hover-3d'

const initials = (name: string): string => name.charAt(0)

/**
 * A 720×150 event card with daisyUI `hover-3d` (tilt + shine on hover). Semantic `<article>` with
 * a date widget, the title, a metadata row, and an avatar-group social-proof footer.
 */
export const EventCard = ({ event, locale }: { event: SampleEvent; locale: Locale }) => {
  const names = event.attendees.featured_names
  const totalGoing = names.length + event.attendees.additional_count
  const avatars = names.slice(0, 3)

  return (
    <Hover3D>
      <article className="card card-side bg-base-200 border border-base-300 max-w-[720px]">
        {/* Date widget */}
        <div className="flex flex-col items-center justify-center bg-primary/10 text-primary rounded-box gap-0.5 px-3 py-2 m-2 min-w-16">
          <span className="text-xs font-bold uppercase tracking-wide">{event.date.day_of_week}</span>
          <span className="text-2xl font-extrabold leading-none">{event.date.day}</span>
          <span className="text-xs font-bold uppercase opacity-80">{event.date.month}</span>
        </div>

        {/* Card body */}
        <div className="card-body gap-1 p-3 pe-4">
          <h3 className="card-title text-base leading-snug">{event.title}</h3>
          <p className="text-sm text-base-content/60">
            {event.time} <span className="opacity-40">·</span> {event.location.venue}، {event.location.city}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="avatar-group">
              {avatars.map((n) => (
                <div key={n} className="avatar avatar-placeholder">
                  <div className="w-7 rounded-full bg-neutral text-neutral-content">
                    <span className="text-[10px] font-bold">{initials(n)}</span>
                  </div>
                </div>
              ))}
              {totalGoing > avatars.length && (
                <div className="avatar avatar-placeholder">
                  <div className="w-7 rounded-full bg-base-300 text-base-content/60">
                    <span className="text-[10px] font-bold">+{totalGoing - avatars.length}</span>
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs text-base-content/60">
              {names.slice(0, 2).join('، ')}{' '}
              {going_count({ count: totalGoing }, { locale })}
            </span>
          </div>
        </div>
      </article>
    </Hover3D>
  )
}
