import { describe, expect, it } from 'vitest';

import { getEvent, getMarketByCode } from '@founders-coffee/db';

import { createEventResolver } from './resolver.js';
import {
  createInput,
  rawCreateInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
  validationErrorFor,
} from './resolver.fixtures.js';
import { apply, hostAnEvent } from './update.fixtures.js';

const created = async (languages: readonly string[]) => {
  const db = await setupDb();
  const result = await createEventResolver(
    db,
    testMapProvider,
    TEST_HOST_ID,
    createInput({ languages }),
  );
  if (!result.ok) throw result.error;
  return { db, stored: await getEvent(db, result.data.id) };
};

describe('the languages a new meetup is held in', () => {
  it('keeps every one the host picked, in the order they were picked', async () => {
    const { stored } = await created(['ber', 'en', 'fr']);

    expect(stored?.languages).toEqual(['ber', 'en', 'fr']);
  });

  it('files it under the first of them the site has pages in', async () => {
    const { stored } = await created(['ber', 'en', 'fr']);

    expect(
      stored?.language,
      'the lead language picks the calendar entry and the feed address, and each needs a page to point at',
    ).toBe('en');
  });

  it('files one held only in languages the site has no pages in under its market’s language', async () => {
    const { db, stored } = await created(['de', 'es']);

    expect(stored?.language).toBe(
      (await getMarketByCode(db, 'DZ'))?.defaultLocale,
    );
  });

  it('refuses a meetup held in no language at all', () => {
    expect(validationErrorFor(rawCreateInput({ languages: [] }))?.code).toBe(
      'validation_failed',
    );
  });
});

describe('the languages an edited meetup is held in', () => {
  it('moves the lead language with the list', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    const result = await apply(db, event, { languages: ['ar', 'fr'] });

    expect(result.ok).toBe(true);
    expect(await getEvent(db, event.id)).toMatchObject({
      language: 'ar',
      languages: ['ar', 'fr'],
    });
  });

  it('keeps the lead language when the new list names none the site has pages in', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    await apply(db, event, { languages: ['ber'] });

    expect(await getEvent(db, event.id)).toMatchObject({
      language: event.language,
      languages: ['ber'],
    });
  });
});
