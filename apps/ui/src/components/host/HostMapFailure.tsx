import { RefreshCw } from 'lucide-react';

import { host_map_error, retry, type Locale } from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

type HostMapFailureProps = {
  locale: Locale;
  onRetry: () => void;
};

export const HostMapFailure = ({ locale, onRetry }: HostMapFailureProps) => (
  <div className="flex h-full min-h-64 w-full items-center justify-center bg-base-200 p-6">
    <StatusMessage
      variant="error"
      action={
        <button
          type="button"
          className="btn btn-outline btn-xs sm:btn-sm md:btn-md"
          onClick={onRetry}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {retry({}, { locale })}
        </button>
      }
    >
      {host_map_error({}, { locale })}
    </StatusMessage>
  </div>
);
