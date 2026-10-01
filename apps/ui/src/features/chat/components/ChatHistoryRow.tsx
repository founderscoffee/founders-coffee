import {
  chat_older_error,
  chat_older_loading,
  retry,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus } from '@founders-coffee/ui';

import type { ChatHistory } from '../useEventChat';

type ChatHistoryRowProps = {
  locale: Locale;
  history: ChatHistory;
};

export const ChatHistoryRow = ({ locale, history }: ChatHistoryRowProps) => {
  if (history.isLoading)
    return (
      <LoadingStatus
        label={chat_older_loading({}, { locale })}
        className="min-h-10 justify-center"
      />
    );
  if (history.hasFailed)
    return (
      <p className="flex min-h-10 flex-wrap items-center justify-center gap-2 text-body-sm text-neutral">
        {chat_older_error({}, { locale })}
        <button
          type="button"
          className="tap-target link font-semibold"
          onClick={history.load}
        >
          {retry({}, { locale })}
        </button>
      </p>
    );
  return <div className="min-h-10" aria-hidden="true" />;
};
