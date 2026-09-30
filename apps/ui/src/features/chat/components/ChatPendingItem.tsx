import type { chat } from '@founders-coffee/domain';
import {
  chat_not_sent,
  retry,
  sending,
  type Locale,
} from '@founders-coffee/i18n';

import type { PendingMessage } from '../chat-items';
import { ChatText } from './ChatText';

type ChatPendingItemProps = {
  locale: Locale;
  pending: PendingMessage;
  segments: readonly chat.ChatBodySegment[];
  canRetry: boolean;
  onRetry: (clientId: string) => void;
};

export const ChatPendingItem = ({
  locale,
  pending,
  segments,
  canRetry,
  onRetry,
}: ChatPendingItemProps) => (
  <div className="chat chat-end">
    <div
      className={`chat-bubble chat-bubble-primary ${pending.status === 'sending' ? 'opacity-70' : ''}`}
    >
      <ChatText segments={segments} />
    </div>
    <div className="chat-footer items-baseline gap-2 text-neutral">
      {pending.status === 'sending' ? (
        sending({}, { locale })
      ) : (
        <>
          <span className="font-semibold text-error">
            {chat_not_sent({}, { locale })}
          </span>
          {canRetry ? (
            <button
              type="button"
              className="tap-target link font-semibold"
              onClick={() => onRetry(pending.clientId)}
            >
              {retry({}, { locale })}
            </button>
          ) : null}
        </>
      )}
    </div>
  </div>
);
