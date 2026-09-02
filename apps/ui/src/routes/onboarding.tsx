import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { getCities, getStates } from '@founders-coffee/server-fns';
import type { geo } from '@founders-coffee/domain';

import { OnboardingPage } from '../components/profile/OnboardingPage';
import { readCookies } from '../lib/cookies';
import { sameOriginPathSchema } from '../lib/redirect';

export const Route = createFileRoute('/onboarding')({
  validateSearch: z.object({
    redirect: sameOriginPathSchema.catch('/').optional().default('/'),
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { states, cities, initialCountry } = Route.useLoaderData();
    const { redirect } = Route.useSearch();
    return (
      <OnboardingPage
        locale={locale}
        markets={markets}
        states={states}
        cities={cities}
        initialCountry={initialCountry}
        redirect={redirect}
      />
    );
  },
  loader: async ({
    context,
    location,
  }): Promise<{
    states: readonly geo.GeoState[];
    cities: readonly geo.GeoCity[];
    initialCountry: string;
  }> => {
    const geoCookie = readCookies()['fc_geo'] ?? 'algeria';
    const initialCountry =
      context.markets.find(
        (m: { code: string }) => m.code === geoCookie.toUpperCase(),
      )?.code ?? 'DZ';
    const states = await getStates({ data: { country: initialCountry } });
    const stateParam = new URLSearchParams(location.search).get('state') ?? '';
    const cities = stateParam
      ? await getCities({
          data: { country: initialCountry, state: stateParam },
        })
      : [];
    return { states, cities, initialCountry };
  },
});
