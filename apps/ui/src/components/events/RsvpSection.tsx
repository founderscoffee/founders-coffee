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
  rsvp_closed_started,
  rsvp_confirmed_help,
  rsvp_cta,
  rsvp_error,
  rsvp_error_closed,
  rsvp_help,
  rsvp_saving,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';
import type { EventWithAttendance } from '@founders-coffee/server-fns';

import { PushPermissionPrompt } from '../../features/events/components/PushPermissionPrompt';
import type { EventPhase } from '../../features/events/live-window';
import type { UseEventLiveResult } from '../../features/events/useEventLive';
import { useCancelRsvp, useCreateRsvp } from '../../features/events/hooks';
import { TelegramGroupCard } from '../../features/telegram/components/TelegramGroupCard';
import { useAuth } from '../../lib/app-providers';
import { localizedLogin } from '../../lib/locale-routing';
import { AddToCalendar } from './AddToCalendar';
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
  phase: EventPhase;
};

type RsvpFailure = { readonly message: string; readonly canRetry: boolean };

export const RsvpSection = ({
  event,
  hostName,
  marketSlug,
  locale,
  isHost,
  live,
  isWindowOpen,
  phase,
}: RsvpSectionProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const createRsvp = useCreateRsvp();
  const cancelRsvp = useCancelRsvp();
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [error, setError] = useState<RsvpFailure | null>(null);

  const isGoing = event.viewerRsvp === 'going';
  const isCancelled = event.status === 'cancelled';
  const isOpen = phase === 'upcoming';

  const failureFor = (cause: unknown): RsvpFailure => {
    const code = appErrorCode(cause);
    if (code === 'rsvp_closed')
      return { message: rsvp_error_closed({}, { locale }), canRetry: false };
    if (code === 'already_rsvpd')
      return { message: rsvp_already({}, { locale }), canRetry: true };
    return { message: rsvp_error({}, { locale }), canRetry: true };
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
        onError: (cause) => setError(failureFor(cause)),
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
          setError(failureFor(cause));
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

  const offer =
    phase === 'started' ? (
      <p className="max-w-prose text-body-sm text-neutral">
        {rsvp_closed_started({}, { locale })}
      </p>
    ) : isOpen ? (
      <>
        <p className="max-w-prose text-body-sm text-neutral">
          {rsvp_help({}, { locale })}
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-xs sm:btn-sm md:btn-md lg:btn-lg w-full sm:w-auto"
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
    ) : null;

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
          {isOpen ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-xs sm:btn-sm md:btn-md lg:btn-lg w-fit text-neutral"
                onClick={() => setIsCancelOpen(true)}
              >
                {rsvp_cancel({}, { locale })}
              </button>
              <p className="text-body-sm text-neutral">
                {rsvp_confirmed_help({}, { locale })}
              </p>
            </>
          ) : null}
          {live && isWindowOpen && !live.notAttending && (
            <AttendeeLiveActions
              locale={locale}
              onWalkingIn={live.sendWalkingIn}
              onRunningLate={live.sendRunningLate}
            />
          )}
          {isOpen ? (
            <AddToCalendar
              eventId={event.id}
              startsAt={event.startsAt}
              locale={locale}
            />
          ) : null}
          <TelegramGroupCard eventId={event.id} locale={locale} />
        </>
      ) : (
        offer
      )}

      {error ? (
        <StatusMessage
          variant="error"
          action={
            error.canRetry ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs sm:btn-sm md:btn-md lg:btn-lg"
                onClick={handleRsvp}
              >
                {retry({}, { locale })}
              </button>
            ) : undefined
          }
        >
          {error.message}
        </StatusMessage>
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
