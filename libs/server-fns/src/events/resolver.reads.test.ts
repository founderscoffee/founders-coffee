import { describe, expect, it } from 'vitest';

import { resolveEvent } from './resolver.js';
import { createTestEvent, setupDb } from './resolver.fixtures.js';

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
});
