import { createFileRoute } from '@tanstack/react-router';

import { feedback_title } from '@founders-coffee/i18n';

import { FeedbackPage } from '../features/operations/components/FeedbackPage';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { requireSession } from '../features/auth/require-session';
import { privatePageHead } from '../lib/seo-private';

const FeedbackRoute = () => {
  const { locale } = Route.useRouteContext();
  const { eventId } = Route.useParams();
  return <FeedbackPage locale={locale} eventId={eventId} />;
};

export const Route = createFileRoute('/$locale/feedback/$eventId')({
  beforeLoad: async ({ location, context }) => {
    await requireSession(context.locale, location.href);
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: FeedbackRoute,
  head: ({ match }) =>
    privatePageHead(feedback_title({}, { locale: match.context.locale })),
});
