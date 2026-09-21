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
      name: 'the header chip borrows the dialog heading, so a button reads as a noun',
      expect: 'fail',
      edits: [
        {
          file: 'apps/ui/src/components/events/EventDetail.tsx',
          find: '              label={share_event_action({}, { locale })}',
          replace: '              label={share_event({}, { locale })}',
        },
        {
          file: 'apps/ui/src/components/events/EventDetail.tsx',
          find: '  share_event_action,',
          replace: '  share_event,\n  share_event_action,',
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
      name: 'the panel grows a share button again, so the page offers the same thing twice',
      expect: 'fail',
      edits: [
        {
          file: 'apps/ui/src/components/events/RsvpSection.tsx',
          find: "import { RsvpCancelDialog } from './RsvpCancelDialog';",
          replace:
            "import { RsvpCancelDialog } from './RsvpCancelDialog';\nimport { ShareEventButton } from './ShareEventButton';",
        },
        {
          file: 'apps/ui/src/components/events/RsvpSection.tsx',
          find: '          <p className="text-body-sm text-neutral">\n            {rsvp_confirmed_help({}, { locale })}\n          </p>\n        </>',
          replace:
            '          <p className="text-body-sm text-neutral">\n            {rsvp_confirmed_help({}, { locale })}\n          </p>\n          <ShareEventButton\n            locale={locale}\n            title={event.title}\n            label="Share"\n          />\n        </>',
        },
      ],
    },
    {
      name: 'the host panel grows a share button again, duplicating the header chip',
      expect: 'fail',
      edits: [
        {
          file: 'apps/ui/src/components/events/HostEventPanel.tsx',
          find: "import { HostLiveActions } from './HostLiveActions';",
          replace:
            "import { HostLiveActions } from './HostLiveActions';\nimport { ShareEventButton } from './ShareEventButton';",
        },
        {
          file: 'apps/ui/src/components/events/HostEventPanel.tsx',
          find: '      <p className="text-body-sm text-neutral">\n        {host_hosting_help({}, { locale })}\n      </p>',
          replace:
            '      <p className="text-body-sm text-neutral">\n        {host_hosting_help({}, { locale })}\n      </p>\n      {!isCancelled && (\n        <ShareEventButton\n          locale={locale}\n          title={event.title}\n          label="Share this meetup"\n        />\n      )}',
        },
      ],
    },
    {
      name: 'cancel stops leading the panel and trails the help line instead',
      expect: 'fail',
      edits: [
        {
          file: 'apps/ui/src/components/events/RsvpSection.tsx',
          find: '          <button\n            type="button"\n            className="btn btn-ghost btn-sm w-fit text-neutral"\n            onClick={() => setIsCancelOpen(true)}\n          >\n            {rsvp_cancel({}, { locale })}\n          </button>\n          <p className="text-body-sm text-neutral">\n            {rsvp_confirmed_help({}, { locale })}\n          </p>',
          replace:
            '          <p className="text-body-sm text-neutral">\n            {rsvp_confirmed_help({}, { locale })}\n          </p>\n          <button\n            type="button"\n            className="btn btn-ghost btn-sm w-fit text-neutral"\n            onClick={() => setIsCancelOpen(true)}\n          >\n            {rsvp_cancel({}, { locale })}\n          </button>',
        },
      ],
    },
    {
      name: 'the box heading stops noticing the seat is already taken',
      expect: 'fail',
      edits: [
        {
          file: 'apps/ui/src/components/events/EventDetail.tsx',
          find: "  const isConfirmed = !isHost && !isCancelled && event.viewerRsvp === 'going';",
          replace: '  const isConfirmed = false;',
        },
      ],
    },
    {
      name: 'the heading claims a confirmed seat at a meetup that is off',
      expect: 'fail',
      edits: [
        {
          file: 'apps/ui/src/components/events/EventDetail.tsx',
          find: "  const isConfirmed = !isHost && !isCancelled && event.viewerRsvp === 'going';",
          replace:
            "  const isConfirmed = !isHost && event.viewerRsvp === 'going';",
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
