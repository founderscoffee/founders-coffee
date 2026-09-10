import { describe, expect, it } from 'vitest';

import { isAuditAction } from './enum-schemas.js';

describe('isAuditAction', () => {
  it('recognises an action this codebase writes', () => {
    expect(isAuditAction('closeout_submitted')).toBe(true);
    expect(isAuditAction('host_trust_updated')).toBe(true);
  });

  it('refuses one that no writer emits, however plausible it reads', () => {
    expect(isAuditAction('feedback_submitted')).toBe(false);
    expect(isAuditAction('user_moderated')).toBe(false);
  });

  it('refuses a value from outside the enum entirely', () => {
    expect(isAuditAction('rm -rf')).toBe(false);
  });
});
