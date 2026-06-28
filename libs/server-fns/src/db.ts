import { env } from 'cloudflare:workers';

import { createDb, type Db } from '@founders-coffee/db';

/**
 * Server functions reach the D1 binding through the Workers runtime env (`cloudflare:workers`),
 * not a constructor arg — the P0-012 → P1-017 env-injection solution. Every consuming app MUST
 * declare a `DB` binding in its `wrangler.jsonc` (apps/ui + worker-jobs do; admin follows). `env`
 * is typed as `Cloudflare.Env`; apps generate `DB` on it via `wrangler types`, but the lib has no
 * runtime wrangler, so we narrow at this single site (AGENTS §11.5, #5323).
 */
export const getDb = (): Db => createDb((env as { DB: D1Database }).DB);
