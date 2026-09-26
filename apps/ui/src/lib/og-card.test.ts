import { describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { eventCardText, eventCardTree, type CardNode } from './og-card';

type Line = {
  readonly words: readonly string[];
  readonly style: Record<string, unknown>;
};

const childNodes = (node: CardNode): CardNode[] =>
  Array.isArray(node.props.children) ? (node.props.children as CardNode[]) : [];

const word = (node: CardNode): string | null =>
  typeof node.props.children === 'string' ? node.props.children : null;

const lines = (node: CardNode): Line[] => {
  const children = childNodes(node);
  const words = children.map(word);
  if (words.length > 0 && words.every((one) => one !== null)) {
    return [
      {
        words: words as string[],
        style: node.props.style as Record<string, unknown>,
      },
    ];
  }
  return children.flatMap(lines);
};

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
