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

/**
 * Staging's guide. It lists no inventory on purpose, and carries exactly one link: staging's own
 * root.
 *
 * The link is there for the Lighthouse llms.txt audit, whose `hasLink` check a file of title and
 * blockquote fails, leaving staging permanently red and a real regression indistinguishable from
 * the deliberate one. It points at the host being read rather than at production, because
 * `discoveryFailures` holds staging to emitting no production URL at all, and a guide that names
 * production is a guide that hands a crawler the canonical site from a host that is `noindex,
 * nofollow` and `no-store`. Absolute rather than relative so the audit's link check cannot turn
 * on how it resolves a path.
 */
export const stagingLlmsText = (
  origin: string,
  locale: Locale = 'en',
): string =>
  [
    `# ${brand({}, { locale })}`,
    '',
    `> ${llms_staging({}, { locale })}`,
    '',
    link(brand({}, { locale }), origin),
    '',
  ].join('\n');
