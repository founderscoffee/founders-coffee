export default {
  command: 'npx vitest run src/operations-matrix.test.ts',
  cwd: 'libs/server-fns',
  mutants: [
    {
      name: 'the end-time guard deleted, which is #74 itself',
      expect: 'fail',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: "  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now()) {\n    return err(\n      new AppError('event_already_ended', 'This meetup has already ended'),\n    );\n  }\n",
          replace: '',
        },
      ],
    },
    {
      name: 'the guard moved above the cancelled check, so cancelling twice errors',
      expect: 'fail',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: "  if (event.status === 'cancelled') {\n    return ok({ event, notified: 0 });\n  }\n  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now()) {\n    return err(\n      new AppError('event_already_ended', 'This meetup has already ended'),\n    );\n  }",
          replace:
            "  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now()) {\n    return err(\n      new AppError('event_already_ended', 'This meetup has already ended'),\n    );\n  }\n  if (event.status === 'cancelled') {\n    return ok({ event, notified: 0 });\n  }",
        },
      ],
    },
    {
      name: 'the guard reads the start, refusing a meetup that is under way',
      expect: 'fail',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: '  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now()) {',
          replace: '  if (event.startsAt.getTime() <= Date.now()) {',
        },
      ],
    },
    {
      name: 'a missing end treated as an end that has passed',
      expect: 'fail',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: '  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now()) {',
          replace: '  if ((event.endsAt?.getTime() ?? 0) <= Date.now()) {',
        },
      ],
    },
    {
      name: 'the host check dropped, so anyone can call a meetup off',
      expect: 'fail',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: '  if (event.hostId !== opts.actorId) {',
          replace: '  if (false) {',
        },
      ],
    },
    {
      name: 'the row deleted, leaving an operation the table no longer describes',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-matrix.ts',
          find: 'export const operationMatrix = (): OperationMatrix => ({\n  cancelEvent: {',
          replace:
            'export const operationMatrix = (): OperationMatrix => ({\n  unusedOperationName: {',
        },
      ],
    },
    {
      name: 'a phase dropped from the row, so nobody decided it',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-matrix.ts',
          find: "    no_end: {\n      host: 'ok',\n      attendee: 'event_not_host',\n      stranger: 'event_not_host',\n    },\n",
          replace: '',
        },
      ],
    },
    {
      name: 'a mutating operation added with no row at all',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-matrix.test.ts',
          find: 'const OPERATIONS = {\n  cancelEvent:',
          replace:
            'const OPERATIONS = {\n  someNewMutatingOperation: (db: Db, eventId: string, actorId: string) =>\n    cancelEventResolver(db, { eventId, actorId }),\n  cancelEvent:',
        },
      ],
    },
    {
      name: 'the cancellation reason trimmed differently, which no cell depends on',
      expect: 'pass',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: '  const reason = opts.reason?.trim() || undefined;',
          replace: '  const reason = opts.reason?.trimEnd() || undefined;',
        },
      ],
    },
  ],
};
