import { describe, expect, it } from 'vitest';

import { safeProfileDisplayName } from './identity.js';

describe('safeProfileDisplayName', () => {
  it('accepts trimmed names in every supported script', () => {
    for (const name of ['أمينة', 'Élodie', 'Taylor']) {
      expect(safeProfileDisplayName(` ${name} `)).toBe(name);
    }
    expect(safeProfileDisplayName('Member', null, null)).toBe('Member');
  });
  it('never derives a name from contact identity', () => {
    expect(
      safeProfileDisplayName('PERSON@EXAMPLE.COM', ' person@example.com '),
    ).toBe('');
    expect(
      safeProfileDisplayName('+213555123456', null, ' +213555123456 '),
    ).toBe('');
    expect(
      safeProfileDisplayName('Amina', 'private@example.com', '+213555123456'),
    ).toBe('Amina');
  });
  it('marks missing and oversized names incomplete without a fallback', () => {
    for (const name of ['', '   ', 'x'.repeat(81), '😀'.repeat(81)]) {
      expect(safeProfileDisplayName(name)).toBe('');
    }
  });
});
