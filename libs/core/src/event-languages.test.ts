import { describe, expect, it } from 'vitest';

import { eventLanguages } from './event-languages.js';

describe('the languages a stored meetup is held in', () => {
  it('are the ones the host listed, in their order', () => {
    expect(eventLanguages({ languages: ['fr', 'ar'], language: 'fr' })).toEqual(
      ['fr', 'ar'],
    );
  });

  it('are its lead language alone when a rolled-back Worker left the list empty', () => {
    expect(
      eventLanguages({ languages: [], language: 'ar' }),
      'an empty list put the meetup under no language filter and left its card without one',
    ).toEqual(['ar']);
  });
});
