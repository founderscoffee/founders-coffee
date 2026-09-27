import { describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { eventCardText, eventCardTree } from './og-card';
import type { CardNode } from './og-line';

type Line = {
  readonly words: readonly string[];
  readonly boxes: readonly CardNode[];
  readonly style: Record<string, unknown>;
};

const childNodes = (node: CardNode): CardNode[] =>
  Array.isArray(node.props.children) ? (node.props.children as CardNode[]) : [];

const styleOf = (node: CardNode): Record<string, unknown> =>
  (node.props.style as Record<string, unknown> | undefined) ?? {};

const pieces = (node: CardNode): string[] =>
  typeof node.props.children === 'string'
    ? [node.props.children]
    : childNodes(node).flatMap(pieces);

const word = (node: CardNode): string => pieces(node).join('');

const drawn = (node: CardNode): string[] =>
  styleOf(node).flexDirection === 'row-reverse'
    ? pieces(node).reverse()
    : pieces(node);

const lines = (node: CardNode): Line[] =>
  typeof styleOf(node).fontSize === 'number'
    ? [
        {
          words: childNodes(node).map(word),
          boxes: childNodes(node),
          style: styleOf(node),
        },
      ]
    : childNodes(node).flatMap(lines);

const emptyBoxes = (node: CardNode): number =>
  (Array.isArray(node.props.children) && node.props.children.length === 0
    ? 1
    : 0) +
  childNodes(node).reduce((count, child) => count + emptyBoxes(child), 0);

const tree = (over: Partial<Parameters<typeof eventCardTree>[0]> = {}) =>
  eventCardTree({
    locale: 'ar',
    title: 'لقاء قهوة للمؤسسين',
    meta: 'الجمعة، 25 سبتمبر · 18:00 · الجزائر العاصمة',
    host: 'ياسين بن علي',
    ...over,
  });

const card = (over: Partial<Parameters<typeof eventCardTree>[0]> = {}) =>
  lines(tree(over));

const titleLine = (over: Partial<Parameters<typeof eventCardTree>[0]> = {}) =>
  card(over)[1];

describe('eventCardTree', () => {
  it('gives every word a box of its own', () => {
    for (const line of card()) {
      for (const one of line.words) expect(one).not.toContain(' ');
      expect(line.words.length).toBeGreaterThan(0);
    }
  });

  it('draws a right-to-left line from the right, in written order', () => {
    expect(titleLine().style.flexDirection).toBe('row-reverse');
    expect(titleLine().words).toEqual(['لقاء', 'قهوة', 'للمؤسسين']);
  });

  it('turns a Latin run around so a right-to-left line reads it forwards', () => {
    expect(titleLine({ title: 'لقاء مع Founders Coffee' }).words).toEqual([
      'لقاء',
      'مع',
      'Coffee',
      'Founders',
    ]);
  });

  it('turns a right-to-left run around inside a left-to-right line', () => {
    expect(
      titleLine({ locale: 'fr', title: 'Rencontre لقاء قهوة tonight' }).words,
    ).toEqual(['Rencontre', 'قهوة', 'لقاء', 'tonight']);
    expect(
      titleLine({ locale: 'fr', title: 'Rencontre لقاء قهوة tonight' }).style
        .flexDirection,
    ).toBe('row');
  });

  it('leaves the words of a wrapping line in written order', () => {
    const many = Array.from({ length: 14 }, (_, n) => `كلمة${n}`);
    expect(titleLine({ title: many.join(' ') }).words).toEqual(many);
  });

  it('hangs a line off the margin the card reads from, not the line', () => {
    expect(titleLine().style.justifyContent).toBe('flex-start');
    expect(card()[0].words).toEqual(['Founders', 'Coffee']);
    expect(card()[0].style.justifyContent).toBe('flex-end');
  });

  it('pushes a right-to-left line across to a left-to-right card margin', () => {
    const french = titleLine({ locale: 'fr' });
    expect(french.style.flexDirection).toBe('row-reverse');
    expect(french.style.justifyContent).toBe('flex-end');
  });

  it('sets a long title smaller so it stays on the card', () => {
    const size = (title: string) => titleLine({ title }).style.fontSize;
    expect(size('x'.repeat(40))).toBe(76);
    expect(size('x'.repeat(41))).toBe(60);
    expect(size('x'.repeat(72))).toBe(60);
    expect(size('x'.repeat(73))).toBe(50);
    expect(size('x'.repeat(100))).toBe(50);
    expect(size('x'.repeat(101))).toBe(44);
  });

  it('leaves out the host line when there is no host to name', () => {
    expect(card()).toHaveLength(4);
    expect(card({ host: '' })).toHaveLength(3);
    expect(emptyBoxes(tree())).toBe(0);
    expect(emptyBoxes(tree({ host: '' }))).toBe(0);
  });
});

const seen = (line: Line): string[] => [...line.boxes].reverse().flatMap(drawn);

describe('punctuation at the edge of an Arabic word', () => {
  it.each([':', '،', '؟', '.'])(
    'draws a closing %s on the left of its word, where the word ends',
    (mark) => {
      const title = titleLine({ title: `قهوة ونقاش${mark} تمويل` });

      expect(title.words).toEqual(['قهوة', `ونقاش${mark}`, 'تمويل']);
      expect(
        drawn(title.boxes[1]),
        'the card drew قهوة :ونقاش, with the mark on the side the word begins',
      ).toEqual([mark, 'ونقاش']);
    },
  );

  it('keeps several closing marks in the order they were written', () => {
    expect(drawn(titleLine({ title: 'لقاء حقًا؟!' }).boxes[1])).toEqual([
      '!',
      '؟',
      'حقًا',
    ]);
  });

  it('turns brackets to face the words they enclose', () => {
    expect(
      seen(titleLine({ title: 'لقاء (قرب النافذة)' })),
      'read from the left, the bracket drawn first has to open towards the words after it',
    ).toEqual(['(', 'النافذة', 'قرب', ')', 'لقاء']);
  });

  it('marks the date line’s comma the same way', () => {
    expect(drawn(card()[2].boxes[0])).toEqual(['،', 'الجمعة']);
  });

  it('leaves a word with nothing at its edges, or nothing but marks, whole', () => {
    const title = titleLine({ title: 'قهوة - نقاش' });

    expect(title.boxes.map((box) => box.props.children)).toEqual([
      'قهوة',
      '-',
      'نقاش',
    ]);
  });

  it('leaves an Arabic word on a left-to-right line to satori', () => {
    const title = titleLine({ locale: 'fr', title: 'Rencontre لقاء: ce soir' });

    expect(
      title.boxes[1]?.props.children,
      'after an Arabic word, a left-to-right line puts the colon on its right, where satori draws it',
    ).toBe('لقاء:');
  });
});

describe('eventCardText', () => {
  const facts = {
    title: 'لقاء قهوة للمؤسسين',
    startsAt: new Date('2026-09-25T17:00:00.000Z'),
    timezone: 'Africa/Algiers',
    city: { name: 'Algiers', nameAr: 'الجزائر العاصمة', nameFr: 'Alger' },
    hostName: 'Amine Yagoub',
  };

  it('tells the time on the market clock, not the one drawing it', () => {
    const algiers = eventCardText({ ...facts, locale: 'en' });
    const riyadh = eventCardText({
      ...facts,
      locale: 'en',
      timezone: 'Asia/Riyadh',
    });
    expect(algiers.meta).toContain('18:00');
    expect(riyadh.meta).toContain('20:00');
  });

  it('names the city in the language the card is read in', () => {
    expect(eventCardText({ ...facts, locale: 'ar' }).meta).toContain(
      'الجزائر العاصمة',
    );
    expect(eventCardText({ ...facts, locale: 'en' }).meta).toMatch(
      / · Algiers$/u,
    );
    expect(
      eventCardText({ ...facts, locale: 'fr' }).meta,
      'a card shared in French said Algiers, where the page it opens says Alger',
    ).toMatch(/ · Alger$/u);
  });

  it('carries the title and host through untouched', () => {
    const text = eventCardText({ ...facts, locale: 'ar' });
    expect(text.title).toBe(facts.title);
    expect(text.host).toBe(facts.hostName);
  });

  it.each<Locale>(['ar', 'en', 'fr'])(
    'writes a day, a clock and a place in %s',
    (locale) => {
      const text = eventCardText({ ...facts, locale });
      expect(text.locale).toBe(locale);
      expect(text.meta.split(' · ')).toHaveLength(3);
    },
  );
});
