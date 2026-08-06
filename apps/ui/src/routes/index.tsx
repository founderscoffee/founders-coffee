import { createFileRoute, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { getGeoCountry, getMarketLanding } from '@founders-coffee/server-fns'

import { readCookies } from '../lib/cookies'

/** Algeria is the default market when geo-detection finds no match (SRS: Algeria-first). */
const DEFAULT_MARKET_SLUG = 'algeria'
const GEO_COOKIE = 'fc_geo'

/** Resolve a country code to a visible market's slug — null for dark/unknown (no leak). */
const tryMarketSlug = async (key: string): Promise<string | null> => {
  try {
    const { market } = await getMarketLanding({ data: { key } })
    return market.slug
  } catch (error) {
    if (appErrorCode(error) === 'market_not_found') return null
    throw error
  }
}

/**
 * `/` is never a page — it redirects to the visitor's market. First visit: detect the country
 * (CF-IPCountry or DEV_GEO) → its market, or the default (Algeria). The `fc_geo` cookie remembers
 * the resolution so the logo (→ /) goes straight to the user's market without re-detecting.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const remembered = readCookies()[GEO_COOKIE]
    const country = remembered ?? (await getGeoCountry())
    const slug = country ? await tryMarketSlug(country) : null
    const target = slug ?? DEFAULT_MARKET_SLUG
    throw redirect({
      to: '/$market',
      params: { market: target },
      headers: { 'Set-Cookie': `${GEO_COOKIE}=${target}; Path=/; Max-Age=31536000; SameSite=Lax` },
    })
  },
  component: () => null,
})
