import { createFileRoute, redirect } from '@tanstack/react-router';

import { feedback_title, detectLocale, isLocale } from '@founders-coffee/i18n';

import { FeedbackPage } from '../features/operations/components/FeedbackPage';
import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedFeedback } from '../lib/locale-routing';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/$market/feedback/$eventId')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  beforeLoad: ({ params }) => {
    if (!isLocale(params.market))
      throw redirect(
        localizedFeedback(detectLocale(readCookieHeader()), params.eventId),
      );
  },
  component: () => {
    const { locale } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    return <FeedbackPage locale={locale} eventId={eventId} />;
  },
  head: ({ match }) =>
    privatePageHead(feedback_title({}, { locale: match.context.locale })),
});
