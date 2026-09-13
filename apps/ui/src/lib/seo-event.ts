import { event_meta_description, type Locale } from '@founders-coffee/i18n';

import {
  breadcrumbJsonLd,
  eventJsonLd,
  type StructuredEventData,
  type StructuredListItem,
} from './seo-structured-data';
import {
  buildPageMetadata,
  DEFAULT_SOCIAL_IMAGE_PATH,
  getSiteOrigin,
  type CanonicalRoute,
} from './seo';

type EventHeadInput = {
  readonly locale: Locale;
  readonly title: string;
  readonly cityName: string;
  readonly description?: string;
  readonly route: Extract<CanonicalRoute, { readonly type: 'event' }>;
  readonly structuredEvent: StructuredEventData;
  readonly breadcrumbs: readonly StructuredListItem[];
};

export const eventPageHead = ({
  locale,
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
  });
  const normalizedDescription = metadata.meta.find(
    (item) => 'name' in item && item.name === 'description',
  );
  const eventSchema = eventJsonLd({
    ...structuredEvent,
    image:
      structuredEvent.image ?? `${getSiteOrigin()}${DEFAULT_SOCIAL_IMAGE_PATH}`,
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
