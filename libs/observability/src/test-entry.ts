/** Minimal worker entry so the vitest-pool-workers runtime can boot with the Analytics Engine binding. */
export default {
  fetch: () => new Response('ok'),
};
