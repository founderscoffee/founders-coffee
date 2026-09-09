import fs from 'node:fs/promises';
import path from 'node:path';
import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const sqlNames = async (directory: string): Promise<string[]> =>
  (await fs.readdir(directory)).filter((name) => name.endsWith('.sql')).sort();

export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const pendingPath = path.join(__dirname, 'pending-migrations');
  const migrations = await readD1Migrations(migrationsPath);
  const contractions = await readD1Migrations(pendingPath);
  const journal = JSON.parse(
    await fs.readFile(
      path.join(migrationsPath, 'meta', '_journal.json'),
      'utf8',
    ),
  ) as { entries: { idx: number; tag: string }[] };

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: [...migrations, ...contractions],
            SHIPPED_MIGRATIONS: migrations,
            MIGRATION_MANIFEST: {
              journal: journal.entries.map((entry) => entry.tag),
              shipped: await sqlNames(migrationsPath),
              pending: await sqlNames(pendingPath),
            },
          },
        },
      }),
    ],
    test: {
      include: ['src/**/*.test.ts'],
      setupFiles: ['./src/setup.ts'],
    },
  };
});
