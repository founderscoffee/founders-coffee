export default {
  command:
    'npx vitest run src/lib/visible-selection.test.ts src/features/operations/components/FeedbackForm.test.tsx',
  cwd: 'apps/ui',
  mutants: [
    {
      name: '#79 reverted — the chosen rating styled exactly like the others',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackForm.tsx',
          find: "            className={`btn justify-start ${\n              draft.rating === rating ? 'btn-primary' : 'btn-outline'\n            }`}",
          replace: '            className="btn btn-outline justify-start"',
        },
      ],
    },
    {
      name: 'only the hidden input varies, which is what #79 actually was',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackForm.tsx',
          find: "            className={`btn justify-start ${\n              draft.rating === rating ? 'btn-primary' : 'btn-outline'\n            }`}",
          replace: '            className="btn btn-outline justify-start"',
        },
        {
          file: 'src/features/operations/components/FeedbackForm.tsx',
          find: '              className="sr-only"',
          replace:
            '              className="sr-only"\n              data-chosen={draft.rating === rating}',
        },
      ],
    },
    {
      name: 'a new hidden radio with nothing covering it',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/host/WizardSteps.tsx',
          find: 'export const',
          replace:
            'export const Decoy = () => (\n  <label className="btn">\n    <input className="sr-only" type="radio" name="decoy" />\n    Decoy\n  </label>\n);\n\nexport const',
        },
      ],
    },
    {
      name: 'the covering test named but not making the comparison',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackForm.test.tsx',
          find: 'visibleOptionMarkup',
          replace: 'visibleOptionMarkupX',
          all: true,
        },
      ],
    },
    {
      name: 'an entry for a control that no longer hides its input',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackForm.tsx',
          find: '              className="sr-only"\n              type="radio"',
          replace: '              type="radio"',
        },
      ],
    },
    {
      name: 'the comparison helper made blind to the visible class',
      expect: 'fail',
      edits: [
        {
          file: 'src/lib/visible-selection.ts',
          find: "  return [visible.className, visible.innerHTML].join(' :: ');",
          replace: '  return visible.innerHTML;',
        },
      ],
    },
    {
      name: 'a styling change that still distinguishes the chosen option',
      expect: 'pass',
      edits: [
        {
          file: 'src/features/operations/components/FeedbackForm.tsx',
          find: "draft.rating === rating ? 'btn-primary' : 'btn-outline'",
          replace: "draft.rating === rating ? 'btn-secondary' : 'btn-outline'",
        },
      ],
    },
  ],
};
