import { defineConfig } from 'drizzle-kit';

/** Drizzle Kit config — generates D1 migrations from src/schema.ts into ./migrations. */
export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
});
