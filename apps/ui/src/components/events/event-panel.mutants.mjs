export default {
  command:
    'npx vitest run src/components/events src/components/shell src/features/events',
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
          find: '  live_title,',
          replace: '  live_title,\n  live_walking_in,',
        },
        {
          file: 'src/features/events/components/LiveDashboard.tsx',
          find: '        />\n      </div>\n    </div>\n  );\n};',
          replace:
            '        />\n        <button className="btn btn-success btn-sm">\n          {live_walking_in({}, { locale })}\n        </button>\n      </div>\n    </div>\n  );\n};',
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
    {
      name: 'the roster stops marking which row is the reader',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/RosterList.tsx',
          find: '                {user.userId === currentUserId && (',
          replace: '            {false && (',
        },
      ],
    },
    {
      name: 'the minutes a latecomer entered go unrendered again',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/RosterList.tsx',
          find: '              {user.etaMinutes\n                ? ` · ${live_eta_minutes({ n: user.etaMinutes }, { locale })}`\n                : null}',
          replace: '            {null}',
        },
      ],
    },
    {
      name: 'the status word goes, leaving the colour of the dot to say it alone',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/RosterList.tsx',
          find: '              {statusLabel(user.status, locale)}',
          replace: '            {null}',
        },
      ],
    },
    {
      name: 'the host loses the badge that tells them apart in the list',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/RosterList.tsx',
          find: '                {isHost && (',
          replace: '                {false && (',
        },
      ],
    },
    {
      name: 'the table is advertised before the host is sitting at it',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/RosterList.tsx',
          find: '          isHost && host?.arrived ? findingThem(host, locale) : null;',
          replace:
            '          isHost && host ? findingThem(host, locale) : null;',
        },
      ],
    },
    {
      name: 'a waiting attendee is called connected again, as the socket badge is',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/live-badges.ts',
          find: '  live_not_arrived,\n  live_running_late,',
          replace:
            '  live_not_arrived,\n  live_running_late,\n  live_status_connected,',
        },
        {
          file: 'src/features/events/components/live-badges.ts',
          find: '      return live_not_arrived({}, { locale });',
          replace: '      return live_status_connected({}, { locale });',
        },
      ],
    },
    {
      name: 'the heading forgets how full the room is',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/LiveDashboard.tsx',
          find: '          <span className="font-normal text-neutral">\n            {\' \u00b7 \'}\n            {live_in_the_room(\n              { arrived: arrivedCount, total: totalCount },\n              { locale },\n            )}\n          </span>\n',
          replace: '',
        },
      ],
    },
    {
      name: 'the dot is left behind when the reader leaves the live room',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/live-presence.tsx',
          find: '    publish(state);\n    return () => publish(null);',
          replace: '    publish(state);',
        },
      ],
    },
    {
      name: 'the presence state loses its name and becomes a colour alone',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/shell/SessionNav.tsx',
          find: '        {presenceLabel && <span className="sr-only">{presenceLabel}</span>}',
          replace: '',
        },
      ],
    },
    {
      name: 'a dropped socket wears the same dot as a live one',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/live-badges.ts',
          find: "    case 'disconnected':\n      return 'avatar-offline';",
          replace: "    case 'disconnected':\n      return 'avatar-online';",
        },
      ],
    },
    {
      name: 'a roster avatar loses its dot entirely',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/RosterList.tsx',
          find: '              className={`avatar ${statusPresenceClass(user.status)} flex size-9 shrink-0 items-center justify-center rounded-full bg-base-200 text-body-sm font-semibold`}',
          replace:
            '              className={`avatar flex size-9 shrink-0 items-center justify-center rounded-full bg-base-200 text-body-sm font-semibold`}',
        },
      ],
    },
    {
      name: 'someone who has not turned up wears the dot of someone who has',
      expect: 'fail',
      edits: [
        {
          file: 'src/features/events/components/live-badges.ts',
          find: "    case 'connected':\n      return 'avatar-offline';",
          replace: "    case 'connected':\n      return 'avatar-online';",
        },
      ],
    },
  ],
};
