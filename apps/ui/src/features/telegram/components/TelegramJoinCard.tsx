import { useId, useState } from 'react';

import {
  telegram_group_title,
  telegram_join_get_link,
  telegram_join_help,
  telegram_join_intro,
  telegram_join_joined,
  telegram_join_open,
  telegram_join_open_group,
  telegram_join_privacy,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import type { TelegramGroupView } from '../api';
import { telegramErrorFor } from '../errors';
import { useRequestTelegramInvite } from '../hooks';
import { useFocusWhenShown } from '../useFocusWhenShown';

type TelegramJoinCardProps = {
  eventId: string;
  locale: Locale;
  view: Extract<TelegramGroupView, { role: 'attendee' }>;
};

export const TelegramJoinCard = ({
  eventId,
  locale,
  view,
}: TelegramJoinCardProps) => {
  const headingId = useId();
  const invite = useRequestTelegramInvite(eventId);
  const [error, setError] = useState<string | null>(null);
  const { container, focusWhenShown } = useFocusWhenShown<HTMLElement>();

  const askForLink = () => {
    setError(null);
    invite.mutate(undefined, {
      onSuccess: () => focusWhenShown('join'),
      onError: (cause) => setError(telegramErrorFor(cause, locale)),
    });
  };

  return (
    <section
      ref={container}
      aria-labelledby={headingId}
      className="flex flex-col gap-2 border-t border-base-300 pt-3"
    >
      <h3 id={headingId} className="eyebrow">
        {telegram_group_title({}, { locale })}
      </h3>

      {view.hasJoined && view.inviteLink ? (
        <>
          <p className="text-body-sm font-medium">
            {telegram_join_joined({}, { locale })}
          </p>
          <a
            className="btn btn-outline btn-sm w-fit"
            href={view.inviteLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {telegram_join_open_group({}, { locale })}
          </a>
        </>
      ) : (
        <>
          <p className="text-body-sm text-neutral">
            {telegram_join_intro({}, { locale })}
          </p>
          <p className="text-body-sm text-neutral">
            {telegram_join_privacy({}, { locale })}
          </p>
          {view.inviteLink ? (
            <>
              <a
                className="btn btn-secondary btn-sm w-fit"
                data-focus="join"
                href={view.inviteLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {telegram_join_open({}, { locale })}
              </a>
              <p className="text-body-sm text-neutral">
                {telegram_join_help({}, { locale })}
              </p>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-sm w-fit"
              onClick={askForLink}
              disabled={invite.isPending}
            >
              {telegram_join_get_link({}, { locale })}
            </button>
          )}
        </>
      )}

      {error ? <StatusMessage variant="error">{error}</StatusMessage> : null}
    </section>
  );
};
