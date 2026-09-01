import {
  host_back,
  host_next,
  host_page_sub,
  host_page_title,
  host_publish,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

export const HostWizardHeader = ({
  locale,
  step,
  canProceed,
  publishing,
  onBack,
  onNext,
}: {
  locale: Locale;
  step: number;
  canProceed: boolean;
  publishing: boolean;
  onBack: () => void;
  onNext: () => void;
}) => (
  <header className="host-fade-up mb-8 flex flex-wrap items-center justify-between gap-4">
    <div className="min-w-0 max-w-2xl">
      <h1 className="text-4xl font-bold tracking-tight text-base-content md:text-5xl">
        {host_page_title({}, { locale })}
      </h1>
      <p className="mt-3 text-lg text-base-content/60">
        {host_page_sub({}, { locale })}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {step > 1 && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="h-12 px-5 text-base font-semibold"
        >
          {host_back({}, { locale })}
        </Button>
      )}
      <Button
        variant="primary"
        onClick={onNext}
        disabled={!canProceed || publishing}
        className="h-12 min-w-28 px-6 text-base font-semibold"
      >
        {step === 3 ? host_publish({}, { locale }) : host_next({}, { locale })}
      </Button>
    </div>
  </header>
);
