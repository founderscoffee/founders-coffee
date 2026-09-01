import { useEffect, useState, type ReactNode } from 'react';

/**
 * Renders `fallback` on the server (and during the first client pass), then `children` after mount.
 * Used to keep modules that touch browser-only globals, such as the WebGL map renderer, out of the
 * SSR bundle entirely.
 */
export const ClientOnly = ({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
};
