import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import type { PublicProfile } from '../api';
import { PublicProfileRecord } from './PublicProfileRecord';

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

describe('the meetup record on a public profile (#90)', () => {
  it.each([
    ['ar', 'خلال العامين الماضيين', 'حضور 11 لقاءً'],
    ['fr', 'Au cours des deux dernières années', 'A participé à 11 rencontres'],
    ['en', 'In the last two years', 'Attended 11 meetups'],
  ] as const)(
    'names its window and the count in %s',
    (locale: Locale, window, attended) => {
      render(
        <PublicProfileRecord
          locale={locale}
          profile={{ ...member, attendedCount: 11 }}
        />,
      );

      const list = screen.getByRole('list', { name: window });
      expect(list.textContent).toBe(attended);
    },
  );

  it.each([null, 0])(
    'says nothing at all for an attended count of %j',
    (attendedCount) => {
      const { container } = render(
        <PublicProfileRecord
          locale="en"
          profile={{ ...member, attendedCount }}
        />,
      );

      expect(container.innerHTML).toBe('');
    },
  );
});
