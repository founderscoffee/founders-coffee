import { describe, expect, it } from 'vitest';

import { toPushTopic } from './push-provider.js';

describe('toPushTopic', () => {
  it('passes an ordinary notification id through unchanged apart from its prefix', () => {
    const key = `ntf_${'a1b2c3d4'.repeat(4)}`;
    expect(toPushTopic(key)).toBe('a1b2c3d4'.repeat(4));
  });

  it('stays inside the Web Push topic character set and length', () => {
    const topic = toPushTopic('ntf_/+=@#$ 8f3b!c9d');
    expect(topic).toMatch(/^[A-Za-z0-9\-_]*$/);
    expect(topic.length).toBeLessThanOrEqual(32);
  });

  it('does not collapse two different keys onto one topic', () => {
    const a = toPushTopic(`ntf_${'0'.repeat(31)}1`);
    const b = toPushTopic(`ntf_${'0'.repeat(31)}2`);
    expect(a).not.toBe(b);
  });
});
