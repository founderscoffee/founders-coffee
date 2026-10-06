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
  languages: ['ar', 'fr'],
};

const hook = (locale: Locale, repeatTemplate?: RepeatEventTemplate | null) =>
  renderHook(() =>
    useHostCreateDraftState({ locale, marketCode: 'DZ', repeatTemplate }),
  );

const state = (locale: Locale, repeatTemplate?: RepeatEventTemplate | null) =>
  hook(locale, repeatTemplate).result;

describe('the languages a half-written meetup carries', () => {
  beforeEach(() => window.sessionStorage.clear());

  it.each<Locale>([...LOCALES])(
    'stores no guess in %s, so the page language can stand in for one',
    (locale) => {
      expect(state(locale).current.draft.chosenLanguages).toBeNull();
    },
  );

  it('keeps the languages a saved draft was left with', () => {
    const saved = state('en').current.draft;
    writeHostCreateDraft('DZ', { ...saved, chosenLanguages: ['fr', 'ar'] });

    expect(state('en').current.draft.chosenLanguages).toEqual(['fr', 'ar']);
  });

  it('saves the choice the moment it is made, not when the wizard ends', () => {
    const chosen = hook('en').result;
    act(() => chosen.current.setChosenLanguages(['fr', 'ber']));

    expect(
      readHostCreateDraft('DZ')?.chosenLanguages,
      'a host who picks the languages and then closes the tab has to find them again',
    ).toEqual(['fr', 'ber']);
  });

  it('holds a repeat in the languages the last meetup was held in', () => {
    expect(state('en', template).current.draft.chosenLanguages).toEqual([
      'ar',
      'fr',
    ]);
  });

  it('does not take a repeat from another market', () => {
    expect(
      state('en', { ...template, marketCode: 'EG' }).current.draft
        .chosenLanguages,
    ).toBeNull();
  });
});

describe('a repeat the page loads again', () => {
  beforeEach(() => window.sessionStorage.clear());

  const changedTitle = 'Founders breakfast, autumn edition';

  it('keeps what the host changed rather than applying the old meetup again', () => {
    const first = hook('en', template);
    act(() => first.result.current.setTitle(changedTitle));
    first.unmount();

    expect(
      state('en', template).current.draft.title,
      'a reload of a repeat put the old meetup back over everything the host had changed',
    ).toBe(changedTitle);
  });

  it('opens a repeat of another meetup on that meetup', () => {
    const first = hook('en', template);
    act(() => first.result.current.setTitle(changedTitle));
    first.unmount();

    const other = {
      ...template,
      sourceEventId: 'evt_other',
      title: 'Founders dinner',
    };
    expect(state('en', other).current.draft.title).toBe('Founders dinner');
  });

  it('still opens a repeat on the old meetup over a plain draft of its market', () => {
    const plain = hook('en');
    act(() => plain.result.current.setTitle('Something else entirely'));
    plain.unmount();

    expect(state('en', template).current.draft.title).toBe(template.title);
  });
});
