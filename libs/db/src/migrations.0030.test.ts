import { describe, expect, it } from 'vitest';

import { atMigration, columnNames } from './migrations.fixtures.js';

describe('0030 — split host RSVP preferences (real D1)', () => {
  it('adds independent defaults while retaining legacy columns for rollback safety', async () => {
    const { apply } = await atMigration('0030_white_vindicator.sql');

    await apply();

    const columns = await columnNames('account_preferences');
    expect(columns).toContain('host_rsvp_received');
    expect(columns).toContain('host_rsvp_received_channels');
    expect(columns).toContain('host_rsvp_cancelled');
    expect(columns).toContain('host_rsvp_cancelled_channels');
    expect(columns).toContain('host_updates');
    expect(columns).toContain('host_updates_channels');
  });
});
