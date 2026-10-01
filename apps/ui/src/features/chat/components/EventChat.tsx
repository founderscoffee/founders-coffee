import { useHydrated } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import { chat_loading, type Locale } from '@founders-coffee/i18n';
import { LoadingStatus } from '@founders-coffee/ui';

import { useAuth } from '../../../lib/app-providers';
import { loadChatConversation } from '../chat-panel-loader';
import { useChatAddress } from '../useChatAddress';
import { ChatDialog } from './ChatDialog';
import { ChatMuteToggle } from './ChatMuteToggle';
import { ChatSignIn } from './ChatSignIn';

const ChatConversation = lazy(() =>
  loadChatConversation().then((module) => ({
    default: module.ChatConversation,
  })),
);

type EventChatProps = {
  locale: Locale;
  eventId: string;
  title: string;
  isMember: boolean;
  isCancelled: boolean;
  endsAt: Date | null;
  timeZone: string;
};

export const EventChat = ({
  locale,
  eventId,
  title,
  isMember,
  isCancelled,
  endsAt,
  timeZone,
}: EventChatProps) => {
  const isHydrated = useHydrated();
  const { isOpen, close } = useChatAddress();
  const { user, isLoading } = useAuth();

  if (!isHydrated || !isOpen || isLoading) return null;
  if (user && !isMember) return null;

  return (
    <ChatDialog
      locale={locale}
      title={title}
      onClose={close}
      actions={
        user ? (
          <ChatMuteToggle
            locale={locale}
            eventId={eventId}
            viewerId={user.id}
          />
        ) : null
      }
    >
      {user ? (
        <Suspense
          fallback={
            <LoadingStatus
              label={chat_loading({}, { locale })}
              className="m-auto"
            />
          }
        >
          <ChatConversation
            key={`${eventId}:${user.id}`}
            locale={locale}
            eventId={eventId}
            viewerId={user.id}
            isCancelled={isCancelled}
            endsAt={endsAt}
            timeZone={timeZone}
          />
        </Suspense>
      ) : (
        <ChatSignIn locale={locale} />
      )}
    </ChatDialog>
  );
};
