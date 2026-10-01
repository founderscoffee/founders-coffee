import { describe, expect, it } from 'vitest';

import { liveRoomEventId } from './path.js';

describe('liveRoomEventId', () => {
  it('reads the meetup from the path the browser opens', () => {
    expect(liveRoomEventId('/api/live/evt_7f3a')).toBe('evt_7f3a');
  });

  it.each([
    '/api/live/',
    '/api/live/evt_7f3a/',
    '/api/live/evt_7f3a/evt_elsewhere',
    '/api/live//evt_7f3a',
    '/api/lively/evt_7f3a',
    '/ar/api/live/evt_7f3a',
  ])('names no meetup for %s', (pathname) => {
    expect(liveRoomEventId(pathname)).toBeNull();
  });
});
