/** Minimal worker entry so the vitest-pool-workers runtime can boot. */
export default {
  fetch: () => new Response('ok'),
};
