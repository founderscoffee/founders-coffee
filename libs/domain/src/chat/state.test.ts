import { describe, expect, it } from 'vitest';

import { chatState } from './state.js';

const readOnlyAt = new Date('2026-10-07T12:00:00Z');

describe('whether a chat takes messages', () => {
  it('is open until the moment it turns read-only', () => {
    expect(
      chatState({ readOnlyAt }, new Date('2026-10-07T11:59:59.999Z')),
    ).toBe('open');
  });

  it('is read-only from that moment on', () => {
    expect(chatState({ readOnlyAt }, readOnlyAt)).toBe('read_only');
    expect(chatState({ readOnlyAt }, new Date('2026-12-01T00:00:00Z'))).toBe(
      'read_only',
    );
  });
});
