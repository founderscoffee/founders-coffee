import { MessagesSquare } from 'lucide-react';
import { useId } from 'react';

import {
  chat_members_only,
  chat_open,
  chat_title,
  type Locale,
} from '@founders-coffee/i18n';

import { preloadChatConversation } from '../chat-panel-loader';
import { useChatAddress } from '../useChatAddress';

type ChatEntryProps = {
  locale: Locale;
};

export const ChatEntry = ({ locale }: ChatEntryProps) => {
  const headingId = useId();
  const { open } = useChatAddress();

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
      </button>
    </section>
  );
};
