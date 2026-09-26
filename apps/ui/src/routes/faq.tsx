import { createFileRoute } from '@tanstack/react-router';

import { companyRedirect } from '../lib/company-redirect';

export const Route = createFileRoute('/faq')({
  beforeLoad: companyRedirect('faq'),
});
