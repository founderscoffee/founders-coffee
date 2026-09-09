/** Profile visibility and session responses must never survive in the service-worker cache. */
export const isPrivateProfilePath = (pathname: string): boolean =>
  /^\/(?:profile|onboarding|login|u)(?:\/|$)/.test(pathname) ||
  /^\/(?:_serverFn|api\/auth)(?:\/|$)/.test(pathname);
