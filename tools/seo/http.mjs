export const SEO_SMOKE_USER_AGENT = 'founders-coffee-seo-smoke/1.0';

export const fetchSmoke = async (input, init = {}) =>
  fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      'user-agent': SEO_SMOKE_USER_AGENT,
    },
  });
