import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/account')({
  preload: false,
  beforeLoad: () => {
    throw redirect({ to: '/profile/account' });
  },
});
