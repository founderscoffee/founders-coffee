import { appErrorCode } from '@founders-coffee/core';
import { Link, useRouter } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { useState } from 'react';

import {
  closeout_link,
  host_cancel_ended_error,
  host_cancel_error,
  host_cancel_event,
  host_edit_open,
  host_event_ended,
  host_hosting_help,
  host_you_are_hosting,
  live_window_closed,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventWithAttendance } from '@founders-coffee/server-fns';

import {
  localizedCloseout,
  localizedEventEdit,
} from '../../lib/locale-routing';
import {
  useCancelEvent,
  useRepeatEventTemplate,
} from '../../features/events/hooks';
import type { UseEventLiveResult } from '../../features/events/useEventLive';
import { CancelEventDialog } from './CancelEventDialog';
import { RepeatHostLink } from './RepeatHostLink';
import { HostLiveActions } from './HostLiveActions';

type HostEventPanelProps = {
  event: EventWithAttendance;
  locale: Locale;
  marketSlug: string;
  live: UseEventLiveResult | null;
  isWindowOpen: boolean;
};

export const HostEventPanel = ({
  event,
  locale,
  marketSlug,
  live,
  isWindowOpen,
}: HostEventPanelProps) => {
  const router = useRouter();
  const cancelEvent = useCancelEvent();
  const hasEnded =
    event.endsAt !== null && new Date(event.endsAt).getTime() <= Date.now();
  const repeat = useRepeatEventTemplate(event.id, hasEnded);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isCancelled = event.status === 'cancelled';

  const confirmCancel = () => {
    setError(null);
    cancelEvent.mutate(
      { data: { eventId: event.id, reason: reason.trim() || undefined } },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          void router.invalidate();
        },
        onError: (cause) => {
          setIsDialogOpen(false);
          setError(
            appErrorCode(cause) === 'event_already_ended'
              ? host_cancel_ended_error({}, { locale })
              : host_cancel_error({}, { locale }),
          );
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="inline-flex w-fit items-center gap-2 rounded-full bg-success-tint px-3 py-1.5 text-body-sm font-medium text-success">
        <Check className="size-4" aria-hidden="true" />
        {host_you_are_hosting({}, { locale })}
      </p>
      <p className="text-body-sm text-neutral">
        {hasEnded
          ? host_event_ended({}, { locale })
          : host_hosting_help({}, { locale })}
      </p>

      {!isCancelled &&
        !hasEnded &&
        (isWindowOpen && live ? (
          <HostLiveActions
            locale={locale}
            host={live.host}
            onArrived={live.sendArrived}
            onTablePin={live.sendTablePin}
          />
        ) : (
          <p className="text-body-sm text-neutral">
            {live_window_closed({}, { locale })}
          </p>
        ))}

      {!isCancelled && hasEnded && (
        <Link
          className="btn btn-outline btn-sm w-fit"
          {...localizedCloseout(locale, event.id)}
        >
          {closeout_link({}, { locale })}
        </Link>
      )}

      {!isCancelled && !hasEnded && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="btn btn-outline btn-sm w-fit"
            {...localizedEventEdit(locale, event.id)}
          >
            {host_edit_open({}, { locale })}
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-fit text-error"
            onClick={() => setIsDialogOpen(true)}
          >
            {host_cancel_event({}, { locale })}
          </button>
        </div>
      )}

      {repeat.data ? (
        <RepeatHostLink
          locale={locale}
          marketSlug={marketSlug}
          cityCode={event.cityCode}
          eventId={event.id}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}

      <CancelEventDialog
        isOpen={isDialogOpen}
        locale={locale}
        reason={reason}
        isPending={cancelEvent.isPending}
        onReasonChange={setReason}
        onKeep={() => setIsDialogOpen(false)}
        onConfirm={confirmCancel}
      />
    </div>
  );
};
