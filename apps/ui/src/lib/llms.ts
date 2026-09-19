import {
  brand,
  llms_event_inventory,
  llms_locales,
  llms_public_surfaces,
  llms_purpose,
  llms_robots,
  llms_sitemap,
  llms_staging,
  llms_description,
  llms_event_feed,
  LOCALES,
  type Locale,
} from '@founders-coffee/i18n';
import type { SitemapData } from '@founders-coffee/server-fns';

import { sitemapItems } from './sitemap';

const MAX_EVENT_LINKS = 100;

const absolute = (origin: string, path: string): string =>
  `${origin.replace(/\/$/u, '')}${path}`;

const link = (text: string, url: string): string => `- [${text}](${url})`;

const eventPath = (path: string): boolean => /\/e\//u.test(path);

const productionLines = (
  origin: string,
  data: SitemapData,
  locale: Locale,
): string[] => {
  const items = sitemapItems(data);
  const eventItems = items.filter((item) => eventPath(item.path));
  const discoveryItems = items.filter((item) => !eventPath(item.path));
  const eventLinks = eventItems
    .slice(0, MAX_EVENT_LINKS)
    .map((item) => link(item.path, absolute(origin, item.path)));
  const inventoryLink = link(
    llms_sitemap({}, { locale }),
    absolute(origin, '/sitemap.xml'),
  );

  return [
    `# ${brand({}, { locale })}`,
    '',
    `> ${llms_description({}, { locale })}`,
    '',
    `> ${llms_purpose({}, { locale })}`,
    '',
    `## ${llms_locales({}, { locale })}`,
    ...LOCALES.map((entry) => link(entry, absolute(origin, `/${entry}`))),
    '',
    `## ${llms_public_surfaces({}, { locale })}`,
    inventoryLink,
    link(llms_robots({}, { locale }), absolute(origin, '/robots.txt')),
    link(llms_event_feed({}, { locale }), absolute(origin, '/events.json')),
    ...discoveryItems.map((item) =>
      link(item.path, absolute(origin, item.path)),
    ),
    '',
    `## ${llms_event_inventory({}, { locale })}`,
    ...eventLinks,
    ...(eventItems.length > MAX_EVENT_LINKS ? [inventoryLink] : []),
    '',
  ];
};

export const llmsText = (
  origin: string,
  data: SitemapData,
  locale: Locale = 'en',
): string => productionLines(origin, data, locale).join('\n');

export const stagingLlmsText = (locale: Locale = 'en'): string =>
  [
    `# ${brand({}, { locale })}`,
    '',
    `> ${llms_staging({}, { locale })}`,
    '',
  ].join('\n');
