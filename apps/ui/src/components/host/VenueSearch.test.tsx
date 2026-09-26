import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VenueSearch } from './VenueSearch';

const renderSearch = (over: Record<string, unknown> = {}) =>
  render(
    <VenueSearch
      locale="en"
      area={{ kind: 'city', name: 'Constantine' }}
      value="cafe"
      listId="venue-results"
      hasResults={false}
      isLoading={false}
      onChange={vi.fn()}
      onRetry={vi.fn()}
      {...over}
    />,
  );

afterEach(cleanup);

describe('the venue search box', () => {
  it('announces itself as the control that fills the results', () => {
    renderSearch();
    const input = screen.getByRole('combobox');

    expect(input.getAttribute('aria-controls')).toBe('venue-results');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(
      input.getAttribute('aria-expanded'),
      'nothing told a screen-reader user that results had appeared, or that any existed to appear',
    ).toBe('false');
  });

  it('says when results are there to be moved into', () => {
    renderSearch({ hasResults: true });

    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('asks for the same thing in the label and in the box', () => {
    renderSearch();
    const label = screen.getByLabelText(/./u, { selector: 'input' });

    expect(
      label.getAttribute('placeholder'),
      'the label offered cafes and coworking spaces and the placeholder offered only a cafe, so the box contradicted its own name',
    ).toMatch(/coworking/iu);
  });

  it('searches au Caire in French, where the article of Le Caire merges into à', () => {
    renderSearch({ locale: 'fr', area: { kind: 'city', name: 'Le Caire' } });

    expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe(
      'Rechercher un café ou un espace de coworking au Caire…',
    );
  });

  it('searches the country with en when the host has not picked a city', () => {
    renderSearch({ locale: 'fr', area: { kind: 'market', name: 'Égypte' } });

    expect(
      screen.getByRole('combobox').getAttribute('placeholder'),
      'the wizard opened from the navbar put the country where the city goes, "à Égypte"',
    ).toBe('Rechercher un café ou un espace de coworking en Égypte…');
  });
});
