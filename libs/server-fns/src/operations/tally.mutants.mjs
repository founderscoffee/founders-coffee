export default {
  command: 'npx vitest run src/operations/tally.test.ts',
  cwd: 'libs/server-fns',
  mutants: [
    {
      name: 'the floor removed, so a pulse of one is shown to the host',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: "    tally.responses < TALLY_FLOOR\n      ? { state: 'below_floor' }\n      : { state: 'shown', ...tally },",
          replace: "    { state: 'shown', ...tally },",
        },
      ],
    },
    {
      name: 'the floor lowered by one, which the two-response case must catch',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: 'export const TALLY_FLOOR = 3;',
          replace: 'export const TALLY_FLOOR = 2;',
        },
      ],
    },
    {
      name: 'the floor raised by one, so a tally at exactly the floor is withheld',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: 'export const TALLY_FLOOR = 3;',
          replace: 'export const TALLY_FLOOR = 4;',
        },
      ],
    },
    {
      name: 'the comparison flipped, so the counts leak below the floor and hide above it',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: '    tally.responses < TALLY_FLOOR',
          replace: '    tally.responses > TALLY_FLOOR',
        },
      ],
    },
    {
      name: 'the suppressed answer carries the counts anyway, where devtools can read them',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: "      ? { state: 'below_floor' }",
          replace: "      ? { state: 'below_floor', ...tally }",
        },
      ],
    },
    {
      name: 'the host check dropped, so any signed-in member reads another host’s pulse',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: '  if (event.hostId !== opts.actorId)',
          replace: '  if (false)',
        },
      ],
    },
    {
      name: 'a missing event answered instead of refused',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: "  if (!event) return err(new AppError('event_not_found', 'Event not found'));",
          replace: "  if (!event) return ok({ state: 'below_floor' });",
        },
      ],
    },
    {
      name: 'the refusal message reworded, which no assertion reads',
      expect: 'pass',
      edits: [
        {
          file: 'src/operations/tally.ts',
          find: "      new AppError('event_not_host', 'Only the host can see this summary'),",
          replace:
            "      new AppError('event_not_host', 'This summary is the host’s'),",
        },
      ],
    },
  ],
};
