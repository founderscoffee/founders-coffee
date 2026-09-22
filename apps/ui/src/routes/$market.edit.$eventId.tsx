import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, host_edit_title, isLocale } from '@founders-coffee/i18n';

import { EventEditPage } from '../features/events/components/EventEditPage';
import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedEventEdit } from '../lib/locale-routing';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/$market/edit/$eventId')({
  preload: false,
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  beforeLoad: ({ params }) => {
    if (!isLocale(params.market))
      throw redirect(
        localizedEventEdit(detectLocale(readCookieHeader()), params.eventId),
      );
  },
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    return (
      <EventEditPage locale={locale} eventId={eventId} markets={markets} />
    );
  },
  head: ({ match }) =>
    privatePageHead(host_edit_title({}, { locale: match.context.locale })),
});
