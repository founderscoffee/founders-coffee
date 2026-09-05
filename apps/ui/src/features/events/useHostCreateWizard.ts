import { useEffect, useState } from 'react';

import type { Market } from '@founders-coffee/db';
import { events, type geo } from '@founders-coffee/domain';
import {
  host_time_invalid,
  host_time_nonexistent,
  host_time_zone_error,
  type Locale,
  type ZonedDateTimeError,
} from '@founders-coffee/i18n';

import { hostCreateStepCopy, hostCreateViewCopy } from './host-create-copy';
import { hostScheduleSummary } from './host-create-schedule';
import {
  readHostCreateDraft,
  writeHostCreateDraft,
  type HostCreateDraft,
} from './host-create-draft';
import {
  firstInvalidField,
  focusInvalidField,
  restoredDraftStep,
  validateDetailsStep,
  validateScheduleStep,
  validateVenueStep,
  type HostCreateFieldErrors,
} from './host-create-validation';
import type { VenueSelection } from './types';
import { useHostPublish } from './useHostPublish';

export const useHostCreateWizard = ({
  locale,
  market,
  city,
  isAuthenticated,
  isAuthLoading,
}: {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}) => {
  const [step, setStep] = useState(1);
  const [venue, setVenue] = useState<VenueSelection | null>(null);
  const [venueName, setVenueName] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [language, setLanguage] = useState<Locale>(locale);
  const [category, setCategory] =
    useState<events.EventCategory>('coffee-meetup');
  const [fieldErrors, setFieldErrors] = useState<HostCreateFieldErrors>({});
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);

  const draft: HostCreateDraft = {
    step,
    venue,
    venueName,
    searchValue,
    startsAt,
    endsAt,
    title,
    description,
    capacity,
    language,
    category,
  };
  const {
    publishing,
    publishError,
    clearPublishError,
    publish: publishEvent,
  } = useHostPublish({
    locale,
    market,
    city,
    readDraft: () => draft,
    onAuthRequired: () => setIsAuthGateOpen(true),
  });

  useEffect(() => {
    const restored = readHostCreateDraft(market.code, city.code);
    if (restored) {
      setStep(restoredDraftStep(restored, locale));
      setVenue(restored.venue);
      setVenueName(restored.venueName);
      setSearchValue(restored.searchValue);
      setStartsAt(restored.startsAt);
      setEndsAt(restored.endsAt);
      setTitle(restored.title);
      setDescription(restored.description);
      setCapacity(restored.capacity);
      setLanguage(restored.language);
      setCategory(restored.category);
    }
    setHasRestoredDraft(true);
  }, [market.code, city.code, locale]);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    writeHostCreateDraft(market.code, city.code, {
      step,
      venue,
      venueName,
      searchValue,
      startsAt,
      endsAt,
      title,
      description,
      capacity,
      language,
      category,
    });
  }, [
    hasRestoredDraft,
    market.code,
    city.code,
    step,
    venue,
    venueName,
    searchValue,
    startsAt,
    endsAt,
    title,
    description,
    capacity,
    language,
    category,
  ]);

  /**
   * Take a venue the server verified, and decide who names it.
   *
   * A point of interest names itself. Where the provider could only confirm a street address the
   * name is cleared rather than pre-filled with it, because "15 Rue Yousfi Mohamed" is an address
   * masquerading as a venue name — leaving it in place would let a host publish it by accident.
   */
  const selectVenue = (selection: VenueSelection) => {
    setVenue(selection);
    setVenueName(selection.kind === 'poi' ? selection.name : '');
    setSearchValue(selection.address || selection.name);
    setFieldErrors((current) => ({
      ...current,
      venue: undefined,
      venueName: undefined,
    }));
  };
  const clearVenue = () => {
    setVenue(null);
    setVenueName('');
    setSearchValue('');
  };
  const setSchedule = (
    nextStartsAt: number | null,
    nextEndsAt: number | null,
  ) => {
    setStartsAt(nextStartsAt);
    setEndsAt(nextEndsAt);
    setFieldErrors((current) => ({ ...current, schedule: undefined }));
    clearPublishError();
  };
  const setScheduleError = (error: ZonedDateTimeError | null) => {
    const message =
      error === 'nonexistent_time'
        ? host_time_nonexistent({}, { locale })
        : error === 'invalid_time_zone'
          ? host_time_zone_error({}, { locale })
          : error
            ? host_time_invalid({}, { locale })
            : undefined;
    setFieldErrors((current) => ({ ...current, schedule: message }));
  };
  const validateCurrentStep = (): boolean => {
    const errors =
      step === 1
        ? validateVenueStep(venue, venueName, locale)
        : step === 2
          ? validateScheduleStep(startsAt, endsAt, locale)
          : validateDetailsStep(
              { title, description, capacity, language, category },
              locale,
            );
    setFieldErrors(errors);
    const first = firstInvalidField(errors);
    if (first) focusInvalidField(first);
    return first === null;
  };
  const publish = () => {
    if (!venue || startsAt === null || endsAt === null) return;
    void publishEvent({
      marketCode: market.code,
      cityCode: city.code,
      title,
      description,
      venueName,
      venueAddress: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
      startsAt,
      endsAt,
      capacity,
      language,
      category,
    });
  };

  const next = () => {
    if (step < 4) {
      if (!validateCurrentStep()) return;
      clearPublishError();
      setStep((current) => current + 1);
      return;
    }
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      writeHostCreateDraft(market.code, city.code, draft);
      setIsAuthGateOpen(true);
      return;
    }
    publish();
  };
  const prev = () => {
    clearPublishError();
    setFieldErrors({});
    setStep((current) => Math.max(1, current - 1));
  };
  const stepCopy = hostCreateStepCopy(locale);
  const schedule = hostScheduleSummary(
    startsAt,
    endsAt,
    locale,
    market.timezone,
  );

  return {
    ...draft,
    ...schedule,
    fieldErrors,
    publishing,
    publishError,
    stepLabels: stepCopy.labels,
    stepTitle: stepCopy.labels[step - 1] ?? stepCopy.labels[0],
    stepSub: stepCopy.descriptions[step - 1] ?? null,
    view: hostCreateViewCopy(locale, language, category),
    isAuthGateOpen,
    closeAuthGate: () => setIsAuthGateOpen(false),
    onGateAuthenticated: () => {
      setIsAuthGateOpen(false);
      publish();
    },
    isActionDisabled: publishing || isAuthLoading || isAuthGateOpen,
    setSearchValue,
    setVenueName: (value: string) => {
      setVenueName(value);
      setFieldErrors((current) => ({ ...current, venueName: undefined }));
    },
    setTitle: (value: string) => {
      setTitle(value);
      setFieldErrors((current) => ({ ...current, title: undefined }));
    },
    setDescription: (value: string) => {
      setDescription(value);
      setFieldErrors((current) => ({ ...current, description: undefined }));
    },
    setCapacity: (value: number) => {
      setCapacity(value);
      setFieldErrors((current) => ({ ...current, capacity: undefined }));
    },
    enableCapacityLimit: (enabled: boolean) => setCapacity(enabled ? 12 : 0),
    setLanguage,
    setCategory,
    setSchedule,
    setScheduleError,
    selectVenue,
    clearVenue,
    next,
    prev,
  };
};
