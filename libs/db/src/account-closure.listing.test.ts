import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { listClosingAccounts } from './account-closure.js';
import { NOW, person, setupDb } from './account-closure.fixtures.js';
import { eq, user } from './index.js';

describe('finding the accounts due for closure (real D1)', () => {
  it('lists closing accounts only, oldest closure first', async () => {
    const db = await setupDb();
    const first = await person(db, 'Amel');
    const second = await person(db, 'Samir');
    const open = await person(db, 'Yasmine');
    const later = await person(db, 'Walid');
    const at = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
    for (const [member, closedAt] of [
      [first, at(3)],
      [second, at(1)],
      [later, new Date(NOW.getTime() + 86_400_000)],
    ] as const) {
      await db
        .update(user)
        .set({ accountState: 'closing', closedAt })
        .where(eq(user.id, member.id));
    }

    const due = await listClosingAccounts(db, { now: NOW, limit: 50 });
    const ids = due.map((row) => row.id);

    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
    expect(ids).not.toContain(open.id);
    expect(ids).not.toContain(later.id);
  });

  it('reads through the index that holds closing accounts and nothing else', async () => {
    const db = await setupDb();
    const query = listClosingAccounts(db, { now: NOW, limit: 20 }).toSQL();

    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .bind(...query.params)
      .all<{ detail: string }>();

    expect(plan.results.map((row) => row.detail).join(' | ')).toMatch(
      /user_closing_index/,
    );
  });
});
