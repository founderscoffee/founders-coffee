import {
  live_eta_minutes,
  live_no_attendees,
  live_table_n,
  live_you,
  role_host,
  type Locale,
} from '@founders-coffee/i18n';

import { initials } from '../../../lib/utils';
import type { HostState, RosterUser } from '../useEventLive';
import { statusDot, statusLabel } from './live-badges';

type RosterListProps = {
  roster: readonly RosterUser[];
  host: HostState | null;
  currentUserId: string;
  locale: Locale;
};

const findingThem = (host: HostState, locale: Locale): string | null => {
  const parts = [
    host.tableNumber ? live_table_n({ n: host.tableNumber }, { locale }) : null,
    host.visualCue,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
};

export const RosterList = ({
  roster,
  host,
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
      {roster.map((user) => {
        const isHost = user.userId === host?.userId;
        const whereToFindThem =
          isHost && host?.arrived ? findingThem(host, locale) : null;

        return (
          <li key={user.userId} className="flex items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-base-200 text-body-sm font-semibold"
              aria-hidden="true"
            >
              {initials(user.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium" dir="auto">
                  {user.name}
                </span>
                {isHost && (
                  <span className="badge badge-sm badge-secondary shrink-0">
                    {role_host({}, { locale })}
                  </span>
                )}
                {user.userId === currentUserId && (
                  <span className="shrink-0 text-body-sm text-neutral">
                    {live_you({}, { locale })}
                  </span>
                )}
              </span>
              {whereToFindThem && (
                <span
                  className="block truncate text-body-sm text-neutral"
                  dir="auto"
                >
                  {whereToFindThem}
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
        );
      })}
    </ul>
  );
};
