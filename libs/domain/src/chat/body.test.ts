import { describe, expect, it } from 'vitest';

import {
  CHAT_MESSAGE_MAX_LENGTH,
  chatMessageBodySchema,
  normalizeChatBody,
} from './body.js';

describe('a chat message body', () => {
  it('keeps an ordinary message as it was typed', () => {
    expect(normalizeChatBody('نلتقي عند الباب، see you at 10!')).toBe(
      'نلتقي عند الباب، see you at 10!',
    );
  });

  it('is one line: every line break and tab becomes a space', () => {
    expect(
      normalizeChatBody('first\r\nsecond\nthird\u2028fourth\tfifth\u0085sixth'),
    ).toBe('first second third fourth fifth sixth');
  });

  it('drops control characters, zero-width spaces and byte-order marks', () => {
    expect(normalizeChatBody('\u0000he\u0007llo\u200b\ufeff\u009b')).toBe(
      'hello',
    );
  });

  it('drops the direction overrides that could make an address read as another', () => {
    expect(
      normalizeChatBody(
        'https://safe.example/\u202egnp.exe\u202c \u2067x\u2069 \u202ay\u202c',
      ),
    ).toBe('https://safe.example/gnp.exe x y');
  });

  it('keeps the direction marks and joiners that writing needs', () => {
    const body = 'رقم\u200f 12 \u200e\u061c 👩\u200d💻 می\u200cخواهم';

    expect(normalizeChatBody(body)).toBe(body);
  });

  it('trims the space around it', () => {
    expect(normalizeChatBody(' \n  hello \t ')).toBe('hello');
  });

  it('refuses a body with nothing visible left in it', () => {
    expect(chatMessageBodySchema.safeParse(' \n\u200b\ufeff ').success).toBe(
      false,
    );
  });

  it('takes up to the limit and refuses one character more', () => {
    const longest = 'ق'.repeat(CHAT_MESSAGE_MAX_LENGTH);

    expect(chatMessageBodySchema.parse(`  ${longest}  `)).toBe(longest);
    expect(chatMessageBodySchema.safeParse(`${longest}ق`).success).toBe(false);
  });

  it('refuses an input far past the limit before reading it through', () => {
    expect(
      chatMessageBodySchema.safeParse(' '.repeat(CHAT_MESSAGE_MAX_LENGTH * 5))
        .success,
    ).toBe(false);
  });
});
