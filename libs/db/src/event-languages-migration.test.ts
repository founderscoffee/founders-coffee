import { describe, expect, it } from 'vitest';

import { atMigration, priorEventRow } from './migrations.fixtures.js';

describe('0039 — meetup languages (real D1)', () => {
  it('lists every existing meetup in the one language it had', async () => {
    const { event, apply } = await atMigration('0039_event_languages.sql');

    await apply();

    expect(
      await priorEventRow(event.id),
      'every meetup published before hosts could name several languages was held in the one it was filed under',
    ).toMatchObject({ language: 'fr', languages: '["fr"]' });
  });
});
