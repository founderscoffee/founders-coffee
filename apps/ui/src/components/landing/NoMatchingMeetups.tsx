import {
  clear_city_filters,
  load_more_error,
  loading,
  no_filter_match,
  retry,
  type Locale,
} from '@founders-coffee/i18n';

import type { MatchSearch } from '../../features/events/useLoadUntilMatch';
import { EmptyState } from './EmptyState';

type NoMatchingMeetupsProps = {
  locale: Locale;
  search: Exclude<MatchSearch, 'matched'>;
  onClear: () => void;
  onRetry: () => void;
};

export const NoMatchingMeetups = ({
  locale,
  search,
  onClear,
  onRetry,
}: NoMatchingMeetupsProps) => {
  if (search === 'searching')
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-12 text-body-sm text-neutral"
      >
        <span
          className="loading loading-spinner loading-xs"
          aria-hidden="true"
        />
        {loading({}, { locale })}
      </p>
    );

  if (search === 'failed')
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p role="alert" className="text-body-sm text-error">
          {load_more_error({}, { locale })}
        </p>
        <button type="button" className="btn btn-outline" onClick={onRetry}>
          {retry({}, { locale })}
        </button>
      </div>
    );

  return (
    <EmptyState
      title={no_filter_match({}, { locale })}
      action={
        <button type="button" className="btn btn-outline" onClick={onClear}>
          {clear_city_filters({}, { locale })}
        </button>
      }
    />
  );
};
