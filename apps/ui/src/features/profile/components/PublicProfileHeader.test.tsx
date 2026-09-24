import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import type { PublicProfile } from '../api';
import { PublicProfileHeader } from './PublicProfileHeader';

const member: PublicProfile = {
  userId: 'usr_member',
  displayName: 'Amina',
  photoAssetId: null,
  memberSince: '2025-11',
  headline: null,
  stage: null,
  introduction: null,
  interests: [],
  spokenLanguages: [],
  professionalLink: null,
  attendedCount: null,
};

afterEach(cleanup);

describe('the public profile says what a member is building (#89)', () => {
  it('puts the headline directly under the name, in the direction it was written in', () => {
    const { container } = render(
      <PublicProfileHeader
        locale="en"
        profile={{ ...member, headline: 'تطبيق محاسبة للمحلات الصغيرة' }}
      />,
    );

    const name = screen.getByRole('heading', { name: 'Amina' });
    const headline = screen.getByText('تطبيق محاسبة للمحلات الصغيرة');
    expect(headline.tagName).toBe('BDI');
    expect(name.nextElementSibling).toBe(headline.parentElement);
    expect(container.querySelector('dl')).toBeNull();
  });

  it.each([
    ['ar', 'مرحلة المشروع', 'فكرة'],
    ['fr', 'Stade du projet', 'Idée'],
    ['en', 'Project stage', 'Idea'],
  ] as const)(
    'names the stage and what it is a stage of, in %s',
    (locale: Locale, term, stage) => {
      render(
        <PublicProfileHeader
          locale={locale}
          profile={{ ...member, stage: 'idea' }}
        />,
      );

      expect(screen.getByRole('term').textContent).toBe(term);
      expect(screen.getByRole('definition').textContent).toBe(stage);
    },
  );

  it('shows neither when the member published neither', () => {
    const { container } = render(
      <PublicProfileHeader locale="en" profile={member} />,
    );

    expect(
      screen.getByRole('heading', { name: 'Amina' }).nextElementSibling
        ?.textContent,
    ).toBe('Member since November 2025');
    expect(container.querySelector('dl')).toBeNull();
  });

  it.each([
    ['ar', 'عضو منذ نوفمبر 2025'],
    ['fr', 'Membre depuis novembre 2025'],
    ['en', 'Member since November 2025'],
  ] as const)(
    'says since when, to the month, in %s',
    (locale: Locale, since) => {
      render(
        <PublicProfileHeader
          locale={locale}
          profile={{ ...member, stage: 'launched' }}
        />,
      );

      expect(screen.getByText(since).tagName).toBe('P');
    },
  );
});
