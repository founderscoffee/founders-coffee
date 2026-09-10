import { describe, expect, it } from 'vitest';

import { eq, user } from '@founders-coffee/db';

import { resolveEvent } from './resolver.js';
import { TEST_HOST_ID, createTestEvent, setupDb } from './resolver.fixtures.js';

describe('resolveEvent (real D1)', () => {
  it('resolves a published event by marketCode + slug', async () => {
    const db = await setupDb();
    const { id, slug } = await createTestEvent(db);

    const result = await resolveEvent(db, { marketCode: 'DZ', slug });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(id);
  });

  it('resolves a published event by id', async () => {
    const db = await setupDb();
    const { id, slug } = await createTestEvent(db);

    const result = await resolveEvent(db, { id });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.slug).toBe(slug);
  });

  it('returns event_not_found for an unknown slug', async () => {
    const db = await setupDb();

    const result = await resolveEvent(db, {
      marketCode: 'DZ',
      slug: 'does-not-exist',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });

  it('returns event_not_found when neither id nor marketCode+slug is given', async () => {
    const db = await setupDb();

    const result = await resolveEvent(db, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });

  it.each([
    ['banned', { banned: true }],
    ['deleted', { accountState: 'deleted' }],
  ])(
    'answers a %s host the same way it answers an unknown slug',
    async (_label, change) => {
      const db = await setupDb();
      const { id, slug } = await createTestEvent(db);
      await db.update(user).set(change).where(eq(user.id, TEST_HOST_ID)).run();

      for (const input of [{ id }, { marketCode: 'DZ', slug }]) {
        const result = await resolveEvent(db, input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('event_not_found');
      }

      await db
        .update(user)
        .set({ banned: false, accountState: 'active' })
        .where(eq(user.id, TEST_HOST_ID))
        .run();
      expect((await resolveEvent(db, { id })).ok).toBe(true);
    },
  );
});
