import {
  live_eta_minutes,
  live_no_attendees,
  live_you,
  type Locale,
} from '@founders-coffee/i18n';

import { initials } from '../../../lib/utils';
import type { RosterUser } from '../useEventLive';
import { statusDot, statusLabel } from './live-badges';

type RosterListProps = {
  roster: readonly RosterUser[];
  currentUserId: string;
  locale: Locale;
};

export const RosterList = ({
  roster,
  currentUserId,
  locale,
}: RosterListProps) => {
  if (roster.length === 0)
    return (
      <p className="text-body-sm text-neutral">
        {live_no_attendees({}, { locale })}
      </p>
    );

  return (
    <ul className="flex flex-col gap-2">
      {roster.map((user) => (
        <li key={user.userId} className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-base-200 text-body-sm font-semibold"
            aria-hidden="true"
          >
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium" dir="auto">
            {user.name}
            {user.userId === currentUserId && (
              <span className="font-normal text-neutral">
                {' · '}
                {live_you({}, { locale })}
              </span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-body-sm text-neutral">
            <span
              className={`size-2 rounded-full ${statusDot(user.status)}`}
              aria-hidden="true"
            />
            {statusLabel(user.status, locale)}
            {user.etaMinutes
              ? ` · ${live_eta_minutes({ n: user.etaMinutes }, { locale })}`
              : null}
          </span>
        </li>
      ))}
    </ul>
  );
};
