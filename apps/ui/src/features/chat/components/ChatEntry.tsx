import { useId } from 'react';

import {
  chat_members_only,
  chat_title,
  type Locale,
} from '@founders-coffee/i18n';

import { ChatOpenButton } from './ChatOpenButton';

type ChatEntryProps = {
  locale: Locale;
  eventId: string;
};

export const ChatEntry = ({ locale, eventId }: ChatEntryProps) => {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 border-t border-base-300 pt-3"
    >
      <h3 id={headingId} className="eyebrow">
        {chat_title({}, { locale })}
      </h3>
      <p className="text-body-sm text-neutral">
        {chat_members_only({}, { locale })}
      </p>
      <ChatOpenButton locale={locale} eventId={eventId} />
    </section>
  );
};
