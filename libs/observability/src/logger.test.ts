import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { libraryLog, setLogger } from './logger.js';
import { createServerLogger } from './server.js';
import type { LogEntry } from './types.js';

describe('libraryLog', () => {
  it("logs a library's line through the active logger, the error it caught stripped of values", () => {
    const entries: LogEntry[] = [];
    setLogger(
      createServerLogger({ transport: (entry) => void entries.push(entry) }),
    );
    const failed = new DrizzleQueryError(
      'insert into "verification" ("identifier", "value") values (?, ?)',
      ['sign-in-otp-amina@example.com', 'hashed-code'],
      new Error('D1_ERROR: no such table: verification: SQLITE_ERROR'),
    );

    libraryLog('better-auth')('error', failed.message);
    libraryLog('better-auth')('warn', 'Error', failed);

    expect(JSON.stringify(entries)).not.toContain('amina');
    expect(JSON.stringify(entries)).not.toContain('hashed-code');
    expect(entries.map((entry) => [entry.level, entry.source])).toEqual([
      ['error', 'better-auth'],
      ['warn', 'better-auth'],
    ]);
    expect(entries[0].msg).toBe(
      'Failed query: insert into "verification" ("identifier", "value") values (?, ?)',
    );
    expect(entries[1].args).toEqual([
      {
        name: 'Error',
        message:
          'Failed query: insert into "verification" ("identifier", "value") values (?, ?)\ncause: D1_ERROR: no such table: verification: SQLITE_ERROR',
      },
    ]);
  });
});
