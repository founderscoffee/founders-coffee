import { createFileRoute } from '@tanstack/react-router';

import { securityTxtBody } from '../lib/security-txt';

const securityTxtResponse = (request: Request): Response =>
  new Response(securityTxtBody(new URL(request.url).origin), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

export const Route = createFileRoute('/.well-known/security.txt')({
  server: {
    handlers: {
      GET: ({ request }) => securityTxtResponse(request),
    },
  },
});
