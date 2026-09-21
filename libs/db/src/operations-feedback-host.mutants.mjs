export default {
  command:
    'npx vitest run src/operations-feedback-host.test.ts src/operations-feedback-tally.test.ts',
  cwd: 'libs/db',
  mutants: [
    {
      name: 'the write guard dropped, which is #77 itself',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback.ts',
          find: '      AND events.host_id <> ${userId}\n',
          replace: '',
        },
      ],
    },
    {
      name: 'the host check dropped from the refusal, so they are told they did not attend',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback.ts',
          find: "  if (await hostsEvent(db, eventId, userId)) return 'is_host';\n",
          replace: '',
        },
      ],
    },
    {
      name: 'the host check dropped from eligibility, so the form renders to the host',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback.ts',
          find: "  if (await hostsEvent(db, opts.eventId, opts.userId)) return 'is_host';\n",
          replace: '',
        },
      ],
    },
    {
      name: 'the host check moved below attendance, so an unmarked host gets not_attended',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback.ts',
          find: "  if (await hostsEvent(db, eventId, userId)) return 'is_host';\n  const attended = await db\n    .select({ id: eventAttendance.id })\n    .from(eventAttendance)\n    .where(\n      and(\n        eq(eventAttendance.eventId, eventId),\n        eq(eventAttendance.userId, userId),\n        eq(eventAttendance.outcome, 'attended'),\n      ),\n    )\n    .limit(1);\n  if (attended.length === 0) return 'not_attended';",
          replace:
            "  const attended = await db\n    .select({ id: eventAttendance.id })\n    .from(eventAttendance)\n    .where(\n      and(\n        eq(eventAttendance.eventId, eventId),\n        eq(eventAttendance.userId, userId),\n        eq(eventAttendance.outcome, 'attended'),\n      ),\n    )\n    .limit(1);\n  if (attended.length === 0) return 'not_attended';\n  if (await hostsEvent(db, eventId, userId)) return 'is_host';",
        },
      ],
    },
    {
      name: 'hostsEvent answers no to everyone, so every guard built on it is inert',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback.ts',
          find: '  return rows[0]?.hostId === userId;',
          replace: '  return false;',
        },
      ],
    },
    {
      name: 'the tally stops excluding the host, so a pre-guard self-rating counts',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback-tally.ts',
          find: '    .innerJoin(events, eq(events.id, eventFeedback.eventId))\n    .where(\n      and(\n        eq(eventFeedback.eventId, eventId),\n        ne(eventFeedback.userId, events.hostId),\n      ),\n    );',
          replace: '    .where(eq(eventFeedback.eventId, eventId));',
        },
      ],
    },
    {
      name: 'the tally inverted to count only the host',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback-tally.ts',
          find: '        ne(eventFeedback.userId, events.hostId),',
          replace: '        eq(eventFeedback.userId, events.hostId),',
        },
      ],
    },
    {
      name: 'the guard widened to refuse everyone, which the attendee case must catch',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations-feedback.ts',
          find: '  return rows[0]?.hostId === userId;',
          replace: '  return true;',
        },
      ],
    },
    {
      name: 'the seven-day invitation window trimmed, which no host cell depends on',
      expect: 'pass',
      edits: [
        {
          file: 'src/operations-feedback.ts',
          find: 'const SEVEN_DAYS = 7 * 24 * 60 * 60;',
          replace: 'const SEVEN_DAYS = 6 * 24 * 60 * 60;',
        },
      ],
    },
  ],
};
