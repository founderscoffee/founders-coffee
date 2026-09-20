import { createFileRoute } from '@tanstack/react-router';

import { companyRedirect } from '../lib/company-redirect';

export const Route = createFileRoute('/privacy')({
  preload: false,
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: companyRedirect('privacy'),
});
