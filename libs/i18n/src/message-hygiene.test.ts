import { describe, expect, it } from 'vitest';

import ar from '../messages/ar.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';

type Variant = { readonly match: Readonly<Record<string, string>> };

type Message = string | readonly Variant[];

const LOCALE_FILES = { ar, en, fr } as Record<
  string,
  Record<string, Message | undefined>
>;

const MARKDOWN_LINK = /\[[^\]]+\]\(\/[^)]+\)/g;

/** Every string a reader can end up seeing, with a message's plural variants flattened out. */
const textsIn = (message: Message): string[] =>
  typeof message === 'string'
    ? [message]
    : message.flatMap((variant) => Object.values(variant.match));

const everyText = (): [string, string, string][] =>
  Object.entries(LOCALE_FILES).flatMap(([locale, messages]) =>
    Object.entries(messages).flatMap(([key, message]) =>
      message === undefined
        ? []
        : textsIn(message).map((text): [string, string, string] => [
            locale,
            key,
            text,
          ]),
    ),
  );

describe('message catalogue hygiene', () => {
  it('reads every locale', () => {
    expect(everyText().length).toBeGreaterThan(1500);
  });

  it('ships no unresolved bracket placeholder', () => {
    for (const [locale, key, text] of everyText()) {
      expect(
        text.replace(MARKDOWN_LINK, ''),
        `${locale}:${key} still carries a bracket placeholder`,
      ).not.toMatch(/\[/);
    }
  });

  it('writes tanwin al-fath one way, with the fatha before the alif', () => {
    for (const [locale, key, text] of everyText()) {
      expect(text, `${locale}:${key} splits tanwin as اً`).not.toMatch(/اً/);
    }
  });

  it('keeps em dashes out of product copy', () => {
    for (const [locale, key, text] of everyText()) {
      expect(text, `${locale}:${key} contains an em dash`).not.toMatch(/—/);
    }
  });

  it('keeps the promise to grow together in every locale, not only in Arabic', () => {
    const together: Record<string, string> = {
      ar: '\u0645\u0639\u064b\u0627',
      fr: 'ensemble',
      en: 'together',
    };
    const subtitles = everyText().filter(([, key]) => key === 'hero_subtitle');
    expect(subtitles).toHaveLength(3);

    for (const [locale, , text] of subtitles) {
      const word = together[locale];
      expect(
        word,
        `${locale} is a new locale with no word recorded for "together" — decide it before shipping the hero`,
      ).toBeDefined();
      if (word === undefined) continue;
      expect(
        text.trimEnd().endsWith(word),
        `the ${locale} hero subtitle stops at growing: Arabic promises founders they grow ${together['ar'] ?? ''}, and a translation that drops the last word makes a quieter promise than the original`,
      ).toBe(true);
    }
  });

  it('holds the hero subtitle to the same shape in every locale', () => {
    const subtitles = everyText().filter(([, key]) => key === 'hero_subtitle');
    expect(subtitles).toHaveLength(3);
    for (const [locale, , text] of subtitles) {
      expect(
        text,
        `${locale} hero subtitle ends in punctuation the others dropped`,
      ).not.toMatch(/[.!?\u061F]$/u);
      expect(
        text,
        `${locale} hero subtitle carries a third clause, so the hero runs taller there`,
      ).not.toMatch(/[,\u060C]/u);
    }
  });
});
