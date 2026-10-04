import { MessagesSquare } from 'lucide-react';

import {
  chat_open,
  chat_unread_count,
  type Locale,
} from '@founders-coffee/i18n';

import { preloadChatConversation } from '../chat-panel-loader';
import { useChatUnreadCounts } from '../hooks';
import { useChatAddress } from '../useChatAddress';

type ChatOpenButtonProps = {
  locale: Locale;
  eventId: string;
  isFullWidth?: boolean;
};

const BADGE_CAP = 99;

export const ChatOpenButton = ({
  locale,
  eventId,
  isFullWidth = false,
}: ChatOpenButtonProps) => {
  const { isOpen, open } = useChatAddress();
  const unread = useChatUnreadCounts([eventId], !isOpen).get(eventId) ?? 0;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={`btn btn-secondary btn-xs sm:btn-sm md:btn-md relative ${isFullWidth ? 'w-full' : 'w-fit'}`}
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
          <span
            className="badge badge-primary badge-xs absolute -end-2 -top-2"
            aria-hidden="true"
          >
            {unread > BADGE_CAP ? `${BADGE_CAP}+` : unread}
          </span>
          <span className="sr-only">
            {chat_unread_count({ count: unread }, { locale })}
          </span>
        </>
      ) : null}
    </button>
  );
};
