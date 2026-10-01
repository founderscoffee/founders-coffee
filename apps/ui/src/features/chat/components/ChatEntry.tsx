import { MessagesSquare } from 'lucide-react';
import { useId } from 'react';

import {
  chat_members_only,
  chat_open,
  chat_title,
  chat_unread_count,
  type Locale,
} from '@founders-coffee/i18n';

import { preloadChatConversation } from '../chat-panel-loader';
import { useChatUnreadCounts } from '../hooks';
import { useChatAddress } from '../useChatAddress';

type ChatEntryProps = {
  locale: Locale;
  eventId: string;
};

const BADGE_CAP = 99;

export const ChatEntry = ({ locale, eventId }: ChatEntryProps) => {
  const headingId = useId();
  const { isOpen, open } = useChatAddress();
  const unread = useChatUnreadCounts([eventId], !isOpen).get(eventId) ?? 0;

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
      <button
        type="button"
        aria-haspopup="dialog"
        className="btn btn-secondary btn-xs sm:btn-sm md:btn-md w-fit"
        onClick={open}
        onFocus={preloadChatConversation}
        onPointerEnter={preloadChatConversation}
        onTouchStart={preloadChatConversation}
      >
        <MessagesSquare className="size-4" aria-hidden="true" />
        {chat_open({}, { locale })}
        {unread > 0 ? (
          <>
            {' '}
            <span className="badge badge-primary badge-sm" aria-hidden="true">
              {unread > BADGE_CAP ? `${BADGE_CAP}+` : unread}
            </span>
            <span className="sr-only">
              {chat_unread_count({ count: unread }, { locale })}
            </span>
          </>
        ) : null}
      </button>
    </section>
  );
};
