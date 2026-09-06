import type { BatchItem } from 'drizzle-orm/batch';

import type { Db } from './db.js';

/**
 * D1 has NO interactive transactions — only atomic batches (AGENTS.md §11).
 *
 * Use `batch()` for atomic multi-statement execution in one round-trip, and use
 * atomic single-statement SQL (e.g. `UPDATE events SET rsvps = rsvps - 1
 * WHERE id = ? AND rsvps > 0`) for check-then-write. NEVER read→decide→write
 * across awaits — that is a TOCTOU race and is not atomic on D1.
 *
 * Statements execute in declaration order inside a single D1 transaction, so you
 * can rely on ordering (e.g. insert parent rows before the children that
 * reference them via foreign key).
 *
 * Drizzle types `db.batch()` to require a *uniform readonly tuple*, but the
 * runtime happily iterates any array of query builders. This helper accepts a
 * plain array (so callers can build batches dynamically / mix table types) and
 * satisfies the tuple constraint internally.
 */
export const batch = (db: Db, statements: readonly BatchItem<'sqlite'>[]) =>
  db.batch(statements as unknown as Parameters<Db['batch']>[0]);
