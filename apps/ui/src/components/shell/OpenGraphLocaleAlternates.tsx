import { useMatches, useParams } from '@tanstack/react-router';

import type { Locale } from '@founders-coffee/i18n';

import { openGraphAlternates } from '../../lib/seo-alternates';
import type { MarketReference } from '../../lib/seo-market';

export const OpenGraphLocaleAlternates = ({
  locale,
  markets,
}: {
  locale: Locale;
  markets: readonly MarketReference[];
}) => {
  const marketSlug = useParams({
    strict: false,
    select: (params) => params.market,
  });
  const marketCode = markets.find((market) => market.slug === marketSlug)?.code;
  const alternates = useMatches({
    select: (matches) =>
      openGraphAlternates(
        matches.flatMap((match) => match.links ?? []),
        locale,
        marketCode,
      ),
  });
  return alternates.map((content) => (
    <meta key={content} property="og:locale:alternate" content={content} />
  ));
};
