import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import {
  back_home,
  host_back,
  host_confirm_publish,
  host_continue_login,
  host_next,
  host_publishing,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { TOTAL_STEPS } from '../../features/events/useHostCreateWizard';
import { localizedHome } from '../../lib/locale-routing';

export const HostWizardActions = ({
  locale,
  marketSlug,
  step,
  isAuthenticated,
  isDisabled,
  isPublishing,
  onBack,
  onNext,
}: {
  locale: Locale;
  marketSlug: string;
  step: number;
  isAuthenticated: boolean;
  isDisabled: boolean;
  isPublishing: boolean;
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
    <div className="sticky inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur lg:static lg:col-start-1 lg:row-start-3 lg:border-e lg:px-7 lg:py-5 lg:shadow-none">
      <div className="flex items-center gap-2">
        {step > 1 ? (
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isPublishing}
            className="font-semibold"
          >
            {host_back({}, { locale })}
          </Button>
        ) : (
          <Link
            {...localizedHome(locale, marketSlug)}
            aria-label={back_home({}, { locale })}
            className="btn btn-ghost btn-square btn-xs sm:btn-sm md:btn-md lg:btn-lg xl:btn-xl shrink-0 lg:hidden"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Link>
        )}
        <Button
          variant="primary"
          onClick={onNext}
          disabled={isDisabled}
          className="ms-auto min-w-28 font-semibold"
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
