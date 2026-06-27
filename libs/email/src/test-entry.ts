/** Minimal worker entry so the vitest-pool-workers runtime can boot with the EMAIL binding. */
export default {
  fetch: () => new Response('ok'),
};
