import { useEffect } from 'react';

import {
  host_retry,
  host_venue_resolving,
  type Locale,
} from '@founders-coffee/i18n';

const TOAST_DURATION_MS = 5_000;

type HostMapToastsProps = {
  locale: Locale;
  isResolving: boolean;
  error: string | null;
  onErrorExpire: () => void;
  onRetry?: () => void;
};

export const HostMapToasts = ({
  locale,
  isResolving,
  error,
  onErrorExpire,
  onRetry,
}: HostMapToastsProps): React.ReactElement | null => {
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onErrorExpire, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [error]);

  if (!isResolving && !error) return null;

  return (
    <div className="toast toast-bottom absolute end-auto start-auto bottom-8 right-4 left-auto z-30 max-w-[calc(100%-2rem)] whitespace-normal">
      {isResolving && (
        <div
          className="alert w-auto border border-base-300 bg-base-100 shadow-lg"
          role="status"
        >
          <span className="loading loading-spinner loading-xs shrink-0" />
          <span className="text-body-sm text-base-content">
            {host_venue_resolving({}, { locale })}
          </span>
        </div>
      )}
      {error && (
        <div
          className="alert w-auto border border-error bg-base-100 shadow-lg"
          role="alert"
        >
          <span className="text-body-sm text-error">{error}</span>
          {onRetry && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onRetry}
            >
              {host_retry({}, { locale })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
