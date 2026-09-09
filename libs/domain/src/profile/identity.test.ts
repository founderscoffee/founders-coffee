import { describe, expect, it } from 'vitest';

import { safeProfileDisplayName } from './identity.js';

describe('safeProfileDisplayName', () => {
  it('accepts trimmed names in every supported script', () => {
    for (const name of ['أمينة', 'Élodie', 'Taylor']) {
      expect(safeProfileDisplayName(` ${name} `)).toBe(name);
    }
    expect(safeProfileDisplayName('Member', null)).toBe('Member');
  });

  it('never derives a name from the email address', () => {
    expect(
      safeProfileDisplayName('PERSON@EXAMPLE.COM', ' person@example.com '),
    ).toBe('');
    expect(safeProfileDisplayName('Amina', 'private@example.com')).toBe(
      'Amina',
    );
  });

  it('leaves a phone-shaped name alone, which the client can also decide', () => {
    expect(safeProfileDisplayName('+213555123456', 'member@example.com')).toBe(
      '+213555123456',
    );
  });

  it('marks missing and oversized names incomplete without a fallback', () => {
    for (const name of ['', '   ', 'x'.repeat(81), '😀'.repeat(81)]) {
      expect(safeProfileDisplayName(name)).toBe('');
    }
  });
});
