import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { profileFixture } from './profiles.fixtures.js';
import { user } from './schema.js';
import { getUser, replaceUserName } from './users.js';

describe('replaceUserName on real D1', () => {
  it('writes the name while it is still the one read', async () => {
    const { db, userId } = await profileFixture({ name: '' });

    expect(
      await replaceUserName(db, { userId, expected: '', name: 'Sara Benali' }),
    ).toBe(true);
    expect((await getUser(db, userId))?.name).toBe('Sara Benali');
  });

  it('leaves a name the member saved in between', async () => {
    const { db, userId } = await profileFixture({ name: '' });
    await db.update(user).set({ name: 'Amina' }).where(eq(user.id, userId));

    expect(
      await replaceUserName(db, { userId, expected: '', name: 'Sara Benali' }),
    ).toBe(false);
    expect((await getUser(db, userId))?.name).toBe('Amina');
  });

  it('writes nothing for an account that does not exist', async () => {
    const { db } = await profileFixture();

    expect(
      await replaceUserName(db, {
        userId: 'usr_missing',
        expected: '',
        name: 'Sara Benali',
      }),
    ).toBe(false);
  });
});
