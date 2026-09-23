import { shortId } from '@founders-coffee/core';
import { event_meta_description, type Locale } from '@founders-coffee/i18n';

import {
  breadcrumbJsonLd,
  eventJsonLd,
  type StructuredEventData,
  type StructuredListItem,
} from './seo-structured-data';
import { buildPageMetadata, getSiteOrigin, type CanonicalRoute } from './seo';

type EventHeadInput = {
  readonly locale: Locale;
  readonly eventId: string;
  readonly version: number;
  readonly title: string;
  readonly cityName: string;
  readonly description?: string;
  readonly route: Extract<CanonicalRoute, { readonly type: 'event' }>;
  readonly structuredEvent: StructuredEventData;
  readonly breadcrumbs: readonly StructuredListItem[];
};

/**
 * The card a shared meetup previews as.
 *
 * `version` is in the address rather than only in the render: a scraper keeps the picture it first
 * fetched, so an edited title that reused this URL would keep showing the old one for as long as
 * the scraper held it.
 */
export const eventCardUrl = (
  locale: Locale,
  eventId: string,
  version: number,
): string =>
  `${getSiteOrigin()}/og/e/${shortId(eventId)}?l=${locale}&v=${version}`;

export const eventPageHead = ({
  locale,
  eventId,
  version,
  title,
  cityName,
  description,
  route,
  structuredEvent,
  breadcrumbs,
}: EventHeadInput) => {
  const eventDescription =
    description ||
    event_meta_description({ title, city: cityName }, { locale });
  const metadata = buildPageMetadata({
    locale,
    title: `${title} · ${cityName}`,
    description: eventDescription,
    route,
    openGraphType: 'event',
    socialImage: {
      url: eventCardUrl(locale, eventId, version),
      alt: `${title} · ${cityName}`,
    },
  });
  const normalizedDescription = metadata.meta.find(
    (item) => 'name' in item && item.name === 'description',
  );
  const eventSchema = eventJsonLd({
    ...structuredEvent,
    image: structuredEvent.image ?? eventCardUrl(locale, eventId, version),
    description:
      normalizedDescription &&
      'content' in normalizedDescription &&
      typeof normalizedDescription.content === 'string'
        ? normalizedDescription.content
        : eventDescription,
  });
  return {
    ...metadata,
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(eventSchema),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(breadcrumbJsonLd(breadcrumbs)),
      },
    ],
  };
};
