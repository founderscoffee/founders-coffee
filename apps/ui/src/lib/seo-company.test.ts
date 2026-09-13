import { describe, expect, it } from 'vitest';

import { organizationJsonLd } from './seo-company';

describe('organization structured data', () => {
  it('omits empty authority signals', () => {
    const organization = JSON.parse(organizationJsonLd()) as Record<
      string,
      unknown
    >;

    expect(organization).not.toHaveProperty('sameAs');
  });
});
