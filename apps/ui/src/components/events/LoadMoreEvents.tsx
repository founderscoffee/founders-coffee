import { load_more, showing_count, type Locale } from '@founders-coffee/i18n';

import type { EventPagination } from '../../features/events/useEventPages';

export const LoadMoreEvents = ({
  locale,
  pagination,
}: {
  locale: Locale;
  pagination: EventPagination;
}) => {
  const { items, total, hasMore, isLoadingMore, loadMore } = pagination;
  if (!hasMore && total === undefined) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {total !== undefined && (
        <p className="text-body-sm text-neutral" aria-live="polite">
          {showing_count({ shown: items.length, total }, { locale })}
        </p>
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
          {load_more({}, { locale })}
        </button>
      )}
    </div>
  );
};
