import { Link } from '@tanstack/react-router';

import {
  activity_cancelled,
  activity_closed_out,
  activity_count,
  activity_more,
  activity_past,
  closeout_link,
  activity_upcoming,
  formatDate,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import type { CloseoutStateView } from '../../operations/api';
import { RepeatHostLink } from '../../../components/events/RepeatHostLink';
import { localizedCloseout, localizedEvent } from '../../../lib/locale-routing';

export interface ActivityItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly venue: string;
  readonly marketCode: string;
  readonly status: string;
  readonly startsAt: Date | string | number;
  readonly cityCode?: string;
  readonly cityName?: string | null;
}

const CloseoutLine = ({
  eventId,
  state,
  locale,
}: {
  eventId: string;
  state: CloseoutStateView | undefined;
  locale: Locale;
}) => {
  if (state === undefined) return null;
  if (state.closed)
    return (
      <Link
        className="mt-1 inline-block text-caption text-neutral underline"
        {...localizedCloseout(locale, eventId)}
      >
        {activity_closed_out({}, { locale })}
      </Link>
    );
  return (
    <Link
      className="mt-1 inline-block text-caption underline"
      {...localizedCloseout(locale, eventId)}
    >
      {closeout_link({}, { locale })}
    </Link>
  );
};

const Badge = ({ item, locale }: { item: ActivityItem; locale: Locale }) => {
  if (item.status === 'cancelled')
    return (
      <span className="badge badge-sm badge-error badge-soft shrink-0">
        {activity_cancelled({}, { locale })}
      </span>
    );
  const isPast = new Date(item.startsAt).getTime() < Date.now();
  return (
    <span className="badge badge-sm badge-ghost shrink-0">
      {isPast
        ? activity_past({}, { locale })
        : activity_upcoming({}, { locale })}
    </span>
  );
};

export const ActivityList = ({
  locale,
  emptyNote,
  items,
  total,
  marketSlugFor,
  hasMore,
  isLoadingMore,
  onLoadMore,
  closeoutStates,
}: {
  locale: Locale;
  emptyNote: string;
  items: readonly ActivityItem[];
  total: number;
  marketSlugFor: (marketCode: string) => string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  closeoutStates?: ReadonlyMap<string, CloseoutStateView>;
}) => (
  <section className="p-5 md:p-6">
    {items.length > 0 && (
      <div className="flex justify-end">
        <p className="text-caption text-neutral">
          {activity_count({ count: total }, { locale })}
        </p>
      </div>
    )}

    {items.length === 0 ? (
      <p className="mt-4 text-body-sm text-neutral">{emptyNote}</p>
    ) : (
      <ul className="mt-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-b border-base-200 py-3 last:border-b-0"
          >
            <Link
              {...localizedEvent(
                locale,
                marketSlugFor(item.marketCode),
                item.slug,
              )}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 hover:underline"
            >
              <span className="min-w-0">
                <span className="block text-body-sm font-medium" dir="auto">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-caption text-neutral">
                  {formatDate(new Date(item.startsAt), locale, {
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {item.cityName ? ` · ${item.cityName}` : ''}
                </span>
              </span>
              <Badge item={item} locale={locale} />
            </Link>
            <CloseoutLine
              eventId={item.id}
              state={closeoutStates?.get(item.id)}
              locale={locale}
            />
            {closeoutStates?.get(item.id)?.outcome === 'held' &&
            item.cityCode ? (
              <RepeatHostLink
                locale={locale}
                marketSlug={marketSlugFor(item.marketCode)}
                cityCode={item.cityCode}
                eventId={item.id}
              />
            ) : null}
          </li>
        ))}
      </ul>
    )}

    {hasMore && (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        disabled={isLoadingMore}
        onClick={onLoadMore}
      >
        {activity_more({}, { locale })}
      </Button>
    )}
  </section>
);
