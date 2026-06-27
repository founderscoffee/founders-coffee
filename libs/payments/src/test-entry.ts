/** Minimal worker entry so the vitest-pool-workers runtime can boot with the D1 binding. */
export default {
  fetch: () => new Response('ok'),
};
