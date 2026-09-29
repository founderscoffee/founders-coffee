import type { Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import type { EventPhase } from '../../features/events/live-window';
import type { UseEventLiveResult } from '../../features/events/useEventLive';
import { RsvpBoxHeading } from './RsvpBoxHeading';
import { RsvpSection } from './RsvpSection';

type EventRsvpBoxProps = {
  locale: Locale;
  event: EventDetailItem;
  hostName: string;
  marketSlug: string;
  isHost: boolean;
  live: UseEventLiveResult | null;
  isWindowOpen: boolean;
  phase: EventPhase;
};

export const EventRsvpBox = ({
  locale,
  event,
  hostName,
  marketSlug,
  isHost,
  live,
  isWindowOpen,
  phase,
}: EventRsvpBoxProps) => (
  <aside className="flex h-full flex-col gap-4 lg:sticky lg:top-6 lg:self-stretch lg:pt-12">
    <section
      aria-labelledby="event-rsvp-title"
      className="flex flex-1 flex-col rounded-box border-2 border-secondary bg-base-100 p-3 shadow-[var(--shadow-2)] sm:p-5"
    >
      <RsvpBoxHeading
        locale={locale}
        isHost={isHost}
        isCancelled={event.status === 'cancelled'}
        isGoing={event.viewerRsvp === 'going'}
        phase={phase}
      />
      <div className="mt-auto">
        <RsvpSection
          event={event}
          hostName={hostName}
          marketSlug={marketSlug}
          locale={locale}
          isHost={isHost}
          live={live}
          isWindowOpen={isWindowOpen}
          phase={phase}
        />
      </div>
    </section>
  </aside>
);
