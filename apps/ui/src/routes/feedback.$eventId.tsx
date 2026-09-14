import { createFileRoute } from '@tanstack/react-router';

import { FeedbackPage } from '../features/operations/components/FeedbackPage';
import { NO_INDEX_VALUE } from '../lib/indexation';

export const Route = createFileRoute('/feedback/$eventId')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    return <FeedbackPage locale={locale} eventId={eventId} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
