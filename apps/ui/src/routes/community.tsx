import { createFileRoute } from '@tanstack/react-router';

import { companyRedirect } from '../lib/company-redirect';

export const Route = createFileRoute('/community')({
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: companyRedirect('community'),
});
