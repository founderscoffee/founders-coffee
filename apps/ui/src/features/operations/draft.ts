import { operations } from '@founders-coffee/domain';
import type { AttendanceOutcome, CloseoutOutcome } from '@founders-coffee/core';

import type { CloseoutView } from './api';

export type Friction = operations.HostFriction;

export const WALK_IN_MAX = operations.WALK_IN_MAX;

export const FRICTIONS: readonly Friction[] = [
  'venue',
  'scheduling',
  'promotion',
  'attendance',
  'format',
  'safety',
  'other_structured',
];

export type Mark = AttendanceOutcome;

export interface CloseoutDraft {
  readonly outcome: CloseoutOutcome | null;
  readonly marks: Readonly<Record<string, Mark>>;
  readonly walkInCount: number;
  readonly wouldHostAgain: boolean | null;
  readonly friction: readonly Friction[];
  readonly privateNote: string;
}

export const draftFrom = (view: CloseoutView): CloseoutDraft => ({
  outcome: view.outcome,
  marks: Object.fromEntries(
    view.roster
      .filter((member) => member.outcome !== null)
      .map((member) => [member.userId, member.outcome as Mark]),
  ),
  walkInCount: view.walkInCount,
  wouldHostAgain: null,
  friction: [],
  privateNote: '',
});

/**
 * The two counts the host is about to commit to, worked out the same way the server will.
 *
 * Shown before submission because §5.5 derives them rather than accepting them: a host who cannot
 * see the number they are producing has no way to notice it is wrong, and the first place that
 * number is visible should not be a report weeks later.
 *
 * Unmarked people count as nobody. A blank is not a no-show — it is a host who has not said yet,
 * and reading it as an absence would quietly turn every skipped row into a negative statement about
 * somebody who may well have been there.
 */
export const totalsFor = (
  draft: CloseoutDraft,
): { registered: number; total: number } => {
  const registered = Object.values(draft.marks).filter(
    (mark) => mark === 'attended',
  ).length;
  return { registered, total: registered + draft.walkInCount };
};

/**
 * Whether this draft may be sent.
 *
 * Mirrors `submitCloseoutSchema` rather than restating it loosely: an outcome is required, the
 * walk-in count is bounded by the domain's own `WALK_IN_MAX`, a gathering that did not happen cannot
 * have walk-ins, and `other_structured` needs the note that explains it. The server refuses all four
 * anyway — this exists so the host is told before they press, not after, and the bound is imported
 * rather than retyped so the two cannot drift apart.
 */
export const canSubmit = (draft: CloseoutDraft): boolean => {
  if (!draft.outcome) return false;
  if (draft.walkInCount > WALK_IN_MAX) return false;
  if (draft.outcome === 'did_not_happen' && draft.walkInCount > 0) return false;
  if (draft.friction.includes('other_structured') && !draft.privateNote.trim())
    return false;
  return true;
};

/**
 * The request body, with the parts a `did_not_happen` closeout must not carry stripped out.
 *
 * The form keeps whatever the host typed while they are still deciding — switching to "it did not
 * happen" and back should not lose the roster they had marked — so the discarding happens here, at
 * the edge, rather than by mutating the draft as they toggle.
 */
export const toRequest = (eventId: string, draft: CloseoutDraft) => {
  const held = draft.outcome === 'held';
  return {
    closeout: {
      eventId,
      outcome: draft.outcome as 'held' | 'did_not_happen',
      walkInCount: held ? draft.walkInCount : 0,
      wouldHostAgain: draft.wouldHostAgain,
      hostFriction: [...draft.friction],
      ...(draft.privateNote.trim()
        ? { privateNote: draft.privateNote.trim() }
        : {}),
    },
    attendance: held
      ? Object.entries(draft.marks).map(([userId, outcome]) => ({
          userId,
          outcome,
        }))
      : [],
  };
};
