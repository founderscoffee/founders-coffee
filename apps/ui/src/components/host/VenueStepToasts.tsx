import { RefreshCw } from 'lucide-react';

import { retry, toast_dismiss, type Locale } from '@founders-coffee/i18n';
import { Toast } from '@founders-coffee/ui';

export type VenueStepNotice = {
  readonly id: string;
  readonly message: string;
  readonly onRetry?: () => void;
  readonly onDismiss: () => void;
};

type VenueStepToastsProps = {
  locale: Locale;
  notices: readonly VenueStepNotice[];
};

export const VenueStepToasts = ({ locale, notices }: VenueStepToastsProps) =>
  notices.length === 0 ? null : (
    <div className="fixed inset-x-0 top-2 z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4 lg:start-auto lg:end-4 lg:top-20 lg:mx-0 lg:px-0">
      {notices.map((notice) => (
        <Toast
          key={notice.id}
          message={notice.message}
          variant="error"
          dismissLabel={toast_dismiss({}, { locale })}
          onDismiss={notice.onDismiss}
        >
          {notice.onRetry ? (
            <button
              type="button"
              className="btn btn-xs sm:btn-sm md:btn-md lg:btn-lg xl:btn-xl shrink-0"
              onClick={notice.onRetry}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {retry({}, { locale })}
            </button>
          ) : null}
        </Toast>
      ))}
    </div>
  );
