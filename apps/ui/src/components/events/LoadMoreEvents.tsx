import {
  load_more,
  load_more_error,
  retry,
  showing_count,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import type { EventPagination } from '../../features/events/useEventPages';

export const LoadMoreEvents = ({
  locale,
  pagination,
}: {
  locale: Locale;
  pagination: EventPagination;
}) => {
  const {
    items,
    total,
    hasMore,
    isLoadingMore,
    isIdle,
    hasLoadMoreError,
    loadMore,
  } = pagination;
  if (!hasMore && total === undefined) return null;
  const hasFailed = hasLoadMoreError && isIdle;

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {total !== undefined && (
        <p className="text-body-sm text-neutral" aria-live="polite">
          {showing_count({ shown: items.length, total }, { locale })}
        </p>
      )}
      {hasFailed && (
        <StatusMessage variant="error">
          {load_more_error({}, { locale })}
        </StatusMessage>
      )}
      {hasMore && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={loadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? (
            <span
              className="loading loading-spinner loading-xs"
              aria-hidden="true"
            />
          ) : null}
          {hasFailed ? retry({}, { locale }) : load_more({}, { locale })}
        </button>
      )}
    </div>
  );
};
