import { describe, expect, it } from 'vitest';

import { operations } from '@founders-coffee/domain';

import { canSubmit, draftFrom, toRequest, totalsFor } from './draft';

const { WALK_IN_MAX } = operations;
import type { CloseoutView } from './api';

const view = (overrides: Partial<CloseoutView> = {}): CloseoutView => ({
  eventId: 'evt_1',
  outcome: null,
  version: 0,
  walkInCount: 0,
  roster: [
    { userId: 'usr_a', name: 'A', outcome: null },
    { userId: 'usr_b', name: 'B', outcome: null },
  ],
  registeredAttended: 0,
  totalAttended: 0,
  ...overrides,
});

const base = draftFrom(view());

describe('draftFrom', () => {
  it('starts blank when nobody has been marked', () => {
    expect(draftFrom(view()).marks).toEqual({});
  });

  it('carries marks already recorded, so reopening does not erase them', () => {
    const existing = view({
      roster: [{ userId: 'usr_a', name: 'A', outcome: 'attended' }],
      walkInCount: 2,
    });

    expect(draftFrom(existing).marks).toEqual({ usr_a: 'attended' });
    expect(draftFrom(existing).walkInCount).toBe(2);
  });
});

describe('the totals a host sees before submitting', () => {
  it('counts only the people marked as having come', () => {
    const draft = {
      ...base,
      marks: { usr_a: 'attended' as const, usr_b: 'no_show' as const },
    };

    expect(totalsFor(draft)).toEqual({ registered: 1, total: 1 });
  });

  it('adds walk-ins to the total but not to the registered count', () => {
    const draft = {
      ...base,
      marks: { usr_a: 'attended' as const },
      walkInCount: 3,
    };

    expect(totalsFor(draft)).toEqual({ registered: 1, total: 4 });
  });

  it('treats an unmarked person as unsaid, never as an absence', () => {
    expect(totalsFor(base)).toEqual({ registered: 0, total: 0 });
  });
});

describe('what may be submitted', () => {
  it('refuses a draft with no outcome chosen', () => {
    expect(canSubmit(base)).toBe(false);
  });

  it('accepts a held gathering with nobody marked', () => {
    expect(canSubmit({ ...base, outcome: 'held' })).toBe(true);
  });

  it('refuses walk-ins at a gathering that did not happen', () => {
    expect(
      canSubmit({ ...base, outcome: 'did_not_happen', walkInCount: 1 }),
    ).toBe(false);
  });

  it('refuses “something else” without the note that explains it', () => {
    const draft = {
      ...base,
      outcome: 'held' as const,
      friction: ['other_structured'] as const,
    };

    expect(canSubmit(draft)).toBe(false);
    expect(canSubmit({ ...draft, privateNote: 'the café closed' })).toBe(true);
  });

  it('does not accept whitespace as an explanation', () => {
    expect(
      canSubmit({
        ...base,
        outcome: 'held',
        friction: ['other_structured'] as const,
        privateNote: '   ',
      }),
    ).toBe(false);
  });
});

describe('the request that goes to the server', () => {
  it('sends the marks for a gathering that happened', () => {
    const draft = {
      ...base,
      outcome: 'held' as const,
      marks: { usr_a: 'attended' as const },
    };

    expect(toRequest('evt_1', draft).attendance).toEqual([
      { userId: 'usr_a', outcome: 'attended' },
    ]);
  });

  it('strips marks and walk-ins when the gathering did not happen', () => {
    const draft = {
      ...base,
      outcome: 'did_not_happen' as const,
      marks: { usr_a: 'attended' as const },
      walkInCount: 4,
    };
    const request = toRequest('evt_1', draft);

    expect(request.attendance).toEqual([]);
    expect(request.closeout.walkInCount).toBe(0);
  });

  it('omits an empty note rather than sending one', () => {
    const request = toRequest('evt_1', { ...base, outcome: 'held' });

    expect(request.closeout).not.toHaveProperty('privateNote');
  });

  it('trims the note it does send', () => {
    const request = toRequest('evt_1', {
      ...base,
      outcome: 'held',
      privateNote: '  the café closed  ',
    });

    expect(request.closeout.privateNote).toBe('the café closed');
  });
});

describe('the walk-in bound', () => {
  it('refuses more walk-ins than the domain allows', () => {
    expect(
      canSubmit({ ...base, outcome: 'held', walkInCount: WALK_IN_MAX }),
    ).toBe(true);
    expect(
      canSubmit({ ...base, outcome: 'held', walkInCount: WALK_IN_MAX + 1 }),
    ).toBe(false);
  });
});
