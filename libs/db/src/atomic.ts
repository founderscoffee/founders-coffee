import type { Db } from './db.js';

/**
 * D1 has NO interactive transactions — only atomic batches (AGENTS.md §11).
 *
 * Use `batch()` for atomic multi-statement execution in one round-trip, and use
 * atomic single-statement SQL (e.g. `UPDATE events SET rsvps = rsvps + 1
 * WHERE id = ? AND rsvps < capacity`) for check-then-write. NEVER read→decide→write
 * across awaits — that is a TOCTOU race and is not atomic on D1.
 */
export function batch(db: Db, statements: Parameters<Db['batch']>[0]) {
  return db.batch(statements);
}
