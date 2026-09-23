import { useEffect, useState } from 'react';

import type { Locale } from '@founders-coffee/i18n';

import {
  readHostCreateDraft,
  writeHostCreateDraft,
  type HostCreateDraft,
} from './host-create-draft';
import { repeatDraftFrom } from './host-create-repeat';
import { restoredDraftStep } from './host-create-validation';
import type { RepeatEventTemplate } from './api';
import type { VenueSelection } from './types';

/**
 * The half-written meetup itself: every field the wizard collects, restored on arrival and saved
 * again as it changes.
 *
 * Split out of the wizard because the wizard is also three other things — validation and stepping,
 * the sign-in gate, and publishing — and this is the part that has a life outside the visit. It is
 * one hook rather than a reducer because the fields are set one at a time by controls that know
 * nothing about each other.
 *
 * `language` starts on the language the host is reading the site in, which is the right guess
 * nearly every time and was, until this field existed, the only answer available. It is theirs to
 * change from the details step, and a repeat carries the language the last meetup was held in
 * rather than guessing again.
 */
export const useHostCreateDraftState = ({
  locale,
  marketCode,
  repeatTemplate,
}: {
  locale: Locale;
  marketCode: string;
  repeatTemplate?: RepeatEventTemplate | null;
}) => {
  const [step, setStep] = useState(1);
  const [venue, setVenue] = useState<VenueSelection | null>(null);
  const [venueName, setVenueName] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<Locale>(locale);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  const draft: HostCreateDraft = {
    step,
    venue,
    venueName,
    searchValue,
    startsAt,
    endsAt,
    title,
    description,
    language,
  };

  useEffect(() => {
    const apply = (next: HostCreateDraft) => {
      setVenue(next.venue);
      setVenueName(next.venueName);
      setSearchValue(next.searchValue);
      setStartsAt(next.startsAt);
      setEndsAt(next.endsAt);
      setTitle(next.title);
      setDescription(next.description);
      setLanguage(next.language);
    };
    const isMatchingRepeat = repeatTemplate?.marketCode === marketCode;
    setIsRepeat(isMatchingRepeat);
    const restored = isMatchingRepeat ? null : readHostCreateDraft(marketCode);
    if (restored) {
      setStep(restoredDraftStep(restored, locale));
      apply(restored);
    } else if (isMatchingRepeat && repeatTemplate) {
      const repeated = repeatDraftFrom(repeatTemplate);
      setStep(repeated.step);
      apply(repeated);
    }
    setHasRestoredDraft(true);
  }, [marketCode, locale, repeatTemplate]);

  useEffect(() => {
    if (!hasRestoredDraft) return;
    writeHostCreateDraft(marketCode, {
      step,
      venue,
      venueName,
      searchValue,
      startsAt,
      endsAt,
      title,
      description,
      language,
    });
  }, [
    hasRestoredDraft,
    marketCode,
    step,
    venue,
    venueName,
    searchValue,
    startsAt,
    endsAt,
    title,
    description,
    language,
  ]);

  return {
    draft,
    isRepeat,
    setStep,
    setVenue,
    setVenueName,
    setSearchValue,
    setStartsAt,
    setEndsAt,
    setTitle,
    setDescription,
    setLanguage,
  };
};
