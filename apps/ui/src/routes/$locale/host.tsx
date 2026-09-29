import { createFileRoute, redirect } from '@tanstack/react-router';

import { GEO_COOKIE, landingMarketSlug } from '../../features/markets/api';
import { readCookies } from '../../lib/cookies';
import { localizedHostCreate } from '../../lib/locale-routing';

export const Route = createFileRoute('/$locale/host')({
  preload: false,
  component: () => null,
  loader: async ({ context }): Promise<never> => {
    throw redirect(
      localizedHostCreate(
        context.locale,
        await landingMarketSlug(context.markets, readCookies()[GEO_COOKIE]),
      ),
    );
  },
  head: () => ({ meta: [], links: [], scripts: [] }),
});
