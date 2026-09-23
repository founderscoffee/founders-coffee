import { createFileRoute, redirect } from '@tanstack/react-router';

import { GEO_COOKIE, landingMarketSlug } from '../../features/markets/api';
import { readCookies } from '../../lib/cookies';
import { localizedLanding } from '../../lib/locale-routing';

export const Route = createFileRoute('/$locale/')({
  preload: false,
  component: () => null,
  loader: async ({ context }): Promise<never> => {
    throw redirect(
      localizedLanding(
        context.locale,
        await landingMarketSlug(context.markets, readCookies()[GEO_COOKIE]),
      ),
    );
  },
  head: () => ({ meta: [], links: [], scripts: [] }),
});
