import { Link } from '@tanstack/react-router';

import {
  activity_cancelled,
  activity_count,
  activity_more,
  activity_past,
  closeout_link,
  activity_upcoming,
  formatDate,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

export interface ActivityItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly venue: string;
  readonly marketCode: string;
  readonly status: string;
  readonly startsAt: Date | string | number;
  readonly cityName?: string | null;
}

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
  title,
  emptyNote,
  items,
  total,
  marketSlugFor,
  hasMore,
  isLoadingMore,
  onLoadMore,
  offerCloseout = false,
}: {
  locale: Locale;
  title: string;
  emptyNote: string;
  items: readonly ActivityItem[];
  total: number;
  marketSlugFor: (marketCode: string) => string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  offerCloseout?: boolean;
}) => (
  <section className="rounded-box border border-base-300 bg-base-100 p-5 md:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-h4">{title}</h2>
      {items.length > 0 && (
        <p className="text-caption text-neutral">
          {activity_count({ count: total }, { locale })}
        </p>
      )}
    </div>

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
              to="/$market/e/$slug"
              params={{
                market: marketSlugFor(item.marketCode),
                slug: item.slug,
              }}
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
            {offerCloseout &&
              item.status !== 'cancelled' &&
              new Date(item.startsAt).getTime() < Date.now() && (
                <Link
                  className="mt-1 inline-block text-caption underline"
                  params={{ eventId: item.id }}
                  to="/closeout/$eventId"
                >
                  {closeout_link({}, { locale })}
                </Link>
              )}
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
