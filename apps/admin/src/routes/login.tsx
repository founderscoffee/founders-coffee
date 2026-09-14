import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

import { AdminLogin } from '../features/auth/AdminLogin';

const getLoginConfig = createServerFn({ method: 'GET' }).handler(() => ({
  turnstileSiteKey:
    (env as unknown as { TURNSTILE_SITE_KEY?: string }).TURNSTILE_SITE_KEY ??
    '',
}));

export const Route = createFileRoute('/login')({
  loader: () => getLoginConfig(),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { turnstileSiteKey } = Route.useLoaderData();
    return <AdminLogin locale={locale} turnstileSiteKey={turnstileSiteKey} />;
  },
});
