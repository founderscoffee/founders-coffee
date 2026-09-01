import { createFileRoute, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { getGeoCountry, getMarketLanding } from '@founders-coffee/server-fns';

import { readCookies } from '../lib/cookies';

const DEFAULT_MARKET_SLUG = 'algeria';
const GEO_COOKIE = 'fc_geo';

const tryMarketSlug = async (key: string): Promise<string | null> => {
  try {
    const { market } = await getMarketLanding({ data: { key } });
    return market.slug;
  } catch (error) {
    if (appErrorCode(error) === 'market_not_found') return null;
    throw error;
  }
};

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const remembered = readCookies()[GEO_COOKIE];
    const country = remembered ?? (await getGeoCountry());
    const slug = country ? await tryMarketSlug(country) : null;
    const target = slug ?? DEFAULT_MARKET_SLUG;
    throw redirect({
      to: '/$market',
      params: { market: target },
      headers: {
        'Set-Cookie': `${GEO_COOKIE}=${target}; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
    });
  },
  component: () => null,
});
