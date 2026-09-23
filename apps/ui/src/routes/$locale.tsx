import {
  Outlet,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { decidePrefix } from '../lib/locale-prefix';

export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ location, context }) => {
    const decision = decidePrefix(
      location.href,
      detectLocale(readCookieHeader()),
      context.markets,
    );
    if (decision.kind === 'elsewhere') throw redirect({ href: decision.href });
    if (decision.kind === 'nowhere') throw notFound();
  },
  component: () => <Outlet />,
});
