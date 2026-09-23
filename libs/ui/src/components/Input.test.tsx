import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from './Input.js';

const field = (props: Record<string, unknown> = {}) =>
  render(<Input {...props} />).container.querySelector('input');

afterEach(cleanup);

describe('which way a field reads', () => {
  it.each(['email', 'url', 'tel'])(
    'writes a %s field left to right whatever the page direction is',
    (type) => {
      expect(
        field({ type })?.getAttribute('dir'),
        'an address, a link and a number are left-to-right wherever they are written; inheriting rtl from an Arabic page puts the caret and any mixed content in the wrong place',
      ).toBe('ltr');
    },
  );

  it.each(['numeric', 'decimal', 'email', 'url', 'tel'])(
    'does the same for a field asking for a %s keyboard',
    (inputMode) => {
      expect(field({ inputMode })?.getAttribute('dir')).toBe('ltr');
    },
  );

  it('leaves prose alone, which follows the page', () => {
    expect(
      field({ type: 'text' })?.getAttribute('dir'),
      'a name or a title is written in the language of the page and has to follow it',
    ).toBeNull();
  });

  it('lets the caller say otherwise', () => {
    expect(field({ type: 'email', dir: 'auto' })?.getAttribute('dir')).toBe(
      'auto',
    );
  });
});
