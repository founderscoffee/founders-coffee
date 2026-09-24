import {
  clear_city_filters,
  load_more_error,
  loading,
  no_filter_match,
  retry,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

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
      <LoadingStatus
        label={loading({}, { locale })}
        className="justify-center py-12"
      />
    );

  if (search === 'failed')
    return (
      <div className="flex justify-center py-12">
        <StatusMessage
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onRetry}
            >
              {retry({}, { locale })}
            </button>
          }
        >
          {load_more_error({}, { locale })}
        </StatusMessage>
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
