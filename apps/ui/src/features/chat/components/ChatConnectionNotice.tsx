import {
  chat_offline,
  chat_paused,
  chat_reconnecting,
  chat_resume,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

import type { ChatConnection } from '../useChatSocket';

type ChatConnectionNoticeProps = {
  locale: Locale;
  connection: ChatConnection;
  onResume: () => void;
};

export const ChatConnectionNotice = ({
  locale,
  connection,
  onResume,
}: ChatConnectionNoticeProps) => {
  if (connection === 'reconnecting')
    return (
      <LoadingStatus
        label={chat_reconnecting({}, { locale })}
        className="justify-center border-b border-base-300 px-4 py-2"
      />
    );
  if (connection === 'offline')
    return (
      <StatusMessage variant="warning" className="rounded-none">
        {chat_offline({}, { locale })}
      </StatusMessage>
    );
  if (connection === 'paused')
    return (
      <StatusMessage
        variant="info"
        className="rounded-none"
        action={
          <button
            type="button"
            className="btn btn-ghost btn-xs sm:btn-sm md:btn-md"
            onClick={onResume}
          >
            {chat_resume({}, { locale })}
          </button>
        }
      >
        {chat_paused({}, { locale })}
      </StatusMessage>
    );
  return null;
};
