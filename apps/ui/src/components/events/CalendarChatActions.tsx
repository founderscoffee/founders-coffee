import type { Locale } from '@founders-coffee/i18n';

import { ChatOpenButton } from '../../features/chat/components/ChatOpenButton';
import { AddToCalendar } from './AddToCalendar';
import { ButtonRow } from './ButtonRow';

type CalendarChatActionsProps = {
  locale: Locale;
  eventId: string;
  startsAt: Date;
  isOver: boolean;
  isCalendarOffered: boolean;
  isChatAvailable: boolean;
};

export const CalendarChatActions = ({
  locale,
  eventId,
  startsAt,
  isOver,
  isCalendarOffered,
  isChatAvailable,
}: CalendarChatActionsProps) => {
  if (isOver)
    return isChatAvailable ? (
      <ChatOpenButton locale={locale} eventId={eventId} />
    ) : null;

  if (!isCalendarOffered && !isChatAvailable) return null;

  return (
    <ButtonRow>
      {isCalendarOffered ? (
        <AddToCalendar eventId={eventId} startsAt={startsAt} locale={locale} />
      ) : null}
      {isChatAvailable ? (
        <ChatOpenButton locale={locale} eventId={eventId} isFullWidth />
      ) : null}
    </ButtonRow>
  );
};
