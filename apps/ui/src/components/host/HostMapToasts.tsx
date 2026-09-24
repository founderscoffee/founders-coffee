import {
  host_retry,
  host_venue_resolving,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

type HostMapToastsProps = {
  locale: Locale;
  isResolving: boolean;
  error: string | null;
  onRetry?: () => void;
};

export const HostMapToasts = ({
  locale,
  isResolving,
  error,
  onRetry,
}: HostMapToastsProps): React.ReactElement | null => {
  if (!isResolving && !error) return null;

  return (
    <div className="toast toast-bottom absolute end-auto start-auto bottom-8 right-4 left-auto z-30 max-w-[calc(100%-2rem)] whitespace-normal">
      {isResolving && (
        <LoadingStatus
          label={host_venue_resolving({}, { locale })}
          className="rounded-box border border-base-300 bg-base-100 px-4 py-3 text-base-content shadow-lg"
        />
      )}
      {error && (
        <StatusMessage
          variant="error"
          className="w-auto shadow-lg"
          action={
            onRetry && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onRetry}
              >
                {host_retry({}, { locale })}
              </button>
            )
          }
        >
          {error}
        </StatusMessage>
      )}
    </div>
  );
};
