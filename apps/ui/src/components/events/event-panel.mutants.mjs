export default {
  command:
    'npx vitest run src/components/events src/features/events/components/LiveDashboard.test.tsx',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'the header chip borrows the dialog heading, so a button reads as a noun',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/EventDetail.tsx',
          find: '              label={share_event_action({}, { locale })}',
          replace: '              label={share_event({}, { locale })}',
        },
        {
          file: 'src/components/events/EventDetail.tsx',
          find: '  share_event_action,',
          replace: '  share_event,\n  share_event_action,',
        },
      ],
    },
    {
      name: 'the panel grows a share button again, so the page offers the same thing twice',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/RsvpSection.tsx',
          find: "import { RsvpCancelDialog } from './RsvpCancelDialog';",
          replace:
            "import { RsvpCancelDialog } from './RsvpCancelDialog';\nimport { ShareEventButton } from './ShareEventButton';",
        },
        {
          file: 'src/components/events/RsvpSection.tsx',
          find: '          <p className="text-body-sm text-neutral">\n            {rsvp_confirmed_help({}, { locale })}\n          </p>',
          replace:
            '          <p className="text-body-sm text-neutral">\n            {rsvp_confirmed_help({}, { locale })}\n          </p>\n          <ShareEventButton\n            locale={locale}\n            title={event.title}\n            label="Share"\n          />',
        },
      ],
    },
    {
      name: 'the host panel grows a share button again, duplicating the header chip',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/HostEventPanel.tsx',
          find: "import { HostLiveActions } from './HostLiveActions';",
          replace:
            "import { HostLiveActions } from './HostLiveActions';\nimport { ShareEventButton } from './ShareEventButton';",
        },
        {
          file: 'src/components/events/HostEventPanel.tsx',
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
          file: 'src/components/events/RsvpSection.tsx',
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
          file: 'src/components/events/RsvpBoxHeading.tsx',
          find: '  const isConfirmed = !isHost && !isCancelled && isGoing;',
          replace: '  const isConfirmed = false;',
        },
      ],
    },
    {
      name: 'the heading claims a confirmed seat at a meetup that is off',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/RsvpBoxHeading.tsx',
          find: '  const isConfirmed = !isHost && !isCancelled && isGoing;',
          replace: '  const isConfirmed = !isHost && isGoing;',
        },
      ],
    },
    {
      name: 'the live actions come back to the room, so the reader is asked twice',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/LiveDashboard.tsx',
          find: '  live_status_connected,',
          replace: '  live_status_connected,\n  live_walking_in,',
        },
        {
          file: 'src/features/events/components/LiveDashboard.tsx',
          find: '        </div>\n      </div>\n    </div>\n  );\n};',
          replace:
            '        </div>\n        <button className="btn btn-success btn-sm">\n          {live_walking_in({}, { locale })}\n        </button>\n      </div>\n    </div>\n  );\n};',
        },
      ],
    },
    {
      name: 'the panel offers the live actions before the room is open',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/RsvpSection.tsx',
          find: '          {live && isWindowOpen && !live.notAttending && (',
          replace: '          {live && !live.notAttending && (',
        },
      ],
    },
    {
      name: 'the panel offers the live actions to a reader the room refused',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/RsvpSection.tsx',
          find: '          {live && isWindowOpen && !live.notAttending && (',
          replace: '          {live && isWindowOpen && (',
        },
      ],
    },
  ],
};
