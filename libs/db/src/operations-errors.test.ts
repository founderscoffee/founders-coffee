import { describe, expect, it } from 'vitest';

import {
  OPERATIONS_ERROR_CODES,
  isOperationsErrorCode,
} from './operations-errors.js';

describe('isOperationsErrorCode', () => {
  it('recognises every code in the shared list', () => {
    for (const code of OPERATIONS_ERROR_CODES) {
      expect(isOperationsErrorCode(code)).toBe(true);
    }
  });

  it('refuses a near-miss, which is how two vocabularies drift', () => {
    expect(isOperationsErrorCode('not_eligible')).toBe(false);
    expect(isOperationsErrorCode('ineligible_attendee')).toBe(false);
  });

  it('refuses a string from outside the list entirely', () => {
    expect(isOperationsErrorCode('')).toBe(false);
    expect(isOperationsErrorCode('something_else')).toBe(false);
  });

  it('names a refusal for each repository outcome CO-05 onward must map', () => {
    expect(OPERATIONS_ERROR_CODES).toEqual(
      expect.arrayContaining([
        'not_event_host',
        'event_not_ended',
        'event_cancelled',
        'attendee_not_eligible',
        'closeout_stale_version',
        'feedback_window_closed',
        'operations_disabled',
      ]),
    );
  });
});
