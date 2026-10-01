import { Bell, BellOff } from 'lucide-react';

import {
  chat_mute,
  chat_mute_error,
  toast_dismiss,
  type Locale,
} from '@founders-coffee/i18n';
import { Toast, useToast } from '@founders-coffee/ui';

import { metaOf } from '../chat-cache';
import { useChatPages, useSetChatMuted } from '../hooks';

type ChatMuteToggleProps = {
  locale: Locale;
  eventId: string;
  viewerId: string;
};

export const ChatMuteToggle = ({
  locale,
  eventId,
  viewerId,
}: ChatMuteToggleProps) => {
  const pages = useChatPages(eventId, viewerId, false);
  const mute = useSetChatMuted(eventId, viewerId);
  const feedback = useToast();
  const meta = metaOf(pages.data);
  if (!meta) return null;
  const Icon = meta.muted ? BellOff : Bell;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-circle btn-xs sm:btn-sm md:btn-md"
        aria-label={chat_mute({}, { locale })}
        aria-pressed={meta.muted}
        disabled={mute.isPending}
        onClick={() =>
          mute.mutate(!meta.muted, {
            onError: () =>
              feedback.show(chat_mute_error({}, { locale }), 'error'),
          })
        }
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
      {feedback.notification ? (
        <div className="absolute inset-x-3 top-full z-10 mt-2">
          <Toast
            key={feedback.notification.id}
            message={feedback.notification.message}
            variant={feedback.notification.variant}
            dismissLabel={toast_dismiss({}, { locale })}
            onDismiss={feedback.clear}
          />
        </div>
      ) : null}
    </>
  );
};
