import { useNavigate, useRouter } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  retry,
  rsvp_already,
  rsvp_cancel,
  rsvp_confirmed_help,
  rsvp_cta,
  rsvp_error,
  rsvp_event_full,
  rsvp_help,
  rsvp_no_limit,
  rsvp_remaining,
  rsvp_saving,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventWithAttendance } from '@founders-coffee/server-fns';

import { PushPermissionPrompt } from '../../features/events/components/PushPermissionPrompt';
import { useCancelRsvp, useCreateRsvp } from '../../features/events/hooks';
import { useAuth } from '../../lib/app-providers';
import { RsvpCancelDialog } from './RsvpCancelDialog';

export type RsvpSectionProps = {
  event: EventWithAttendance;
  hostName: string;
  locale: Locale;
};

export const RsvpSection = ({ event, hostName, locale }: RsvpSectionProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const createRsvp = useCreateRsvp();
  const cancelRsvp = useCancelRsvp();
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGoing = event.viewerRsvp === 'going';
  const isFull =
    event.capacity > 0 && event.remaining !== null && event.remaining <= 0;

  const messageFor = (cause: unknown) => {
    const code = appErrorCode(cause);
    if (code === 'event_full') return rsvp_event_full({}, { locale });
    if (code === 'already_rsvpd') return rsvp_already({}, { locale });
    return rsvp_error({}, { locale });
  };

  const handleRsvp = () => {
    if (!isAuthenticated) {
      void navigate({
        to: '/login',
        search: { redirect: window.location.pathname },
      });
      return;
    }
    setError(null);
    createRsvp.mutate(
      { data: { eventId: event.id } },
      {
        onSuccess: () => {
          void router.invalidate();
          setIsPushPromptOpen(true);
        },
        onError: (cause) => setError(messageFor(cause)),
      },
    );
  };

  const handleCancel = () => {
    setError(null);
    cancelRsvp.mutate(
      { data: { eventId: event.id } },
      {
        onSuccess: () => {
          setIsCancelOpen(false);
          void router.invalidate();
        },
        onError: (cause) => {
          setIsCancelOpen(false);
          setError(messageFor(cause));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {isGoing ? (
        <>
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-success-tint px-3 py-1.5 text-body-sm font-medium text-success">
            <Check className="size-4" aria-hidden="true" />
            {rsvp_already({}, { locale })}
          </p>
          <p className="text-body-sm text-neutral">
            {rsvp_confirmed_help({}, { locale })}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-fit text-neutral"
            onClick={() => setIsCancelOpen(true)}
          >
            {rsvp_cancel({}, { locale })}
          </button>
        </>
      ) : isFull ? (
        <button type="button" className="btn btn-lg" disabled>
          {rsvp_event_full({}, { locale })}
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-lg w-full sm:w-auto"
            onClick={handleRsvp}
            disabled={createRsvp.isPending}
          >
            {createRsvp.isPending ? (
              <>
                <span
                  className="loading loading-spinner loading-xs"
                  aria-hidden="true"
                />
                {rsvp_saving({}, { locale })}
              </>
            ) : (
              rsvp_cta({}, { locale })
            )}
          </button>
          <p className="max-w-prose text-body-sm text-neutral">
            {rsvp_help({}, { locale })}
          </p>
        </>
      )}

      {error ? (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-2 text-body-sm text-error"
        >
          {error}
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleRsvp}
          >
            {retry({}, { locale })}
          </button>
        </p>
      ) : null}

      {event.capacity > 0 && event.remaining !== null ? (
        <p className="text-body-sm text-neutral">
          {event.remaining > 0
            ? rsvp_remaining({ count: String(event.remaining) }, { locale })
            : rsvp_event_full({}, { locale })}
        </p>
      ) : null}
      {event.capacity === 0 ? (
        <p className="text-body-sm text-neutral">
          {rsvp_no_limit({}, { locale })}
        </p>
      ) : null}

      <RsvpCancelDialog
        isOpen={isCancelOpen}
        hostName={hostName}
        locale={locale}
        isPending={cancelRsvp.isPending}
        onKeep={() => setIsCancelOpen(false)}
        onConfirm={handleCancel}
      />

      {isPushPromptOpen ? (
        <PushPermissionPrompt
          onAccept={async () => {
            setIsPushPromptOpen(false);
            const { requestPushPermission } =
              await import('../../features/push/client');
            await requestPushPermission(event.marketCode);
          }}
          locale={locale}
          onDecline={() => setIsPushPromptOpen(false)}
        />
      ) : null}
    </div>
  );
};
