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
      name: 'the walking button drops back to the badge wording and stops speaking as the reader',
      expect: 'fail',
      edits: [
        {
          file: 'libs/i18n/messages/ar.json',
          find: '  "live_walking_in_cta": "أمشي نحو المكان",',
          replace: '  "live_walking_in_cta": "في الطريق",',
        },
      ],
    },
    {
      name: 'the late button goes back to the masculine adjective with no person in it',
      expect: 'fail',
      edits: [
        {
          file: 'libs/i18n/messages/ar.json',
          find: '  "live_running_late_cta": "سأتأخر",',
          replace: '  "live_running_late_cta": "متأخر",',
        },
      ],
    },
    {
      name: 'the roster badge speaks as the person it is labelling',
      expect: 'fail',
      edits: [
        {
          file: 'libs/i18n/messages/ar.json',
          find: '  "live_walking_in": "في الطريق",',
          replace: '  "live_walking_in": "أمشي نحو المكان",',
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
    {
      name: 'the Arabic ETA drops its number and goes back to naming itself',
      expect: 'fail',
      edits: [
        {
          file: 'libs/i18n/messages/ar.json',
          find: '        "nPlural=many": "{n} دقيقة",',
          replace: '        "nPlural=many": "الوقت المتبقي بالدقائق",',
        },
      ],
    },
  ],
};
