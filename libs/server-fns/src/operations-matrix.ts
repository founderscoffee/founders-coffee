export const PHASE_NAMES = [
  'before_start',
  'in_progress',
  'after_end',
  'no_end',
  'cancelled',
] as const;

export const ACTOR_NAMES = ['host', 'attendee', 'stranger'] as const;

export type Phase = (typeof PHASE_NAMES)[number];
export type Actor = (typeof ACTOR_NAMES)[number];

export type OperationMatrix = Readonly<
  Record<string, Readonly<Record<Phase, Readonly<Record<Actor, string>>>>>
>;

/**
 * What every state-changing operation is expected to answer, per lifecycle phase and per actor.
 *
 * The cells hold the outcome, not the fact that a test exists: `ok` or the `AppError` code the
 * caller receives. That distinction is the whole point — a coverage rule is satisfied by a test
 * that asserts nothing, and a table of expected error codes is not. `operations-matrix.test.ts`
 * builds the event for each phase, calls the operation as each actor, and compares.
 *
 * `no_end` is a phase of its own because §5.24 treats a missing end as real data rather than a
 * mistake. An event with no end cannot be shown to have finished, so `after_end`'s refusal cannot
 * apply to it and the cell says `ok` deliberately. Every event the product creates has an end —
 * `createEventSchema` requires one — so this is the shape of legacy and fixture rows, and writing
 * it down is what stops someone reading the `after_end` row and assuming it covers everything.
 *
 * `cancelled` is deliberately an event that has *also* ended, which is the case that fixes the
 * order of the guards: an already-cancelled meetup answers as the no-op it is before the end-time
 * refusal is reached, so cancelling twice never turns into an error.
 *
 * This table proves what the server refuses. It says nothing about what the interface still offers:
 * #74 was a defect in both layers, and the button is held by `HostEventPanel.test.tsx` instead.
 */
export const operationMatrix = (): OperationMatrix => ({
  cancelEvent: {
    before_start: {
      host: 'ok',
      attendee: 'event_not_host',
      stranger: 'event_not_host',
    },
    in_progress: {
      host: 'ok',
      attendee: 'event_not_host',
      stranger: 'event_not_host',
    },
    after_end: {
      host: 'event_already_ended',
      attendee: 'event_not_host',
      stranger: 'event_not_host',
    },
    no_end: {
      host: 'ok',
      attendee: 'event_not_host',
      stranger: 'event_not_host',
    },
    cancelled: {
      host: 'ok',
      attendee: 'event_not_host',
      stranger: 'event_not_host',
    },
  },
});
