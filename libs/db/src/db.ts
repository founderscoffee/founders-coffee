import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import * as schema from './schema.js';

/**
 * Create a Drizzle instance bound to a Cloudflare D1 database.
 * Apps reach the D1 binding via `cloudflare:workers` (`env.DB`) and pass it here.
 */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

export type Db = DrizzleD1Database<typeof schema>;
