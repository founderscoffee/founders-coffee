import { describe, expect, it } from 'vitest';

import { firstCharacter, initials } from './utils';

describe('initials', () => {
  it('takes the first letter of the first two words, capitalised', () => {
    expect(initials('amina benali')).toBe('AB');
    expect(initials('Amina  Benali Haddad')).toBe('AB');
    expect(initials('أمينة بن علي')).toBe('أب');
  });

  it('keeps a letter outside the Basic Multilingual Plane whole', () => {
    expect(initials('🚀 Rocket Founders')).toBe('🚀R');
    expect(initials('𝐀mina 𝐁enali')).toBe('𝐀𝐁');
  });

  it('gives nothing for a name with no letters in it', () => {
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });
});

describe('firstCharacter', () => {
  it('returns the whole first character, never half of one', () => {
    expect(firstCharacter('😀 Founder')).toBe('😀');
    expect(firstCharacter('Founder')).toBe('F');
    expect(firstCharacter('')).toBe('');
  });
});
