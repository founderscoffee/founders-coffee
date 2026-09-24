import { env } from 'cloudflare:workers';
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { createDb, events, markets, user } from '@founders-coffee/db';
import type { Event } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

import { readAccountSummary } from './profile/account.js';
import { attachAttendance } from './events/attendance.js';
import { attachCityNames } from './events/resolver.js';
import { groupCityHosts } from './markets/city-hosts.js';
import { ownerProfileProjection } from './profile/projection.js';

const PUBLIC_PROFILE_FIELDS = [
  'displayName',
  'headline',
  'interests',
  'introduction',
  'memberSince',
  'photoAssetId',
  'professionalLink',
  'spokenLanguages',
  'stage',
  'userId',
] as const;

const OWNER_PROFILE_FIELDS = [
  ...PUBLIC_PROFILE_FIELDS,
  'revision',
  'visibility',
] as const;

const MEETUP_RECORD_FIELDS = ['attendedCount'] as const;

const EVENT_COLUMNS = [
  'cancellationReason',
  'cancelledAt',
  'cityCode',
  'createdAt',
  'description',
  'endsAt',
  'hostId',
  'id',
  'language',
  'latitude',
  'longitude',
  'marketCode',
  'rsvps',
  'slug',
  'startsAt',
  'stateCode',
  'status',
  'title',
  'updatedAt',
  'venue',
  'venueAddress',
  'version',
] as const;

const PUBLIC_EVENT_FIELDS = [
  ...EVENT_COLUMNS,
  'cityName',
  'cityNameAr',
  'cityNameFr',
  'citySlug',
  'goingCount',
  'hostName',
  'hostPhotoAssetId',
  'viewerRsvp',
] as const;

const PUBLIC_CITY_HOST_FIELDS = ['name', 'photoAssetId'] as const;

const PUBLIC_MARKET_FIELDS = [
  'brandOverrides',
  'code',
  'createdAt',
  'defaultCurrency',
  'defaultLocale',
  'direction',
  'featureFlags',
  'name',
  'nameAr',
  'nameFr',
  'slug',
  'state',
  'timezone',
] as const;

const GENERIC_IDENTITY_COLUMNS = ['createdAt', 'id', 'name', 'updatedAt'];

const IDENTITY_COLUMNS_NEVER_PUBLISHED = Object.keys(
  getTableColumns(user),
).filter((column) => !GENERIC_IDENTITY_COLUMNS.includes(column));

const sorted = (keys: readonly string[]) => [...keys].sort();

const blankEventRow = () =>
  Object.fromEntries(
    Object.keys(getTableColumns(events)).map((column) => [column, null]),
  ) as unknown as Event;

describe('public response contract', () => {
  it('publishes exactly the profile fields the contract names', () => {
    expect(
      sorted(Object.keys(profile.publicMemberProfileSchema.shape)),
    ).toEqual(sorted([...PUBLIC_PROFILE_FIELDS, ...MEETUP_RECORD_FIELDS]));
  });

  it('keeps the owner projection to the published fields, less the meetup record, plus its own controls', () => {
    const owner = ownerProfileProjection(
      'usr_contract',
      'Contract',
      new Date('2026-03-14T09:30:00Z'),
      null,
    );

    expect(sorted(Object.keys(owner))).toEqual(sorted(OWNER_PROFILE_FIELDS));
    expect(sorted(Object.keys(owner.visibility))).toEqual(
      sorted([
        'attendedCount',
        'headline',
        'interests',
        'professionalLink',
        'spokenLanguages',
        'stage',
      ]),
    );
  });

  it('publishes the introduction while withholding opt-in fields', () => {
    const owner = ownerProfileProjection(
      'usr_contract',
      'Contract',
      new Date('2026-03-14T09:30:00Z'),
      {
        headline: 'A bookkeeping app for small shops',
        stage: 'launched',
        introduction: 'Secret',
        interests: ['bootstrapping'],
        spokenLanguages: ['ar'],
        professionalLink: 'https://example.dz',
        photoAssetId: 'ast_0123456789abcdef0123456789abcdef',
      } as never,
    );
    const published = profile.projectPublicProfile(owner, { attended: 4 });

    expect(sorted(Object.keys(published))).toEqual(
      sorted([...PUBLIC_PROFILE_FIELDS, ...MEETUP_RECORD_FIELDS]),
    );
    expect(published).toMatchObject({
      memberSince: '2026-03',
      attendedCount: null,
      headline: null,
      stage: null,
      introduction: 'Secret',
      professionalLink: null,
      photoAssetId: owner.photoAssetId,
      interests: [],
      spokenLanguages: [],
    });
  });

  it('names every events column, so a new one cannot reach the feed unreviewed', () => {
    expect(sorted(Object.keys(getTableColumns(events)))).toEqual(
      sorted(EVENT_COLUMNS),
    );
  });

  it('publishes exactly the event fields the contract names', async () => {
    const row = { ...blankEventRow(), marketCode: 'DZ', cityCode: '1' };
    const [item] = await attachAttendance(
      null as never,
      attachCityNames([row as Event]),
    );

    expect(sorted(Object.keys(item))).toEqual(sorted(PUBLIC_EVENT_FIELDS));
  });

  it('publishes exactly the host fields a city card names', () => {
    const [face] =
      groupCityHosts([
        {
          cityCode: '1',
          hostId: 'usr_contract',
          name: 'Contract',
          photoAssetId: 'ast_contract',
        },
      ]).get('1')?.hosts ?? [];

    expect(sorted(Object.keys(face ?? {}))).toEqual(
      sorted(PUBLIC_CITY_HOST_FIELDS),
    );
  });

  it('publishes exactly the market fields the contract names', () => {
    expect(sorted(Object.keys(getTableColumns(markets)))).toEqual(
      sorted(PUBLIC_MARKET_FIELDS),
    );
  });

  it('keeps the account summary to masked facts, never a contact or a token', async () => {
    const db = createDb(env.DB);
    const userId = id('usr');
    await db
      .insert(user)
      .values({ id: userId, name: 'Gate', email: `${userId}@test.coffee` });

    const result = await readAccountSummary(db, userId);
    if (!result.ok) throw result.error;

    expect(sorted(Object.keys(result.data))).toEqual(
      sorted([
        'email',
        'locale',
        'phone',
        'providers',
        'sessionCount',
        'userId',
      ]),
    );
    expect(sorted(Object.keys(result.data.email))).toEqual(
      sorted(['masked', 'verified']),
    );
    expect(sorted(Object.keys(result.data.phone))).toEqual(
      sorted(['masked', 'verified']),
    );
    expect(result.data.email.masked).not.toBe(`${userId}@test.coffee`);
  });

  it('treats every non-generic identity column as unpublishable', () => {
    expect(sorted(IDENTITY_COLUMNS_NEVER_PUBLISHED)).toEqual(
      sorted([
        'accountState',
        'banExpires',
        'banReason',
        'banned',
        'email',
        'emailVerified',
        'image',
        'localePref',
        'phoneNumber',
        'phoneNumberVerified',
        'role',
      ]),
    );
  });

  it('carries no identity column beyond the host reference into a public response', () => {
    const surfaces = [
      PUBLIC_PROFILE_FIELDS,
      OWNER_PROFILE_FIELDS,
      PUBLIC_EVENT_FIELDS,
      PUBLIC_CITY_HOST_FIELDS,
      PUBLIC_MARKET_FIELDS,
    ];

    for (const surface of surfaces) {
      for (const column of IDENTITY_COLUMNS_NEVER_PUBLISHED) {
        expect(surface as readonly string[]).not.toContain(column);
      }
    }
  });
});
