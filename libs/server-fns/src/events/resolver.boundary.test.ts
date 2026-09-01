import { describe, expect, it } from 'vitest';

import { countEventsByStatus } from '@founders-coffee/db';

import { requirePermission } from '../authz.js';
import {
  rawCreateInput,
  setupDb,
  validationErrorFor,
} from './resolver.fixtures.js';

describe('create-event boundary (Miniflare)', () => {
  it('rejects unauthenticated and unauthorized creation through centralized authz', async () => {
    const db = await setupDb();
    const before = await countEventsByStatus(db, 'published');

    expect(() => requirePermission(null, 'event', 'create')).toThrowError(
      expect.objectContaining({ code: 'unauthenticated' }),
    );
    expect(() =>
      requirePermission(
        { user: { role: 'sponsor_contact' } } as never,
        'event',
        'create',
      ),
    ).toThrowError(expect.objectContaining({ code: 'forbidden' }));
    expect(await countEventsByStatus(db, 'published')).toBe(before);
  });

  it.each([
    [
      'past schedule',
      (() => {
        const startsAt = Date.now() - 60_000;
        return { startsAt, endsAt: startsAt + 3_600_000 };
      })(),
    ],
    [
      'reversed schedule',
      (() => {
        const startsAt = Date.now() + 3_600_000;
        return { startsAt, endsAt: startsAt - 60_000 };
      })(),
    ],
    ['invalid latitude', { latitude: 91 }],
    ['invalid longitude', { longitude: 181 }],
  ])('rejects %s through appValidator before a D1 write', async (_, patch) => {
    const db = await setupDb();
    const before = await countEventsByStatus(db, 'published');

    const error = validationErrorFor(rawCreateInput(patch));

    expect(error?.code).toBe('validation_failed');
    expect(await countEventsByStatus(db, 'published')).toBe(before);
  });
});
