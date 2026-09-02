import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import type { Market } from '@founders-coffee/db';
import { events, type geo } from '@founders-coffee/domain';
import {
  formatDate,
  host_publish_error,
  host_time_invalid,
  host_time_nonexistent,
  host_time_zone_error,
  type Locale,
  type ZonedDateTimeError,
} from '@founders-coffee/i18n';

import { safeRedirectPath } from '../../lib/redirect';
import { hostCreateStepCopy, hostCreateViewCopy } from './host-create-copy';
import {
  clearHostCreateDraft,
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
import { useCreateEvent } from './hooks';
import type { VenueSelection } from './types';

export const useHostCreateWizard = ({
  locale,
  market,
  city,
  isAuthenticated,
  isAuthLoading,
  isTurnstileBypassed,
}: {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isTurnstileBypassed: boolean;
}) => {
  const navigate = useNavigate();
  const createEventMutation = useCreateEvent();
  const [step, setStep] = useState(1);
  const [venue, setVenue] = useState<VenueSelection | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [language, setLanguage] = useState<events.EventLanguage>(locale);
  const [category, setCategory] =
    useState<events.EventCategory>('coffee-meetup');
  const [fieldErrors, setFieldErrors] = useState<HostCreateFieldErrors>({});
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const draft: HostCreateDraft = {
    step,
    venue,
    searchValue,
    startsAt,
    endsAt,
    title,
    description,
    capacity,
    language,
    category,
  };

  useEffect(() => {
    const restored = readHostCreateDraft(market.code, city.code);
    if (restored) {
      setStep(restoredDraftStep(restored, locale));
      setVenue(restored.venue);
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
    searchValue,
    startsAt,
    endsAt,
    title,
    description,
    capacity,
    language,
    category,
  ]);

  useEffect(() => {
    if (step !== 4 || !isAuthenticated) setTurnstileToken(null);
  }, [step, isAuthenticated]);

  const selectVenue = (selection: VenueSelection) => {
    setVenue(selection);
    setSearchValue(selection.address || selection.name);
    setFieldErrors((current) => ({ ...current, venue: undefined }));
  };
  const clearVenue = () => {
    setVenue(null);
    setSearchValue('');
  };
  const setSchedule = (
    nextStartsAt: number | null,
    nextEndsAt: number | null,
  ) => {
    setStartsAt(nextStartsAt);
    setEndsAt(nextEndsAt);
    setFieldErrors((current) => ({ ...current, schedule: undefined }));
    setPublishError(null);
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
        ? validateVenueStep(venue, locale)
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
  const publish = async () => {
    if (publishing || !venue || startsAt === null || endsAt === null) return;
    if (!isTurnstileBypassed && turnstileToken === null) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await createEventMutation.mutateAsync({
        data: {
          event: {
            marketCode: market.code,
            cityCode: city.code,
            title,
            description,
            venueName: venue.name,
            venueAddress: venue.address,
            latitude: venue.latitude,
            longitude: venue.longitude,
            startsAt,
            endsAt,
            capacity,
            language,
            category,
          },
          turnstileToken: turnstileToken ?? undefined,
        },
      });
      clearHostCreateDraft(market.code, city.code);
      void navigate({ to: '/$market', params: { market: market.slug } });
    } catch {
      setPublishError(host_publish_error({}, { locale }));
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setPublishing(false);
    }
  };
  const next = () => {
    if (step < 4) {
      if (!validateCurrentStep()) return;
      setPublishError(null);
      setStep((current) => current + 1);
      return;
    }
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      writeHostCreateDraft(market.code, city.code, draft);
      const redirect = safeRedirectPath(
        `${window.location.pathname}${window.location.search}`,
      );
      void navigate({ to: '/login', search: { redirect } });
      return;
    }
    void publish();
  };
  const prev = () => {
    setPublishError(null);
    setFieldErrors({});
    setStep((current) => Math.max(1, current - 1));
  };
  const stepCopy = hostCreateStepCopy(locale);
  const hasValidTimeRange =
    startsAt !== null &&
    endsAt !== null &&
    events.eventScheduleSchema.safeParse({ startsAt, endsAt }).success;
  const whenLabel = startsAt
    ? formatDate(new Date(startsAt), locale, {
        timeZone: market.timezone,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return {
    ...draft,
    fieldErrors,
    publishing,
    publishError,
    turnstileResetKey,
    hasValidTimeRange,
    whenLabel,
    durationMinutes:
      startsAt && endsAt ? Math.round((endsAt - startsAt) / 60_000) : 0,
    stepLabels: stepCopy.labels,
    stepTitle: stepCopy.labels[step - 1] ?? stepCopy.labels[0],
    stepSub: stepCopy.descriptions[step - 1] ?? null,
    view: hostCreateViewCopy(locale, language, category),
    isActionDisabled:
      publishing ||
      isAuthLoading ||
      (step === 4 &&
        isAuthenticated &&
        !isTurnstileBypassed &&
        turnstileToken === null),
    setSearchValue,
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
    setTurnstileToken,
    setSchedule,
    setScheduleError,
    selectVenue,
    clearVenue,
    next,
    prev,
  };
};
