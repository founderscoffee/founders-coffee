/** Profile visibility and session responses must never survive in the service-worker cache. */
export const isPrivateProfilePath = (pathname: string): boolean =>
  /^\/(?:profile|account|onboarding|login|u)(?:\/|$)/.test(pathname) ||
  /^\/(?:_serverFn|api\/auth)(?:\/|$)/.test(pathname);

/** A cached page carries whatever the server rendered for whoever asked for it. */
export const isCachedDocument = (response: Response | undefined): boolean =>
  response?.headers.get('content-type')?.includes('text/html') ?? false;

const sweepCaches = async (
  storage: CacheStorage,
  shouldDelete: (request: Request, response: Response | undefined) => boolean,
): Promise<void> => {
  for (const name of await storage.keys()) {
    const cache = await storage.open(name);
    for (const request of await cache.keys()) {
      if (shouldDelete(request, await cache.match(request)))
        await cache.delete(request);
    }
  }
};

/** Drop the stored responses that are private by their path alone. */
export const purgePrivateCacheEntries = (
  storage: CacheStorage,
): Promise<void> =>
  sweepCaches(storage, (request) =>
    isPrivateProfilePath(new URL(request.url).pathname),
  );

/**
 * Drop everything the member who just left could still be recognised in.
 *
 * Wider than {@link purgePrivateCacheEntries}, because a public URL is not a public response: an
 * event page is served to anyone, and the copy in this cache says whether *you* are going and
 * renders the host controls if it was you who created it. Every cached document goes, whatever its
 * path. Hashed assets stay — they are the same bytes for everyone, and an account switch is a poor
 * reason to make the next member download the application again.
 */
export const purgeMemberCacheEntries = (storage: CacheStorage): Promise<void> =>
  sweepCaches(
    storage,
    (request, response) =>
      isPrivateProfilePath(new URL(request.url).pathname) ||
      isCachedDocument(response),
  );
