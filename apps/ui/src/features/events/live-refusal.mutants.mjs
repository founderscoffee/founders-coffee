export default {
  command:
    'npx vitest run src/durable-objects/event-live/session.test.ts src/features/events/useEventLive.test.ts',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'a non-attendee is called an expired session again, which is #36 itself',
      expect: 'fail',
      edits: [
        {
          file: 'src/durable-objects/event-live/session.ts',
          find: "      message: { type: 'not_attending', message: 'Not attending this event' },",
          replace:
            "      message: { type: 'auth_expired', message: 'Not attending this event' },",
        },
      ],
    },
    {
      name: 'both refusals close on 4001, so the wire stops telling them apart',
      expect: 'fail',
      edits: [
        {
          file: 'src/durable-objects/event-live/session.ts',
          find: "      close: { code: 4003, reason: 'not_attending' },",
          replace: "      close: { code: 4001, reason: 'not_attending' },",
        },
      ],
    },
    {
      name: 'a transient database failure closes the socket instead of letting it retry',
      expect: 'fail',
      edits: [
        {
          file: 'src/durable-objects/event-live/session.ts',
          find: "      message: { type: 'error', message: 'Temporary auth error, please retry' },\n      close: null,",
          replace:
            "      message: { type: 'error', message: 'Temporary auth error, please retry' },\n      close: { code: 4000, reason: 'db_error' },",
        },
      ],
    },
    {
      name: 'the client maps the new frame back onto the expiry message',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/useEventLive.ts',
          find: "          case 'not_attending':\n            setNotAttending(true);",
          replace:
            "          case 'not_attending':\n            setError('session_expired');\n            setNotAttending(true);",
        },
      ],
    },
    {
      name: 'the fact is never cleared, so joining leaves the room hidden for good',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/useEventLive.ts',
          find: '    setError(null);\n    setNotAttending(false);',
          replace: '    setError(null);',
        },
      ],
    },
    {
      name: 'the refusal wording changes, which is diagnostic and never shown',
      expect: 'pass',
      edits: [
        {
          file: 'src/durable-objects/event-live/session.ts',
          find: "message: 'Not attending this event' },",
          replace: "message: 'Has not joined this event' },",
        },
      ],
    },
  ],
};
