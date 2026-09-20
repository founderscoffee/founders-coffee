import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/activity')({
  preload: false,
  beforeLoad: () => {
    throw redirect({ to: '/profile/activity' });
  },
});
