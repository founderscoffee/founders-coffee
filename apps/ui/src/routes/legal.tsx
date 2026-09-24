import { createFileRoute } from '@tanstack/react-router';

import { companyRedirect } from '../lib/company-redirect';

export const Route = createFileRoute('/legal')({
  preload: false,
  beforeLoad: companyRedirect('legal'),
});
