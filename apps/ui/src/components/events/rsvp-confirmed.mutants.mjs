export default {
  command: 'npx nx run public:test --skip-nx-cache',
  cwd: '.',
  mutants: [
    {
      name: 'the pill goes back to the masculine-only wording',
      expect: 'fail',
      edits: [
        {
          file: 'libs/i18n/messages/ar.json',
          find: '  "rsvp_already": "حضورك مؤكَّد",',
          replace: '  "rsvp_already": "أنت قادم",',
        },
      ],
    },
    {
      name: 'the help line goes back to the form that reads as an imperative',
      expect: 'fail',
      edits: [
        {
          file: 'libs/i18n/messages/ar.json',
          find: '  "rsvp_confirmed_help": "تم إرسال التأكيد. سنذكّرك قبل يوم.",',
          replace:
            '  "rsvp_confirmed_help": "أُرسل التأكيد. سنذكّرك قبل يوم.",',
        },
      ],
    },
    {
      name: 'the Arabic button label becomes the noun, which no button should read as',
      expect: 'fail',
      edits: [
        {
          file: 'libs/i18n/messages/ar.json',
          find: '  "share_event_action": "شارك",',
          replace: '  "share_event_action": "مشاركة",',
        },
      ],
    },
    {
      name: 'the French button label changes, which no test speaks to',
      expect: 'pass',
      edits: [
        {
          file: 'libs/i18n/messages/fr.json',
          find: '  "share_event_action": "Partager",',
          replace: '  "share_event_action": "Diffuser",',
        },
      ],
    },
  ],
};
