import { Ban, Ellipsis } from 'lucide-react';

import type { chat } from '@founders-coffee/domain';
import {
  chat_member,
  chat_options_for,
  chat_options_own,
  chat_removed_author,
  chat_removed_host,
  chat_removed_moderator,
  chat_you,
  type Locale,
} from '@founders-coffee/i18n';

import { HostFace } from '../../../components/events/HostFace';
import type { ChatMessageView } from '../api';
import { messageClock } from '../chat-time';
import { ChatText } from './ChatText';

type ChatMessageItemProps = {
  locale: Locale;
  timeZone: string;
  message: ChatMessageView;
  segments: readonly chat.ChatBodySegment[];
  isFirstOfRun: boolean;
  onActions?: () => void;
};

const REMOVALS = {
  author: chat_removed_author,
  host: chat_removed_host,
  moderator: chat_removed_moderator,
} as const;

export const ChatMessageItem = ({
  locale,
  timeZone,
  message,
  segments,
  isFirstOfRun,
  onActions,
}: ChatMessageItemProps) => {
  const side = message.isOwn ? 'chat-end' : 'chat-start';
  const name = message.author?.name ?? chat_member({}, { locale });
  const time = (
    <time dir="ltr" dateTime={message.createdAt.toISOString()}>
      {messageClock(message.createdAt, locale, timeZone)}
    </time>
  );

  return (
    <div className={`group chat ${side}`}>
      {message.isOwn ? null : (
        <div className="chat-image" aria-hidden="true">
          {isFirstOfRun ? (
            <HostFace
              name={name}
              photoAssetId={message.author?.photoAssetId ?? null}
            />
          ) : (
            <span className="block size-8" />
          )}
        </div>
      )}
      <div
        className={
          isFirstOfRun ? 'chat-header items-baseline text-neutral' : 'sr-only'
        }
      >
        {message.isOwn ? (
          <span className="sr-only">{chat_you({}, { locale })}</span>
        ) : (
          <bdi className="font-semibold text-base-content">{name}</bdi>
        )}
        {time}
      </div>
      {message.removal ? (
        <p className="chat-bubble flex items-center gap-1.5 bg-transparent px-0 text-body-sm text-neutral italic">
          <Ban className="size-4 shrink-0" aria-hidden="true" />
          {REMOVALS[message.removal]({}, { locale })}
        </p>
      ) : (
        <div
          className={`chat-bubble ${message.isOwn ? 'chat-bubble-primary' : ''}`}
        >
          <ChatText segments={segments} />
          {onActions ? (
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${message.isOwn ? 'end-full me-1' : 'start-full ms-1'}`}
            >
              <button
                type="button"
                className="tap-target flex size-6 items-center justify-center rounded-full text-neutral opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-base-200 focus-visible:opacity-100 pointer-coarse:opacity-100 motion-safe:transition-opacity"
                aria-label={
                  message.isOwn
                    ? chat_options_own({}, { locale })
                    : chat_options_for({ name }, { locale })
                }
                aria-haspopup="dialog"
                onClick={onActions}
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};
