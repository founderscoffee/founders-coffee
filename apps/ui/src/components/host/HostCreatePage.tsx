import { CalendarClock, MapPin } from 'lucide-react';

import { host_duration_min, type Locale } from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';

import { useHostMapContext } from '../../features/events/hooks';
import { useHostCreateWizard } from '../../features/events/useHostCreateWizard';
import { DatetimePicker } from './DatetimePicker';
import { HostDetailsStep } from './HostDetailsStep';
import { HostMapPanel } from './HostMapPanel';
import { HostVenueStep } from './HostVenueStep';
import { HostWizardHeader } from './HostWizardHeader';
import { Stepper } from './Stepper';

type HostCreatePageProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  mapboxToken: string;
  turnstileSiteKey: string | null;
  isTurnstileBypassed: boolean;
};

const pillClass =
  'flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-base-300/70 bg-base-100 px-2.5 py-1 shadow-sm';

export const HostCreatePage = ({
  locale,
  market,
  city,
  mapboxToken,
  turnstileSiteKey,
  isTurnstileBypassed,
}: HostCreatePageProps) => {
  const mapContext = useHostMapContext({
    marketCode: market.code,
    cityCode: city.code,
    locale,
  });
  const wizard = useHostCreateWizard({
    locale,
    market,
    city,
    isTurnstileBypassed,
  });

  const cityName = locale === 'ar' ? city.nameAr : city.name;

  const stepperSegments = [
    wizard.venue ? (
      <span key="loc" className={pillClass}>
        <MapPin className="size-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-semibold text-base-content">
          {wizard.venue.name}
        </span>
      </span>
    ) : null,
    wizard.hasValidTimeRange ? (
      <span key="time" className={pillClass}>
        <CalendarClock className="size-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-semibold text-base-content">
          {wizard.whenLabel}
        </span>
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
          {host_duration_min({ n: wizard.durationMinutes }, { locale })}
        </span>
      </span>
    ) : null,
  ];

  return (
    <div className="host-wizard-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 md:pt-12 md:pb-16">
        <HostWizardHeader
          locale={locale}
          step={wizard.step}
          canProceed={wizard.canProceed}
          publishing={wizard.publishing}
          onBack={wizard.prev}
          onNext={wizard.next}
        />

        <div className="mb-8">
          <Stepper current={wizard.step} total={3} segments={stepperSegments} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.85fr_1fr]">
          <div className="order-2 flex flex-col lg:order-1">
            {wizard.step === 2 && (
              <div
                className="mb-3 hidden h-[4.5rem] lg:block"
                aria-hidden="true"
              />
            )}
            <HostMapPanel
              locale={locale}
              accessToken={mapboxToken}
              marketCode={market.code}
              cityCode={city.code}
              venue={wizard.venue}
              viewport={mapContext.data}
              isError={mapContext.isError}
              onRetry={() => void mapContext.refetch()}
              onVenueSelect={wizard.selectVenue}
              onVenueInvalidate={wizard.clearVenue}
            />
          </div>

          <div className="order-1 lg:order-2">
            {wizard.step === 2 ? (
              <div className="host-fade-up" key={wizard.step}>
                <DatetimePicker
                  startsAt={wizard.startsAt}
                  endsAt={wizard.endsAt}
                  onChange={wizard.setSchedule}
                  onError={wizard.setScheduleError}
                  locale={locale}
                  timeZone={market.timezone}
                  timePlacement="top"
                />
                {wizard.publishError && (
                  <p className="mt-2 text-sm text-error" role="alert">
                    {wizard.publishError}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex h-[400px] flex-col rounded-[1.25rem] border border-base-300/60 bg-base-100/70 p-6 shadow-xl shadow-base-content/5 backdrop-blur-md md:p-7">
                <div
                  className="host-fade-up flex min-h-0 flex-1 flex-col"
                  key={wizard.step}
                >
                  <h2 className="text-2xl font-bold tracking-tight text-base-content">
                    {wizard.stepTitle}
                  </h2>
                  {wizard.stepSub && (
                    <p className="mt-1 text-base text-base-content/60">
                      {wizard.stepSub}
                    </p>
                  )}

                  <div className="mt-6 flex min-h-0 flex-1 flex-col">
                    {wizard.step === 1 && (
                      <HostVenueStep
                        locale={locale}
                        cityName={cityName}
                        cityCode={city.code}
                        marketCode={market.code}
                        searchValue={wizard.searchValue}
                        isDisabled={!mapContext.data}
                        onSearchChange={wizard.setSearchValue}
                        onVenueSelect={wizard.selectVenue}
                      />
                    )}

                    {wizard.step === 3 && (
                      <HostDetailsStep
                        locale={locale}
                        timeZone={market.timezone}
                        startsAt={wizard.startsAt}
                        endsAt={wizard.endsAt}
                        title={wizard.title}
                        description={wizard.description}
                        publishError={wizard.publishError}
                        turnstileSiteKey={turnstileSiteKey}
                        isTurnstileBypassed={isTurnstileBypassed}
                        turnstileResetKey={wizard.turnstileResetKey}
                        onTitleChange={wizard.setTitle}
                        onDescriptionChange={wizard.setDescription}
                        onTurnstileToken={wizard.setTurnstileToken}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
