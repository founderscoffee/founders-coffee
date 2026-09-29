import { createFileRoute, redirect } from '@tanstack/react-router';

import {
  authReturnSearchSchema,
  pathDestination,
  withoutDefaultReturnPath,
} from '../lib/redirect';

export const Route = createFileRoute('/onboarding')({
  validateSearch: authReturnSearchSchema,
  search: { middlewares: [withoutDefaultReturnPath()] },
  beforeLoad: ({ search }) => {
    throw redirect(pathDestination(search.redirect));
  },
});
