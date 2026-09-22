export default {
  command: 'npx vitest run src/glossary.test.ts',
  cwd: 'libs/i18n',
  mutants: [
    {
      name: 'a banned phrase reintroduced on an unexcused key',
      expect: 'fail',
      edits: [
        {
          file: 'messages/ar.json',
          find: '"activity_title": "نشاطي",',
          replace: '"activity_title": "جلسة عمل",',
        },
      ],
    },
    {
      name: 'the retired name of the activity page brought back',
      expect: 'fail',
      edits: [
        {
          file: 'messages/ar.json',
          find: '"activity_nav": "نشاطي",',
          replace: '"activity_nav": "لقاءاتك",',
        },
      ],
    },
    {
      name: 'the host_page_title excuse dropped while the violation stands',
      expect: 'fail',
      edits: [
        {
          file: 'glossary.json',
          find: '        "host_page_title": "#49 open — still استضف جلسة عمل. Delete this line with the rename.",\n',
          replace: '',
        },
      ],
    },
    {
      name: 'that violation fixed with the excuse left behind',
      expect: 'fail',
      edits: [
        {
          file: 'messages/ar.json',
          find: '"host_page_title": "استضف جلسة عمل",',
          replace: '"host_page_title": "استضف لقاء",',
        },
      ],
    },
    {
      name: 'a canonical term banned by its own entry',
      expect: 'fail',
      edits: [
        {
          file: 'glossary.json',
          find: '"banned": ["جلسة عمل", "جلسة"],',
          replace: '"banned": ["جلسة عمل", "جلسة", "لقاء"],',
        },
      ],
    },
    {
      name: 'an undecided entry stripped of the question standing in its way',
      expect: 'fail',
      edits: [
        { file: 'glossary.json', find: '"decide":', replace: '"decideX":' },
      ],
    },
    {
      name: 'three legitimate words carrying two banned roots',
      expect: 'pass',
      edits: [
        {
          file: 'messages/ar.json',
          find: '"activity_title": "نشاطي",',
          replace: '"activity_title": "اللقاءات القادمة والمشاركون",',
        },
      ],
    },
  ],
};
