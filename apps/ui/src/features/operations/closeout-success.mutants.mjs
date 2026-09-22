export default {
  command:
    'npx vitest run src/features/operations/components/CloseoutPage.test.tsx',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'the already-closed arm put back in front, which is #75 itself',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '      ) : save.isSuccess ? (\n        <div className="space-y-3">',
          replace:
            '      ) : query.data.outcome !== null ? (\n        <p role="status">{closeout_already_done({}, { locale })}</p>\n      ) : save.isSuccess ? (\n        <div className="space-y-3">',
        },
      ],
    },
    {
      name: 'the confirmation says the submission had already happened',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '          <p role="status">{closeout_done({}, { locale })}</p>',
          replace:
            '          <p role="status">{closeout_already_done({}, { locale })}</p>',
        },
      ],
    },
    {
      name: 'the refused-marks warning dropped, so partial data loss is silent',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '          {save.data.refusedMarks.length > 0 && (\n            <p className="text-body-sm text-neutral" role="alert">\n              {closeout_refused_marks({}, { locale })}\n            </p>\n          )}\n',
          replace: '',
        },
      ],
    },
    {
      name: 'the repeat link dropped at the moment the host said they would host again',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: "          {draft.outcome === 'held' && repeat.data && repeatMarketSlug ? (",
          replace: '          {false ? (',
        },
      ],
    },
    {
      name: 'the already-closed arm deleted rather than reordered',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '      ) : query.data.outcome !== null ? (\n        <div className="space-y-6">\n          <p role="status">{closeout_already_done({}, { locale })}</p>\n          {tally.data ? (\n            <FeedbackTally locale={locale} tally={tally.data} />\n          ) : null}\n        </div>\n',
          replace: '',
        },
      ],
    },
    {
      name: 'the spacing between the confirmation and the link changed',
      expect: 'pass',
      edits: [
        {
          file: 'src/features/operations/components/CloseoutPage.tsx',
          find: '        <div className="space-y-3">',
          replace: '        <div className="space-y-4">',
        },
      ],
    },
  ],
};
