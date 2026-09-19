import { createFileRoute } from '@tanstack/react-router';

import { closeout_title } from '@founders-coffee/i18n';

import { CloseoutPage } from '../features/operations/components/CloseoutPage';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/closeout/$eventId')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    return <CloseoutPage locale={locale} eventId={eventId} markets={markets} />;
  },
  head: ({ match }) =>
    privatePageHead(closeout_title({}, { locale: match.context.locale })),
});
