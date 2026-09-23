import { createFileRoute } from '@tanstack/react-router';

import { host_edit_title } from '@founders-coffee/i18n';

import { EventEditPage } from '../features/events/components/EventEditPage';
import { eventsApi } from '../features/events/api';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/$locale/edit/$eventId')({
  preload: false,
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  loader: async (): Promise<{ mapboxToken: string }> => ({
    mapboxToken: await eventsApi.getMapboxToken(),
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    const { mapboxToken } = Route.useLoaderData();
    return (
      <EventEditPage
        locale={locale}
        eventId={eventId}
        mapboxToken={mapboxToken}
        markets={markets}
      />
    );
  },
  head: ({ match }) =>
    privatePageHead(host_edit_title({}, { locale: match.context.locale })),
});
