import { describe, expect, it } from 'vitest';

import { buildLeadingTitle, clipAtWord } from './seo-text';

const length = (text: string) => Array.from(text).length;

describe('clipAtWord', () => {
  it('leaves text that fits alone, with its spacing tidied', () => {
    expect(clipAtWord('  Founders   breakfast ', 70)).toBe(
      'Founders breakfast',
    );
  });

  it('cuts at the last whole word, never inside one', () => {
    const clipped = clipAtWord('one two three four five six', 16);

    expect(clipped).toBe('one two three…');
    expect(length(clipped)).toBeLessThanOrEqual(16);
  });

  it('does not leave a separator hanging before the ellipsis', () => {
    expect(clipAtWord('لقاء المؤسسين · الجزائر العاصمة', 17)).toBe(
      'لقاء المؤسسين…',
    );
  });

  it('needs no ellipsis where the cut ends a sentence', () => {
    expect(clipAtWord('A free meetup. And then a very long tail', 17)).toBe(
      'A free meetup.',
    );
  });

  it('still cuts a text with no space in it where the count runs out', () => {
    const clipped = clipAtWord('😀'.repeat(200), 160);

    expect(length(clipped)).toBe(160);
    expect(clipped.endsWith('😀…')).toBe(true);
  });
});

describe('buildLeadingTitle', () => {
  it('leads with the page and names the brand after it when there is room', () => {
    expect(buildLeadingTitle(['لقاء قهوة للمؤسسين', 'الجزائر العاصمة'])).toBe(
      'لقاء قهوة للمؤسسين · الجزائر العاصمة - Founders Coffee',
    );
  });

  it('gives up the brand before the city', () => {
    const title = 'لقاء مفتوح لكل من يبني مشروعًا أو يستعد لإطلاقه';

    expect(buildLeadingTitle([title, 'الجزائر العاصمة'])).toBe(
      `${title} · الجزائر العاصمة`,
    );
  });

  it('gives up the city before cutting into the title', () => {
    const title =
      'A long morning of coffee and honest talk for people building things';

    expect(buildLeadingTitle([title, 'Algiers'])).toBe(title);
  });

  it('cuts a title too long on its own at a whole word', () => {
    const title =
      'A very long morning of coffee and honest talk for people who are building companies in Algiers';
    const built = buildLeadingTitle([title, 'Algiers']);

    expect(length(built)).toBeLessThanOrEqual(70);
    expect(built.endsWith('…')).toBe(true);
    expect(title.startsWith(built.slice(0, -1))).toBe(true);
    expect(title.charAt(built.length - 1)).toBe(' ');
  });

  it('does not name the brand twice', () => {
    expect(buildLeadingTitle(['Founders Coffee Algiers #3', 'Algiers'])).toBe(
      'Founders Coffee Algiers #3 · Algiers',
    );
  });

  it('falls back to the brand when there is nothing else to say', () => {
    expect(buildLeadingTitle(['  ', ''])).toBe('Founders Coffee');
  });
});
