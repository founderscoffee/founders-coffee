import { RefreshCw } from 'lucide-react';

import {
  host_venue_resolving,
  retry,
  toast_dismiss,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, Toast } from '@founders-coffee/ui';

type HostMapToastsProps = {
  locale: Locale;
  isResolving: boolean;
  error: string | null;
  onRetry?: () => void;
  onDismiss: () => void;
};

export const HostMapToasts = ({
  locale,
  isResolving,
  error,
  onRetry,
  onDismiss,
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
        <Toast
          message={error}
          variant="error"
          dismissLabel={toast_dismiss({}, { locale })}
          onDismiss={onDismiss}
        >
          {onRetry && (
            <button
              type="button"
              className="btn btn-xs sm:btn-sm md:btn-md lg:btn-lg xl:btn-xl shrink-0"
              onClick={onRetry}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {retry({}, { locale })}
            </button>
          )}
        </Toast>
      )}
    </div>
  );
};
