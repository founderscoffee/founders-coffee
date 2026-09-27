import { useMatches } from '@tanstack/react-router';

import type { Locale } from '@founders-coffee/i18n';

import { openGraphAlternates } from '../../lib/seo-alternates';

export const OpenGraphLocaleAlternates = ({ locale }: { locale: Locale }) => {
  const alternates = useMatches({
    select: (matches) =>
      openGraphAlternates(
        matches.flatMap((match) => match.links ?? []),
        locale,
      ),
  });
  return alternates.map((content) => (
    <meta key={content} property="og:locale:alternate" content={content} />
  ));
};
