import { describe, expect, it } from 'vitest';

import { ISO_STATE_CODES } from './admin-codes.js';
import { getStates, stateCodeForIso } from './index.js';

const MARKETS = ['DZ', 'EG', 'SA'] as const;

describe('ISO region code table', () => {
  it.each(MARKETS)('maps every %s state exactly once', (market) => {
    const table = ISO_STATE_CODES[market];
    expect(table).toBeDefined();
    const ours = Object.values(table);
    const states = getStates(market).map((state) => state.code);

    expect(new Set(ours).size).toBe(ours.length);
    expect(new Set(ours)).toEqual(new Set(states));
  });

  it.each(MARKETS)('uses %s-prefixed ISO keys and nothing else', (market) => {
    for (const iso of Object.keys(ISO_STATE_CODES[market])) {
      expect(iso.startsWith(`${market}-`)).toBe(true);
    }
  });

  it('resolves a known code and refuses an unknown one', () => {
    expect(stateCodeForIso('DZ', 'DZ-16')).toBe('16');
    expect(stateCodeForIso('EG', 'EG-C')).toBe('1');
    expect(stateCodeForIso('DZ', 'DZ-99')).toBeUndefined();
    expect(stateCodeForIso('XX', 'XX-01')).toBeUndefined();
  });

  it('keeps the codes that disagree with ours, which is why the table exists', () => {
    expect(stateCodeForIso('DZ', 'DZ-57')).toBe('53');
    expect(stateCodeForIso('SA', 'SA-05')).toBe('4');
  });
});
