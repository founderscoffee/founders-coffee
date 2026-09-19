import {
  load_more,
  next_page,
  showing_count,
  type Locale,
} from '@founders-coffee/i18n';

import type { EventPagination } from '../../features/events/useEventPages';

export const LoadMoreEvents = ({
  locale,
  pagination,
  nextPageHref,
}: {
  locale: Locale;
  pagination: EventPagination;
  nextPageHref?: string;
}) => {
  const { items, total, hasMore, isLoadingMore, loadMore } = pagination;
  if (!hasMore && total === undefined && !nextPageHref) return null;

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
      {nextPageHref && (
        <a
          href={nextPageHref}
          className="focus-reveal rounded px-3 py-2 text-body-sm font-medium text-secondary underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        >
          {next_page({}, { locale })}
        </a>
      )}
    </div>
  );
};
