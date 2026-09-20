import { createFileRoute, redirect } from '@tanstack/react-router';

import { closeout_title, detectLocale, isLocale } from '@founders-coffee/i18n';

import { CloseoutPage } from '../features/operations/components/CloseoutPage';
import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedCloseout } from '../lib/locale-routing';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/$market/closeout/$eventId')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  beforeLoad: ({ params }) => {
    if (!isLocale(params.market))
      throw redirect(
        localizedCloseout(detectLocale(readCookieHeader()), params.eventId),
      );
  },
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    return <CloseoutPage locale={locale} eventId={eventId} markets={markets} />;
  },
  head: ({ match }) =>
    privatePageHead(closeout_title({}, { locale: match.context.locale })),
});
