import { createFileRoute } from '@tanstack/react-router';

import { companyRedirect } from '../lib/company-redirect';

export const Route = createFileRoute('/faq')({
  preload: false,
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: companyRedirect('faq'),
});
