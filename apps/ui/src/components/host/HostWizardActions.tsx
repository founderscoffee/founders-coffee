import {
  host_back,
  host_confirm_publish,
  host_continue_login,
  host_next,
  host_publishing,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

export const HostWizardActions = ({
  locale,
  step,
  isAuthenticated,
  isDisabled,
  isPublishing,
  onBack,
  onNext,
}: {
  locale: Locale;
  step: number;
  isAuthenticated: boolean;
  isDisabled: boolean;
  isPublishing: boolean;
  onBack: () => void;
  onNext: () => void;
}) => {
  const primaryLabel =
    step < 4
      ? host_next({}, { locale })
      : isAuthenticated
        ? host_confirm_publish({}, { locale })
        : host_continue_login({}, { locale });

  return (
    <div className="sticky inset-x-0 bottom-0 z-30 -mx-4 mt-6 border-t border-base-300 bg-base-100 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:p-3 md:shadow-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
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
          className="h-12 min-w-36 px-6 text-base font-semibold"
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
    </div>
  );
};
