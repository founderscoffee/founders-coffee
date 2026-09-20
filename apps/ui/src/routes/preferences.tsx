import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/preferences')({
  preload: false,
  beforeLoad: () => {
    throw redirect({ to: '/profile/notifications' });
  },
});
