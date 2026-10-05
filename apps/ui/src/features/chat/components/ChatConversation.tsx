import { useState } from 'react';

import {
  chat_loading,
  chat_members_only,
  chat_report_already,
  chat_report_sent,
  chat_unavailable,
  toast_dismiss,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, Toast, useToast } from '@founders-coffee/ui';

import type { ChatMessageView } from '../api';
import { useChatReadMarker } from '../useChatReadMarker';
import { useEventChat, type ReadyChat } from '../useEventChat';
import { ChatComposer } from './ChatComposer';
import { ChatConnectionNotice } from './ChatConnectionNotice';
import { ChatLoadFailure } from './ChatLoadFailure';
import { ChatLog } from './ChatLog';
import { ChatMessageDialog } from './ChatMessageDialog';
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
  const [target, setTarget] = useState<ChatMessageView | null>(null);
  const feedback = useToast();
  useChatReadMarker({
    eventId,
    viewerId,
    readUpTo: chat.meta.lastReadAt,
    newestAt: chat.newestAt,
    isAtEnd,
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {feedback.notification ? (
        <div className="absolute inset-x-3 top-2 z-10">
          <Toast
            key={feedback.notification.id}
            message={feedback.notification.message}
            variant={feedback.notification.variant}
            dismissLabel={toast_dismiss({}, { locale })}
            onDismiss={feedback.clear}
          />
        </div>
      ) : null}
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
        isHost={chat.meta.isHost}
        onRetry={chat.retrySend}
        onMessageActions={setTarget}
        onAtEndChange={setIsAtEnd}
      />
      {chat.isOpen ? (
        <ChatComposer
          locale={locale}
          isSending={chat.isSending}
          onSend={chat.send}
        />
      ) : null}
      {target ? (
        <ChatMessageDialog
          key={target.id}
          locale={locale}
          eventId={eventId}
          viewerId={viewerId}
          isHost={chat.meta.isHost}
          message={target}
          onClose={() => setTarget(null)}
          onReported={(status) =>
            feedback.show(
              status === 'reported'
                ? chat_report_sent({}, { locale })
                : chat_report_already({}, { locale }),
              'success',
            )
          }
        />
      ) : null}
    </div>
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
      return <ChatLoadFailure locale={locale} onRetry={chat.retry} />;
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
