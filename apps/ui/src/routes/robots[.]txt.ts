import { createFileRoute } from '@tanstack/react-router';

import { robotsBodyForOrigin } from '../lib/indexation';

const robotsResponse = (request: Request): Response =>
  new Response(robotsBodyForOrigin(new URL(request.url).origin), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: ({ request }) => robotsResponse(request),
    },
  },
});
