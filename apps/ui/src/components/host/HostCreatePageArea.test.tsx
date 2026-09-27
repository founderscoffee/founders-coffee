import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';

import { resetHostCreateFixtures } from './HostCreatePage.fixtures';
import { HostCreatePage } from './HostCreatePage';

const egypt = {
  code: 'EG',
  slug: 'egypt',
  timezone: 'Africa/Cairo',
  name: 'Egypt',
  nameAr: 'مصر',
  nameFr: 'Égypte',
} as Market;

const cairo: geo.GeoCity = {
  code: '397',
  name: 'Cairo',
  nameAr: 'القاهرة',
  nameFr: 'Le Caire',
  slug: 'cairo',
  stateCode: '1',
  featured: true,
};

const renderInFrench = (city: geo.GeoCity | null) =>
  render(
    createElement(HostCreatePage, {
      locale: 'fr',
      market: egypt,
      city,
      mapboxToken: 'map-token',
      turnstileSiteKey: 'test-site-key',
      socialProviders: [],
      repeatTemplate: null,
    }),
  );

const searchArea = () =>
  screen
    .getByLabelText('Search cafés and coworking venues')
    .getAttribute('data-area');

describe('where the host wizard says it looks for venues', () => {
  afterEach(resetHostCreateFixtures);

  it('searches the city the host came from, named in their language', () => {
    renderInFrench(cairo);

    expect(searchArea()).toBe('city:Le Caire');
  });

  it('searches the country when the host came from the navbar with no city', () => {
    renderInFrench(null);

    expect(
      searchArea(),
      'the search box is the one place left that says where the host is looking, since the subtitle went (#121)',
    ).toBe('market:Égypte');
  });
});
