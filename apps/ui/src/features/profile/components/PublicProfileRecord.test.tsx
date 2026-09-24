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
  hostedCount: 0,
  attendedCount: null,
};

const items = (window: string) =>
  Array.from(
    screen.getByRole('list', { name: window }).querySelectorAll('li'),
    (item) => item.textContent,
  );

afterEach(cleanup);

describe('the meetup record on a public profile (#90, #26)', () => {
  it.each([
    ['ar', 'خلال العامين الماضيين', ['استضافة 2 لقاءين', 'حضور 11 لقاءً']],
    [
      'fr',
      'Au cours des deux dernières années',
      ['A organisé 2 rencontres', 'A participé à 11 rencontres'],
    ],
    [
      'en',
      'In the last two years',
      ['Hosted 2 meetups', 'Attended 11 meetups'],
    ],
  ] as const)(
    'names its window, then what was hosted before what was attended, in %s',
    (locale: Locale, window, record) => {
      render(
        <PublicProfileRecord
          locale={locale}
          profile={{ ...member, hostedCount: 2, attendedCount: 11 }}
        />,
      );

      expect(items(window)).toEqual(record);
    },
  );

  it('leaves out whichever count is zero', () => {
    render(
      <PublicProfileRecord
        locale="en"
        profile={{ ...member, hostedCount: 1, attendedCount: 0 }}
      />,
    );
    expect(items('In the last two years')).toEqual(['Hosted 1 meetup']);
    cleanup();

    render(
      <PublicProfileRecord
        locale="en"
        profile={{ ...member, hostedCount: 0, attendedCount: 1 }}
      />,
    );
    expect(items('In the last two years')).toEqual(['Attended 1 meetup']);
  });

  it.each([null, 0])(
    'says nothing at all when nothing was hosted and the attended count is %j',
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
