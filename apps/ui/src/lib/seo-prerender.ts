import { sitemapCompanyItems } from './sitemap-contract';

const stableSitemapItems = sitemapCompanyItems();

const stableSitemapPaths = new Set(stableSitemapItems.map(({ path }) => path));

export const seoPrerenderPages = stableSitemapItems;

export const isSeoPrerenderPath = ({
  path,
}: {
  readonly path: string;
}): boolean => !/[?#]/u.test(path) && stableSitemapPaths.has(path);
