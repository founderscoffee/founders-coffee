import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/preferences')({
  beforeLoad: () => {
    throw redirect({ to: '/profile/notifications' });
  },
});
