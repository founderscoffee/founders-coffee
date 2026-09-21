import { describe, expect, it } from 'vitest';

import glossary from '../glossary.json';
import ar from '../messages/ar.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';

type Variant = { readonly match: Readonly<Record<string, string>> };

type Message = string | readonly Variant[];

type Entry = {
  readonly canonical: string | null;
  readonly decide?: string;
  readonly banned: readonly string[];
  readonly why: string;
  readonly allow: Readonly<Record<string, string>>;
};

const LOCALE_FILES = { ar, en, fr } as Record<
  string,
  Record<string, Message | undefined>
>;

const GLOSSARY = glossary as Record<string, readonly Entry[]>;

const textsIn = (message: Message): string[] =>
  typeof message === 'string'
    ? [message]
    : message.flatMap((variant) => Object.values(variant.match));

const everyTextIn = (locale: string): [string, string][] =>
  Object.entries(LOCALE_FILES[locale] ?? {}).flatMap(([key, message]) =>
    message === undefined
      ? []
      : textsIn(message).map((text): [string, string] => [key, text]),
  );

/**
 * Harakat, tatweel, markup and placeholders removed, and the alif written one way.
 *
 * A catalogue is authored by people, so the same word arrives spelled several ways: أ and ا in the
 * same position, a tanwin that is present in one string and absent in the next, an email template
 * where the word is glued to `</p>`. Comparing raw strings would make the gate depend on which of
 * those a writer happened to use.
 */
const normalise = (text: string): string =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا');

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

const PREFIXES = [
  'وال',
  'فال',
  'بال',
  'كال',
  'لل',
  'ال',
  'و',
  'ف',
  'ب',
  'ك',
  'ل',
];

/**
 * One token, written as every word it could be once Arabic's glued-on particles are taken off.
 *
 * Arabic attaches its conjunctions, prepositions and article to the front of a word, so a match has
 * to see past them — and must stop there. Stripping a prefix and requiring the remainder to equal a
 * banned form *exactly* is what separates this from a substring search. Measured on today's
 * `ar.json`, a substring ban on قادم hits nine strings of which six are the unrelated القادمة and
 * قادمًا, meaning upcoming rather than the RSVP status; a ban on شارك hits eighteen of which sixteen
 * are مشارك and مشاركة, participant and participation. Those share a root with the banned word and
 * are not the banned word.
 *
 * م is deliberately absent from `PREFIXES`. It is what forms مشارك from شارك, and stripping it is
 * exactly the over-reach that produced those sixteen.
 */
const formsOf = (token: string): string[] => {
  const bare = token.replace(EDGE_PUNCTUATION, '');
  const stripped = PREFIXES.filter(
    (prefix) => bare.startsWith(prefix) && bare.length - prefix.length >= 3,
  ).map((prefix) => bare.slice(prefix.length));
  return [bare, ...stripped];
};

/** A phrase is matched as written; a single word is matched as a word, prefixes allowed. */
const carries = (text: string, banned: string): boolean => {
  const body = normalise(text);
  if (banned.includes(' ')) return body.includes(normalise(banned));
  const wanted = normalise(banned);
  return body.split(/\s+/).some((token) => formsOf(token).includes(wanted));
};

const entries = (): [string, Entry][] =>
  Object.entries(GLOSSARY).flatMap(([locale, list]) =>
    list.map((entry): [string, Entry] => [locale, entry]),
  );

const hits = (locale: string, entry: Entry): [string, string][] =>
  everyTextIn(locale).flatMap(([key, text]) =>
    entry.banned
      .filter((banned) => carries(text, banned))
      .map((banned): [string, string] => [key, banned]),
  );

describe('terminology glossary', () => {
  it('reads a glossary with something in it', () => {
    expect(entries().length).toBeGreaterThan(0);
    expect(everyTextIn('ar').length).toBeGreaterThan(500);
  });

  it('records a decision, or the question standing in its way', () => {
    for (const [locale, entry] of entries()) {
      const named = entry.canonical ?? entry.banned.join('/');
      if (entry.canonical === null)
        expect(
          entry.decide,
          `${locale}:${named} has no canonical term and no note saying what has to be decided — an undecided entry with no question is one nobody will come back to`,
        ).toBeTruthy();
      expect(entry.why, `${locale}:${named} has no reason`).toBeTruthy();
      expect(
        entry.banned.length,
        `${locale}:${named} bans nothing`,
      ).toBeGreaterThan(0);
    }
  });

  it('never bans the canonical term itself', () => {
    for (const [locale, entry] of entries()) {
      if (entry.canonical === null) continue;
      expect(
        entry.banned.some((banned) => carries(entry.canonical ?? '', banned)),
        `${locale}:${entry.canonical} is banned by its own entry`,
      ).toBe(false);
    }
  });

  it('uses no banned synonym the glossary has not excused', () => {
    const violations = entries().flatMap(([locale, entry]) =>
      entry.canonical === null
        ? []
        : hits(locale, entry)
            .filter(([key]) => !(key in entry.allow))
            .map(
              ([key, banned]) =>
                `${locale}:${key} uses "${banned}" where the glossary says "${entry.canonical}" — ${entry.why}`,
            ),
    );

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('carries a reason for every key it excuses', () => {
    for (const [locale, entry] of entries())
      for (const [key, reason] of Object.entries(entry.allow))
        expect(
          reason.trim(),
          `${locale}:${key} is excused without saying why`,
        ).not.toBe('');
  });

  /**
   * The half that makes the backlog shrink.
   *
   * Every `allow` line is either a defect waiting to be renamed or a genuine exception. Both stop
   * being true eventually, and an exclusion that outlives its reason silently re-opens the hole it
   * was cut for. Failing on a stale one means the person who fixes the wording is told to delete
   * the excuse in the same change, by the same test run.
   */
  it('holds no exclusion whose reason has passed', () => {
    for (const [locale, entry] of entries())
      for (const key of Object.keys(entry.allow)) {
        const texts = everyTextIn(locale).filter(
          ([candidate]) => candidate === key,
        );
        expect(
          texts.length,
          `${locale}:${key} is excused but no longer exists — delete the line`,
        ).toBeGreaterThan(0);
        expect(
          texts.some(([, text]) =>
            entry.banned.some((banned) => carries(text, banned)),
          ),
          `${locale}:${key} is excused but no longer uses any banned term — delete the line`,
        ).toBe(true);
      }
  });
});
