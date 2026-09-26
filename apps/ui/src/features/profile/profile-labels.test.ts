import { afterEach, describe, expect, it } from 'vitest';

import { memberSinceLabel } from './profile-labels';

const runtimeZone = process.env.TZ;

afterEach(() => {
  if (runtimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = runtimeZone;
});

describe('memberSinceLabel', () => {
  it.each(['Pacific/Honolulu', 'Africa/Algiers', 'Pacific/Kiritimati'])(
    'names the same month for a reader in %s as the server does',
    (zone) => {
      process.env.TZ = zone;

      expect(memberSinceLabel('2025-11', 'en')).toBe('November 2025');
      expect(memberSinceLabel('2026-01', 'fr')).toBe('janvier 2026');
    },
  );
});
