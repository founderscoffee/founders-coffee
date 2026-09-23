import { useNavigate, useRouter } from '@tanstack/react-router';
import { CalendarOff } from 'lucide-react';
import { useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  retry,
  rsvp_already,
  rsvp_cancel,
  rsvp_cancelled_going,
  rsvp_cancelled_going_help,
  rsvp_confirmed_help,
  rsvp_cta,
  rsvp_error,
  rsvp_help,
  rsvp_saving,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventWithAttendance } from '@founders-coffee/server-fns';

import { PushPermissionPrompt } from '../../features/events/components/PushPermissionPrompt';
import type { UseEventLiveResult } from '../../features/events/useEventLive';
import { useCancelRsvp, useCreateRsvp } from '../../features/events/hooks';
import { useAuth } from '../../lib/app-providers';
import { localizedLogin } from '../../lib/locale-routing';
import { AttendeeLiveActions } from './AttendeeLiveActions';
import { HostEventPanel } from './HostEventPanel';
import { RsvpCancelDialog } from './RsvpCancelDialog';

export type RsvpSectionProps = {
  event: EventWithAttendance;
  hostName: string;
  marketSlug: string;
  locale: Locale;
  isHost: boolean;
  live: UseEventLiveResult | null;
  isWindowOpen: boolean;
};

export const RsvpSection = ({
  event,
  hostName,
  marketSlug,
  locale,
  isHost,
  live,
  isWindowOpen,
}: RsvpSectionProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const createRsvp = useCreateRsvp();
  const cancelRsvp = useCancelRsvp();
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGoing = event.viewerRsvp === 'going';
  const isCancelled = event.status === 'cancelled';

  const messageFor = (cause: unknown) => {
    const code = appErrorCode(cause);
    if (code === 'already_rsvpd') return rsvp_already({}, { locale });
    return rsvp_error({}, { locale });
  };

  const handleRsvp = () => {
    if (!isAuthenticated) {
      void navigate({
        ...localizedLogin(locale),
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

  if (isHost) {
    return (
      <HostEventPanel
        event={event}
        locale={locale}
        marketSlug={marketSlug}
        live={live}
        isWindowOpen={isWindowOpen}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {isCancelled ? (
        isGoing ? (
          <>
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-base-200 px-3 py-1.5 text-body-sm font-medium text-base-content">
              <CalendarOff className="size-4" aria-hidden="true" />
              {rsvp_cancelled_going({}, { locale })}
            </p>
            <p className="text-body-sm text-neutral">
              {rsvp_cancelled_going_help({}, { locale })}
            </p>
          </>
        ) : null
      ) : isGoing ? (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-fit text-neutral"
            onClick={() => setIsCancelOpen(true)}
          >
            {rsvp_cancel({}, { locale })}
          </button>
          <p className="text-body-sm text-neutral">
            {rsvp_confirmed_help({}, { locale })}
          </p>
          {live && isWindowOpen && !live.notAttending && (
            <AttendeeLiveActions
              locale={locale}
              onWalkingIn={live.sendWalkingIn}
              onRunningLate={live.sendRunningLate}
            />
          )}
        </>
      ) : (
        <>
          <p className="max-w-prose text-body-sm text-neutral">
            {rsvp_help({}, { locale })}
          </p>
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
