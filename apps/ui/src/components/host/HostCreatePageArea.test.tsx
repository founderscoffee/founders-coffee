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
      hasSocial: false,
      repeatTemplate: null,
    }),
  );

describe('where the host wizard says it looks for venues', () => {
  afterEach(resetHostCreateFixtures);

  it('looks au Caire when the host came from the Cairo page', () => {
    renderInFrench(cairo);

    expect(
      screen.getByText('Cafés et espaces de coworking au Caire.'),
    ).toBeTruthy();
  });

  it('looks en Égypte when the host came from the navbar with no city', () => {
    renderInFrench(null);

    expect(
      screen.getByText('Cafés et espaces de coworking en Égypte.'),
      'the country went where the city goes, after the à a city takes: "à Égypte"',
    ).toBeTruthy();
  });
});
