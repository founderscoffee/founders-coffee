import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  rsvp_already,
  rsvp_cancel,
  rsvp_cta,
  rsvp_error,
  rsvp_event_full,
  rsvp_no_limit,
  rsvp_remaining,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventWithAttendance } from '@founders-coffee/server-fns';

import { useCancelRsvp, useCreateRsvp } from '../features/events/hooks';
import { useAuth } from '../lib/app-providers';
import { PushPermissionPrompt } from '../features/events/components/PushPermissionPrompt';

export type RsvpSectionProps = {
  event: EventWithAttendance;
  locale: Locale;
};

/**
 * RSVP slot on the event-detail page. "I'm attending" → atomic capacity check; cancel releases the
 * seat. On success the active route loader is refetched via `router.invalidate()` (TanStack Router
 * re-runs the current route's loader) so viewerRsvp/remaining/goingCount refresh without a reload.
 * All copy is localized via the `{ locale }` option (FR-L1).
 */
export const RsvpSection = ({ event, locale }: RsvpSectionProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const createRsvp = useCreateRsvp();
  const cancelRsvp = useCancelRsvp();
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const isGoing = event.viewerRsvp === 'going';
  const isFull = event.capacity > 0 && event.remaining !== null && event.remaining <= 0;

  const handleRsvp = () => {
    if (!isAuthenticated) {
      navigate({ to: '/login', search: { redirect: window.location.pathname } });
      return;
    }
    createRsvp.mutate(
      { data: { eventId: event.id } },
      {
        onSuccess: () => {
          router.invalidate();
          setShowPushPrompt(true);
        },
        onError: (error) => {
          const code = appErrorCode(error);
          if (code === 'event_full') {
            alert(rsvp_event_full({}, { locale }));
          } else if (code === 'already_rsvpd') {
            alert(rsvp_already({}, { locale }));
          } else {
            alert(rsvp_error({}, { locale }));
          }
        },
      },
    );
  };

  const handleCancel = () => {
    cancelRsvp.mutate(
      { data: { eventId: event.id } },
      {
        onSuccess: () => router.invalidate(),
        onError: () => {
          alert(rsvp_error({}, { locale }));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {isGoing ? (
        <>
          <div className="badge badge-success badge-lg">{rsvp_already({}, { locale })}</div>
          <button
            className="btn btn-outline btn-error btn-sm"
            onClick={handleCancel}
            disabled={cancelRsvp.isPending}
          >
            {rsvp_cancel({}, { locale })}
          </button>
        </>
      ) : isFull ? (
        <button className="btn btn-disabled btn-lg" disabled>
          {rsvp_event_full({}, { locale })}
        </button>
      ) : (
        <button
          className="btn btn-primary btn-lg"
          onClick={handleRsvp}
          disabled={createRsvp.isPending}
        >
          {createRsvp.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            rsvp_cta({}, { locale })
          )}
        </button>
      )}

      {event.capacity > 0 && event.remaining !== null && (
        <p className="text-sm text-base-content/60">
          {event.remaining > 0
            ? rsvp_remaining({ count: String(event.remaining) }, { locale })
            : rsvp_event_full({}, { locale })}
        </p>
      )}
      {event.capacity === 0 && (
        <p className="text-sm text-base-content/60">{rsvp_no_limit({}, { locale })}</p>
      )}
      {showPushPrompt && (
        <PushPermissionPrompt
          onAccept={async () => {
            setShowPushPrompt(false);
            const { requestPushPermission } = await import('../features/push/client');
            await requestPushPermission(event.marketCode);
          }}
          onDecline={() => setShowPushPrompt(false)}
        />
      )}
    </div>
  );
};
