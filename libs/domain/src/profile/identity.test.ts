import { describe, expect, it } from 'vitest';

import {
  displayNameFromEmail,
  safeProfileDisplayName,
  startingDisplayName,
} from './identity.js';

describe('safeProfileDisplayName', () => {
  it('accepts trimmed names in every supported script', () => {
    for (const name of ['أمينة', 'Élodie', 'Taylor']) {
      expect(safeProfileDisplayName(` ${name} `)).toBe(name);
    }
    expect(safeProfileDisplayName('Member', null)).toBe('Member');
  });

  it('refuses the email address itself, in any case', () => {
    expect(
      safeProfileDisplayName('PERSON@EXAMPLE.COM', ' person@example.com '),
    ).toBe('');
    expect(safeProfileDisplayName('Amina', 'private@example.com')).toBe(
      'Amina',
    );
  });

  it('keeps a name derived from the email, which is a name like any other', () => {
    expect(
      safeProfileDisplayName('Sara Benali', 'sara.benali@example.com'),
      'the name step is gone, so this is the name a new member starts with (#119)',
    ).toBe('Sara Benali');
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

describe('displayNameFromEmail', () => {
  it.each([
    ['sara.benali@example.com', 'Sara Benali'],
    ['sara_benali@example.com', 'Sara Benali'],
    ['sara-benali@example.com', 'Sara Benali'],
    ['sara.benali+work@example.com', 'Sara Benali'],
    ['karim2024@example.com', 'Karim'],
    ['karim.b.1990@example.com', 'Karim B'],
    ['SARA.BENALI@EXAMPLE.COM', 'Sara Benali'],
    ['  amine@example.com ', 'Amine'],
  ])('reads %s as "%s"', (email, name) => {
    expect(displayNameFromEmail(email)).toBe(name);
  });

  it('keeps an apostrophe inside a word and drops one at its edge', () => {
    expect(displayNameFromEmail("o'brien@example.com")).toBe("O'brien");
    expect(displayNameFromEmail("'amine'@example.com")).toBe('Amine');
  });

  it('treats any other character that is not a letter as a space', () => {
    expect(displayNameFromEmail('sara!benali#dz@example.com')).toBe(
      'Sara Benali Dz',
    );
  });

  it('keeps letters from any script', () => {
    expect(displayNameFromEmail('أمينة.بن@example.com')).toBe('أمينة بن');
  });

  it('gives nothing for a local part with no letters', () => {
    for (const email of [
      '0555123456@example.com',
      '...@example.com',
      '+tag@example.com',
      '@example.com',
      '',
    ]) {
      expect(displayNameFromEmail(email), email).toBe('');
    }
  });

  it('stops at the 80 characters a typed name may have', () => {
    const name = displayNameFromEmail(
      `${'a'.repeat(50)}.${'b'.repeat(50)}@x.dz`,
    );

    expect(Array.from(name)).toHaveLength(80);
    expect(safeProfileDisplayName(name)).toBe(name);
  });

  it('never ends on the space between two words', () => {
    const name = displayNameFromEmail(`${'a'.repeat(79)}.bb@x.dz`);

    expect(name).toBe(`A${'a'.repeat(78)}`);
  });
});

describe('startingDisplayName', () => {
  it("keeps the name a sign-up brought, as Google's and GitHub's", () => {
    expect(startingDisplayName(' Amina Haddad ', 'ah1990@example.com')).toBe(
      'Amina Haddad',
    );
  });

  it('reads the email when the sign-up brought no usable name', () => {
    for (const name of ['', '  ', 'sara.benali@example.com', 'x'.repeat(81)]) {
      expect(startingDisplayName(name, 'sara.benali@example.com'), name).toBe(
        'Sara Benali',
      );
    }
  });

  it('gives nothing when neither holds a name', () => {
    expect(startingDisplayName('', '0555123456@example.com')).toBe('');
  });
});
