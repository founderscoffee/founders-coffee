import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INSTALL_RECORD_KEY,
  readInstallRecord,
  recordInstallOutcome,
} from './install-record';

const FIRST_VISIT = 1_700_000_000_000;

const stored = (): unknown =>
  JSON.parse(localStorage.getItem(INSTALL_RECORD_KEY) ?? 'null');

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('what a browser remembers about the install sheet', () => {
  it('starts a record on the first visit, with nothing answered', () => {
    expect(readInstallRecord(FIRST_VISIT)).toEqual({
      firstSeenAt: FIRST_VISIT,
      outcome: null,
    });
    expect(stored()).toEqual({ firstSeenAt: FIRST_VISIT, outcome: null });
  });

  it('keeps the first visit’s time on every later read', () => {
    readInstallRecord(FIRST_VISIT);

    expect(readInstallRecord(FIRST_VISIT + 86_400_000)).toEqual({
      firstSeenAt: FIRST_VISIT,
      outcome: null,
    });
  });

  it.each(['dismissed', 'installed'] as const)(
    'remembers a sheet %s for good',
    (outcome) => {
      readInstallRecord(FIRST_VISIT);
      recordInstallOutcome(outcome, FIRST_VISIT + 30_000);

      expect(readInstallRecord(FIRST_VISIT + 86_400_000)).toEqual({
        firstSeenAt: FIRST_VISIT,
        outcome,
      });
    },
  );

  it('remembers an answer even when the record had gone missing', () => {
    recordInstallOutcome('dismissed', FIRST_VISIT);

    expect(stored()).toEqual({
      firstSeenAt: FIRST_VISIT,
      outcome: 'dismissed',
    });
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['a record of another shape', JSON.stringify({ dismissed: true })],
  ])('starts over from %s', (_kind, value) => {
    localStorage.setItem(INSTALL_RECORD_KEY, value);

    expect(readInstallRecord(FIRST_VISIT)).toEqual({
      firstSeenAt: FIRST_VISIT,
      outcome: null,
    });
  });

  it('reports a browser that cannot keep the record, so the sheet stays closed there', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(
      readInstallRecord(FIRST_VISIT),
      'a "No thanks" this browser cannot keep would bring the sheet back on the next page',
    ).toBeNull();
    expect(() => recordInstallOutcome('dismissed', FIRST_VISIT)).not.toThrow();
  });
});
