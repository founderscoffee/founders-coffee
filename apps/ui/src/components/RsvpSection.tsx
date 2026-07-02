import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
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
import { appErrorCode } from '@founders-coffee/core';
import type { EventWithAttendance } from '@founders-coffee/server-fns';

import { useAuth } from '../lib/app-providers';
import { useCreateRsvp, useCancelRsvp } from '../features/events/hooks';

export type RsvpSectionProps = {
  event: EventWithAttendance;
  locale: Locale;
};

/**
 * RSVP slot on the event-detail page ([`docs/p1-007-008-contract.md`](../../../docs/p1-007-008-contract.md)
 * §2). P1-008 implements the real "I'm attending" / capacity / cancel UI.
 */
export const RsvpSection = ({ event, locale: _locale }: RsvpSectionProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createRsvp = useCreateRsvp();
  const cancelRsvp = useCancelRsvp();

  const isGoing = event.viewerRsvp === 'going';
  const isFull =
    event.capacity > 0 && event.remaining !== null && event.remaining <= 0;

  const handleRsvp = () => {
    if (!isAuthenticated) {
      navigate({ to: '/login', search: { redirect: window.location.pathname } });
      return;
    }
    createRsvp.mutate(
      { data: { eventId: event.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['event', event.id] });
        },
        onError: (error) => {
          const code = appErrorCode(error);
          if (code === 'event_full') {
            alert(rsvp_event_full());
          } else if (code === 'already_rsvpd') {
            alert(rsvp_already());
          } else {
            alert(rsvp_error());
          }
        },
      },
    );
  };

  const handleCancel = () => {
    cancelRsvp.mutate(
      { data: { eventId: event.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['event', event.id] });
        },
        onError: () => {
          alert(rsvp_error());
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {isGoing ? (
        <>
          <div className="badge badge-success badge-lg">{rsvp_already()}</div>
          <button
            className="btn btn-outline btn-error btn-sm"
            onClick={handleCancel}
            disabled={cancelRsvp.isPending}
          >
            {rsvp_cancel()}
          </button>
        </>
      ) : isFull ? (
        <button className="btn btn-disabled btn-lg" disabled>
          {rsvp_event_full()}
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
            rsvp_cta()
          )}
        </button>
      )}

      {event.capacity > 0 && event.remaining !== null && (
        <p className="text-sm text-base-content/60">
          {event.remaining > 0
            ? rsvp_remaining({ count: String(event.remaining) })
            : rsvp_no_limit()}
        </p>
      )}
    </div>
  );
};
