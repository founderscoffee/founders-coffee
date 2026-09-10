import {
  host_back,
  host_confirm_publish,
  host_continue_login,
  host_next,
  host_publishing,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { TOTAL_STEPS } from '../../features/events/useHostCreateWizard';

export const HostWizardActions = ({
  locale,
  step,
  isAuthenticated,
  isDisabled,
  isPublishing,
  hint,
  onBack,
  onNext,
}: {
  locale: Locale;
  step: number;
  isAuthenticated: boolean;
  isDisabled: boolean;
  isPublishing: boolean;
  hint?: string;
  onBack: () => void;
  onNext: () => void;
}) => {
  const primaryLabel =
    step < TOTAL_STEPS
      ? host_next({}, { locale })
      : isAuthenticated
        ? host_confirm_publish({}, { locale })
        : host_continue_login({}, { locale });

  return (
    <div className="sticky inset-x-0 bottom-0 z-30 mt-auto flex items-center justify-between gap-3 border-t border-base-300 bg-base-100 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:px-7 lg:static lg:shadow-none">
      <div className="flex items-center gap-2">
        {step > 1 && (
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isPublishing}
            className="h-12 px-5 text-base font-semibold"
          >
            {host_back({}, { locale })}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={onNext}
          disabled={isDisabled}
          className="h-12 min-w-28 px-6 text-base font-semibold"
        >
          {isPublishing ? (
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              {host_publishing({}, { locale })}
            </span>
          ) : (
            primaryLabel
          )}
        </Button>
      </div>
      {hint && <span className="text-caption text-neutral">{hint}</span>}
    </div>
  );
};
