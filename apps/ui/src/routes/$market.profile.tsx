import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$market/profile')({
  component: () => <Outlet />,
});
