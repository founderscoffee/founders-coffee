import { useState } from 'react';

import {
  chat_load_error,
  chat_loading,
  chat_members_only,
  chat_unavailable,
  retry,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

import { useChatReadMarker } from '../useChatReadMarker';
import { useEventChat, type ReadyChat } from '../useEventChat';
import { ChatComposer } from './ChatComposer';
import { ChatConnectionNotice } from './ChatConnectionNotice';
import { ChatLog } from './ChatLog';
import { ChatSignIn } from './ChatSignIn';
import { ChatStateLine } from './ChatStateLine';

type ChatConversationProps = {
  locale: Locale;
  eventId: string;
  viewerId: string;
  isCancelled: boolean;
  endsAt: Date | null;
  timeZone: string;
};

const ChatThread = ({
  chat,
  locale,
  eventId,
  viewerId,
  isCancelled,
  endsAt,
  timeZone,
}: ChatConversationProps & { chat: ReadyChat }) => {
  const [isAtEnd, setIsAtEnd] = useState(true);
  useChatReadMarker({
    eventId,
    viewerId,
    readUpTo: chat.meta.lastReadAt,
    newestAt: chat.newestAt,
    isAtEnd,
  });

  return (
    <>
      <ChatStateLine
        locale={locale}
        timeZone={timeZone}
        isOpen={chat.isOpen}
        isCancelled={isCancelled}
        readOnlyAt={chat.meta.readOnlyAt}
        endsAt={endsAt}
      />
      {chat.isOpen ? (
        <ChatConnectionNotice
          locale={locale}
          connection={chat.connection}
          onResume={chat.resume}
        />
      ) : null}
      <ChatLog
        locale={locale}
        timeZone={timeZone}
        items={chat.items}
        history={chat.history}
        isOpen={chat.isOpen}
        canRetry={chat.isOpen && !chat.isSending}
        onRetry={chat.retrySend}
        onAtEndChange={setIsAtEnd}
      />
      {chat.isOpen ? (
        <ChatComposer
          locale={locale}
          isSending={chat.isSending}
          onSend={chat.send}
        />
      ) : null}
    </>
  );
};

const Notice = ({ children }: { children: string }) => (
  <p className="m-auto max-w-prose p-6 text-center text-body text-neutral">
    {children}
  </p>
);

export const ChatConversation = (props: ChatConversationProps) => {
  const { locale } = props;
  const chat = useEventChat({
    eventId: props.eventId,
    viewerId: props.viewerId,
    timeZone: props.timeZone,
  });

  switch (chat.status) {
    case 'loading':
      return (
        <LoadingStatus
          label={chat_loading({}, { locale })}
          className="m-auto"
        />
      );
    case 'error':
      return (
        <div className="m-auto p-4">
          <StatusMessage
            variant="error"
            action={
              <button
                type="button"
                className="btn btn-ghost btn-xs sm:btn-sm md:btn-md"
                onClick={chat.retry}
              >
                {retry({}, { locale })}
              </button>
            }
          >
            {chat_load_error({}, { locale })}
          </StatusMessage>
        </div>
      );
    case 'unavailable':
      return <Notice>{chat_unavailable({}, { locale })}</Notice>;
    case 'revoked':
      return <Notice>{chat_members_only({}, { locale })}</Notice>;
    case 'signed_out':
      return <ChatSignIn locale={locale} />;
    case 'ready':
      return <ChatThread {...props} chat={chat} />;
  }
};
