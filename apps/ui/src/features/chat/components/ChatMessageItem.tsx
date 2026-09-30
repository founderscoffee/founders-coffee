import { Ban } from 'lucide-react';

import type { chat } from '@founders-coffee/domain';
import {
  chat_member,
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
}: ChatMessageItemProps) => {
  const side = message.isOwn ? 'chat-end' : 'chat-start';
  const name = message.author?.name ?? chat_member({}, { locale });
  const time = (
    <time dir="ltr" dateTime={message.createdAt.toISOString()}>
      {messageClock(message.createdAt, locale, timeZone)}
    </time>
  );

  return (
    <div className={`chat ${side}`}>
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
        </div>
      )}
    </div>
  );
};
