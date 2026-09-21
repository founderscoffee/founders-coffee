export default {
  command:
    'npx vitest run src/features/operations/components/CloseoutPage.tally.test.tsx src/features/events/components/ActivityPage.closed-out.test.tsx',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'the tally never rendered, which is #76 itself',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '          {tally.data ? (\n            <FeedbackTally locale={locale} tally={tally.data} />\n          ) : null}\n',
          replace: '',
        },
      ],
    },
    {
      name: 'the query enabled for a gathering with no closeout, so every past event asks',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '  const tally = useFeedbackTally(\n    eventId,\n    !save.isSuccess && (query.data?.outcome ?? null) !== null,\n  );',
          replace: '  const tally = useFeedbackTally(eventId, true);',
        },
      ],
    },
    {
      name: 'the suppressed branch shows the counts instead of the explanation',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackTally.tsx',
          find: "    {tally.state === 'below_floor' ? (",
          replace: '    {false ? (',
        },
      ],
    },
    {
      name: 'the would-return line dropped from the summary',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackTally.tsx',
          find: '        <li>{tally_return({ count: tally.wouldReturn }, { locale })}</li>\n',
          replace: '',
        },
      ],
    },
    {
      name: 'valuable and okay read from each other’s count',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackTally.tsx',
          find: '        <li>{tally_valuable({ count: tally.valuable }, { locale })}</li>\n        <li>{tally_okay({ count: tally.okay }, { locale })}</li>',
          replace:
            '        <li>{tally_valuable({ count: tally.okay }, { locale })}</li>\n        <li>{tally_okay({ count: tally.valuable }, { locale })}</li>',
        },
      ],
    },
    {
      name: 'the already-closed line dropped, which the summary does not replace',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '          <p role="status">{closeout_already_done({}, { locale })}</p>\n',
          replace: '',
        },
      ],
    },
    {
      name: 'the way back to a closed-out gathering flattened, so the summary is unreachable',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/ActivityList.tsx',
          find: '      <Link\n        className="mt-1 inline-block text-caption text-neutral underline"\n        {...localizedCloseout(locale, eventId)}\n      >\n        {activity_closed_out({}, { locale })}\n      </Link>',
          replace:
            '      <span className="mt-1 inline-block text-caption text-neutral">\n        {activity_closed_out({}, { locale })}\n      </span>',
        },
      ],
    },
    {
      name: 'the alert icon swapped, which no assertion reads',
      expect: 'pass',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackTally.tsx',
          find: '        <MessageSquare className="size-4 shrink-0" aria-hidden="true" />',
          replace:
            '        <MessageSquare className="size-5 shrink-0" aria-hidden="true" />',
        },
      ],
    },
  ],
};
