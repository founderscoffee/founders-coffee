import { createFileRoute } from '@tanstack/react-router';

import { closeout_title } from '@founders-coffee/i18n';

import { CloseoutPage } from '../features/operations/components/CloseoutPage';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { requireSession } from '../features/auth/require-session';
import { privatePageHead } from '../lib/seo-private';

const CloseoutRoute = () => {
  const { locale, markets } = Route.useRouteContext();
  const { eventId } = Route.useParams();
  return <CloseoutPage locale={locale} eventId={eventId} markets={markets} />;
};

export const Route = createFileRoute('/$locale/closeout/$eventId')({
  beforeLoad: async ({ location, context }) => {
    await requireSession(context.locale, location.href);
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: CloseoutRoute,
  head: ({ match }) =>
    privatePageHead(closeout_title({}, { locale: match.context.locale })),
});
