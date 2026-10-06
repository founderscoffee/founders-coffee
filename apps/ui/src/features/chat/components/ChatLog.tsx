import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  chat_jump_latest,
  chat_log_label,
  type Locale,
} from '@founders-coffee/i18n';

import type { ChatMessageView } from '../api';
import type { ChatListItem } from '../chat-items';
import {
  chatRows,
  estimatedOffsetOf,
  estimatedRowHeight,
  openingRow,
  prefersReducedMotion,
} from '../chat-rows';
import type { ChatHistory } from '../useEventChat';
import { ChatEmpty } from './ChatEmpty';
import { ChatRowView } from './ChatRowView';

const END_THRESHOLD_PX = 48;
const EDGE_PADDING_PX = 8;

type ChatLogProps = {
  locale: Locale;
  timeZone: string;
  items: readonly ChatListItem[];
  history: ChatHistory;
  isOpen: boolean;
  canRetry: boolean;
  isHost: boolean;
  onRetry: (clientId: string) => void;
  onMessageActions: (message: ChatMessageView) => void;
  onAtEndChange: (isAtEnd: boolean) => void;
};

export const ChatLog = ({
  locale,
  timeZone,
  items,
  history,
  isOpen,
  canRetry,
  isHost,
  onRetry,
  onMessageActions,
  onAtEndChange,
}: ChatLogProps) => {
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => chatRows(items, history.hasMore),
    [items, history.hasMore],
  );
  const [isReducedMotion] = useState(prefersReducedMotion);
  const [opening] = useState(() => openingRow(rows));
  const [isAtEnd, setIsAtEnd] = useState(true);
  const hasOpenedRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: (index) => estimatedRowHeight(rows[index]),
    getItemKey: (index) => rows[index]?.key ?? index,
    initialOffset: () =>
      estimatedOffsetOf(
        rows,
        opening.align === 'end' ? rows.length : opening.index,
      ),
    paddingStart: EDGE_PADDING_PX,
    paddingEnd: EDGE_PADDING_PX,
    overscan: 6,
    anchorTo: 'end',
    followOnAppend: isReducedMotion ? true : 'smooth',
    scrollEndThreshold: END_THRESHOLD_PX,
  });

  const syncEnd = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    setIsAtEnd(
      element.scrollHeight - element.scrollTop - element.clientHeight <=
        END_THRESHOLD_PX,
    );
  }, []);

  useLayoutEffect(() => {
    if (hasOpenedRef.current || rows.length === 0) return;
    hasOpenedRef.current = true;
    virtualizer.scrollToIndex(Math.max(opening.index, 0), {
      align: opening.align,
    });
  }, [rows.length, opening, virtualizer]);

  const lastRow = rows.at(-1);
  const sendingKey =
    lastRow?.kind === 'pending' && lastRow.pending.status === 'sending'
      ? lastRow.key
      : null;
  useEffect(() => {
    if (sendingKey) virtualizer.scrollToEnd();
  }, [sendingKey, virtualizer]);

  const totalSize = virtualizer.getTotalSize();
  useEffect(syncEnd, [syncEnd, totalSize]);
  useEffect(() => onAtEndChange(isAtEnd), [isAtEnd, onAtEndChange]);

  const virtualRows = virtualizer.getVirtualItems();
  const firstIndex = virtualRows[0]?.index;
  const { hasMore, isLoading, hasFailed, load } = history;
  useEffect(() => {
    if (firstIndex === 0 && hasMore && !isLoading && !hasFailed) load();
  }, [firstIndex, hasMore, isLoading, hasFailed, load]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        onScroll={syncEnd}
      >
        {rows.length === 0 ? (
          <ChatEmpty locale={locale} isOpen={isOpen} />
        ) : null}
        <div
          role="log"
          aria-live="polite"
          aria-label={chat_log_label({}, { locale })}
          className="relative w-full"
          style={{ height: totalSize }}
        >
          {virtualRows.map((virtual) => {
            const row = rows[virtual.index];
            return row ? (
              <div
                key={virtual.key}
                ref={virtualizer.measureElement}
                data-index={virtual.index}
                className="absolute inset-x-0 top-0 px-3"
                style={{ transform: `translateY(${virtual.start}px)` }}
              >
                <ChatRowView
                  locale={locale}
                  timeZone={timeZone}
                  row={row}
                  history={history}
                  canRetry={canRetry}
                  isHost={isHost}
                  onRetry={onRetry}
                  onMessageActions={onMessageActions}
                />
              </div>
            ) : null;
          })}
        </div>
      </div>
      {isAtEnd || rows.length === 0 ? null : (
        <div className="absolute inset-x-0 bottom-3 mx-auto flex w-fit">
          <button
            type="button"
            className="btn btn-neutral btn-xs sm:btn-sm md:btn-md rounded-full shadow-[var(--shadow-2)]"
            onClick={() =>
              virtualizer.scrollToEnd({
                behavior: isReducedMotion ? 'auto' : 'smooth',
              })
            }
          >
            <ArrowDown className="size-4" aria-hidden="true" />
            {chat_jump_latest({}, { locale })}
          </button>
        </div>
      )}
    </div>
  );
};
