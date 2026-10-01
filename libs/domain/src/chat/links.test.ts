import { describe, expect, it } from 'vitest';

import { chatBodySegments } from './links.js';

const joined = (body: string): string =>
  chatBodySegments(body)
    .map((segment) => segment.text)
    .join('');

const links = (body: string) =>
  chatBodySegments(body).filter((segment) => segment.kind === 'link');

describe('the addresses in a chat message', () => {
  it('leaves a message with no address as one piece of text', () => {
    expect(chatBodySegments('نلتقي عند الباب')).toEqual([
      { kind: 'text', text: 'نلتقي عند الباب' },
    ]);
  });

  it('links http and https addresses where they stand in the text', () => {
    expect(
      chatBodySegments(
        'Slides: https://example.com/deck and http://old.example',
      ),
    ).toEqual([
      { kind: 'text', text: 'Slides: ' },
      {
        kind: 'link',
        text: 'https://example.com/deck',
        href: 'https://example.com/deck',
      },
      { kind: 'text', text: ' and ' },
      { kind: 'link', text: 'http://old.example', href: 'http://old.example/' },
    ]);
  });

  it.each([
    ['See https://example.com.', 'https://example.com'],
    ['Is it https://example.com/a?', 'https://example.com/a'],
    ['«https://example.com/b»', 'https://example.com/b'],
    ['زوروا https://example.com/c، ثم تعالوا', 'https://example.com/c'],
    ['هل رأيت https://example.com/d؟', 'https://example.com/d'],
    ['(https://example.com/e)', 'https://example.com/e'],
  ])('leaves the punctuation around an address out of it: %s', (body, text) => {
    expect(links(body).map((link) => link.text)).toEqual([text]);
  });

  it('keeps a closing bracket the address itself opened', () => {
    expect(
      links('Read https://en.wikipedia.org/wiki/Cafe_(disambiguation).'),
    ).toEqual([
      {
        kind: 'link',
        text: 'https://en.wikipedia.org/wiki/Cafe_(disambiguation)',
        href: 'https://en.wikipedia.org/wiki/Cafe_(disambiguation)',
      },
    ]);
  });

  it('links an address written in Arabic to its encoded form', () => {
    expect(links('https://ar.wikipedia.org/wiki/قهوة')).toEqual([
      {
        kind: 'link',
        text: 'https://ar.wikipedia.org/wiki/قهوة',
        href: 'https://ar.wikipedia.org/wiki/%D9%82%D9%87%D9%88%D8%A9',
      },
    ]);
  });

  it.each([
    'javascript:alert(1)',
    'www.example.com',
    'ftp://files.example.com',
    'https://',
    'https://[not-a-host',
    'mailto:someone@example.com',
  ])('does not link %s', (body) => {
    expect(links(body)).toEqual([]);
    expect(joined(body)).toBe(body);
  });

  it('gives back the body exactly when its pieces are put together', () => {
    const body =
      'قبل https://a.example/x، (https://b.example/y) وبعد https://c.example.';

    expect(joined(body)).toBe(body);
    expect(links(body)).toHaveLength(3);
  });
});
