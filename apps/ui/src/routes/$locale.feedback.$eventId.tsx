import { createFileRoute } from '@tanstack/react-router';

import { feedback_title } from '@founders-coffee/i18n';

import { FeedbackPage } from '../features/operations/components/FeedbackPage';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/$locale/feedback/$eventId')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    return <FeedbackPage locale={locale} eventId={eventId} />;
  },
  head: ({ match }) =>
    privatePageHead(feedback_title({}, { locale: match.context.locale })),
});
