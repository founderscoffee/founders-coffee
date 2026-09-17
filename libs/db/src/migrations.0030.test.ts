import { describe, expect, it } from 'vitest';

import { atMigration, columnNames } from './migrations.fixtures.js';

describe('0030 — split host RSVP preferences (real D1)', () => {
  it('replaces the combined host preference with independent defaults', async () => {
    const { apply } = await atMigration('0030_white_vindicator.sql');

    await apply();

    const columns = await columnNames('account_preferences');
    expect(columns).toContain('host_rsvp_received');
    expect(columns).toContain('host_rsvp_received_channels');
    expect(columns).toContain('host_rsvp_cancelled');
    expect(columns).toContain('host_rsvp_cancelled_channels');
    expect(columns).not.toContain('host_updates');
    expect(columns).not.toContain('host_updates_channels');
  });
});
