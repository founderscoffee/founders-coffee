import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { readHostCreateDraft, writeHostCreateDraft } from './host-create-draft';
import { useHostCreateDraftState } from './useHostCreateDraftState';
import type { RepeatEventTemplate } from './api';

const template: RepeatEventTemplate = {
  sourceEventId: 'evt_previous',
  marketCode: 'DZ',
  cityCode: '1',
  title: 'Founders breakfast',
  description: 'A relaxed breakfast for local founders.',
  venue: 'Café Atlas',
  venueAddress: '12 Rue des Entrepreneurs, Alger',
  latitude: 36.7538,
  longitude: 3.0588,
  language: 'ar',
};

const hook = (locale: Locale, repeatTemplate?: RepeatEventTemplate | null) =>
  renderHook(() =>
    useHostCreateDraftState({ locale, marketCode: 'DZ', repeatTemplate }),
  );

const state = (locale: Locale, repeatTemplate?: RepeatEventTemplate | null) =>
  hook(locale, repeatTemplate).result;

describe('the language a half-written meetup carries', () => {
  beforeEach(() => window.sessionStorage.clear());

  it.each<Locale>([...LOCALES])(
    'starts on the language the host is reading, in %s',
    (locale) => {
      expect(state(locale).current.draft.language).toBe(locale);
    },
  );

  it('keeps the language a saved draft was left with', () => {
    const saved = state('en').current.draft;
    writeHostCreateDraft('DZ', { ...saved, language: 'fr' });

    expect(state('en').current.draft.language).toBe('fr');
  });

  it('saves the choice the moment it is made, not when the wizard ends', () => {
    const chosen = hook('en').result;
    act(() => chosen.current.setLanguage('fr'));

    expect(
      readHostCreateDraft('DZ')?.language,
      'a host who picks a language and then closes the tab has to find it again',
    ).toBe('fr');
  });

  it('holds a repeat in the language the last meetup was held in', () => {
    expect(state('en', template).current.draft.language).toBe('ar');
  });

  it('does not take a repeat from another market', () => {
    expect(
      state('en', { ...template, marketCode: 'EG' }).current.draft.language,
    ).toBe('en');
  });
});
