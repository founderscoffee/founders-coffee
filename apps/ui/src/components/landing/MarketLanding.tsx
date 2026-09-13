import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import { type Locale } from '@founders-coffee/i18n';
import type {
  EventFeedItem,
  EventFeedPage,
  TrendingSection,
} from '@founders-coffee/server-fns';

import { DiscoverFeed } from './DiscoverFeed';
import { MarketHero } from './MarketHero';
import { TrendingStates } from './TrendingStates';

type MarketLandingProps = {
  locale: Locale;
  market: Market;
  cities: readonly geo.GeoCity[];
  cityEventCounts: Record<string, number>;
  events: readonly EventFeedItem[];
  afterStartsAt?: number;
  afterId?: string;
  nextPageHref?: string;
  nextCursor?: EventFeedPage['nextCursor'];
  trending: TrendingSection;
};

export const MarketLanding = ({
  locale,
  market,
  cityEventCounts,
  events,
  afterStartsAt,
  afterId,
  nextPageHref,
  nextCursor,
  trending,
}: MarketLandingProps) => (
  <>
    <MarketHero
      locale={locale}
      market={market}
      cityEventCounts={cityEventCounts}
    />
    <TrendingStates locale={locale} market={market} trending={trending} />
    <DiscoverFeed
      locale={locale}
      market={market}
      events={events}
      afterStartsAt={afterStartsAt}
      afterId={afterId}
      nextPageHref={nextPageHref}
      nextCursor={nextCursor}
    />
  </>
);
