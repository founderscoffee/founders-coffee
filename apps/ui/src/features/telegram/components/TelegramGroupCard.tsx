import { retry, telegram_load_error, type Locale } from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import { useTelegramGroup } from '../hooks';
import { TelegramHostPanel } from './TelegramHostPanel';
import { TelegramJoinCard } from './TelegramJoinCard';

type TelegramGroupCardProps = {
  eventId: string;
  locale: Locale;
};

export const TelegramGroupCard = ({
  eventId,
  locale,
}: TelegramGroupCardProps) => {
  const group = useTelegramGroup(eventId);

  if (group.isError)
    return (
      <StatusMessage
        variant="error"
        action={
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => void group.refetch()}
          >
            {retry({}, { locale })}
          </button>
        }
      >
        {telegram_load_error({}, { locale })}
      </StatusMessage>
    );

  const view = group.data;
  if (view?.role === 'host')
    return <TelegramHostPanel eventId={eventId} locale={locale} view={view} />;
  if (view?.role === 'attendee')
    return <TelegramJoinCard eventId={eventId} locale={locale} view={view} />;
  return null;
};
