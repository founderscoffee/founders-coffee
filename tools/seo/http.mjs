export const SEO_SMOKE_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';

const SEO_SMOKE_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'x-founders-coffee-seo-smoke': '1',
};

export const fetchSmoke = async (input, init = {}) =>
  fetch(input, {
    ...init,
    headers: {
      ...SEO_SMOKE_HEADERS,
      ...init.headers,
      'user-agent': SEO_SMOKE_USER_AGENT,
    },
  });
