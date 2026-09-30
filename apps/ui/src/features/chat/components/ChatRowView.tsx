import { chat_unread, type Locale } from '@founders-coffee/i18n';

import type { ChatRow } from '../chat-rows';
import { dayLabel } from '../chat-time';
import type { ChatHistory } from '../useEventChat';
import { ChatHistoryRow } from './ChatHistoryRow';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatPendingItem } from './ChatPendingItem';
import { ChatSystemLine } from './ChatSystemLine';

type ChatRowViewProps = {
  locale: Locale;
  timeZone: string;
  row: ChatRow;
  history: ChatHistory;
  canRetry: boolean;
  onRetry: (clientId: string) => void;
};

export const ChatRowView = ({
  locale,
  timeZone,
  row,
  history,
  canRetry,
  onRetry,
}: ChatRowViewProps) => {
  switch (row.kind) {
    case 'history':
      return <ChatHistoryRow locale={locale} history={history} />;
    case 'day':
      return (
        <p className="py-2 text-center">
          <span className="inline-block rounded-full bg-base-200 px-3 py-1 text-caption font-medium text-neutral">
            {dayLabel(row.day, row.date, locale, timeZone)}
          </span>
        </p>
      );
    case 'unread':
      return (
        <p className="flex items-center gap-3 py-2 text-caption font-semibold text-secondary">
          <span className="h-px flex-1 bg-secondary" aria-hidden="true" />
          {chat_unread({}, { locale })}
          <span className="h-px flex-1 bg-secondary" aria-hidden="true" />
        </p>
      );
    case 'message':
      return row.message.kind === 'system' ? (
        <ChatSystemLine
          locale={locale}
          timeZone={timeZone}
          notice={row.notice}
        />
      ) : (
        <ChatMessageItem
          locale={locale}
          timeZone={timeZone}
          message={row.message}
          segments={row.segments}
          isFirstOfRun={row.isFirstOfRun}
        />
      );
    case 'pending':
      return (
        <ChatPendingItem
          locale={locale}
          pending={row.pending}
          segments={row.segments}
          canRetry={canRetry}
          onRetry={onRetry}
        />
      );
  }
};
