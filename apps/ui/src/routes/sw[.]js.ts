import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/sw.js')({
  loader: async () => {
    throw notFound();
  },
  component: () => null,
  head: () => ({ meta: [], links: [], scripts: [] }),
});
