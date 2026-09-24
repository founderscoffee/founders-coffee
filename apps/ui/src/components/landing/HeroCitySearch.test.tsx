import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const search = vi.hoisted(() => ({
  data: [] as unknown[],
  isFetching: false,
}));

vi.mock('../../features/geo/hooks', () => ({
  useCitySearch: () => search,
}));

const { HeroCitySearch } = await import('./HeroCitySearch');

const ORAN = {
  city: {
    code: '310',
    name: 'Oran',
    nameAr: 'وهران',
    slug: 'oran',
    stateCode: '31',
    featured: true,
  },
  state: { code: '31', name: 'Oran', nameAr: 'وهران' },
};

const show = () =>
  render(
    <HeroCitySearch
      marketCode="DZ"
      locale="en"
      placeholder="Find your city"
      noMatchText={'No city matches "{query}"'}
      onSelect={vi.fn()}
      onClear={vi.fn()}
    />,
  );

const type = (text: string) => {
  const box = screen.getByRole('combobox');
  fireEvent.focus(box);
  fireEvent.change(box, { target: { value: text } });
  return box;
};

beforeEach(() => {
  search.data = [];
  search.isFetching = false;
});

afterEach(cleanup);

describe('HeroCitySearch', () => {
  it('says there is no match as information beside the field, outside the list', () => {
    show();
    const box = type('Atlantis');

    const notice = screen.getByRole('status');
    expect(notice.textContent).toBe('No city matches "Atlantis"');
    expect(notice.className).toContain('alert-info');
    expect(
      screen.queryByRole('listbox'),
      'a listbox holds options; a sentence inside one is read as a broken option',
    ).toBeNull();
    expect(box.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the list when there are cities to pick', () => {
    search.data = [ORAN];
    show();
    const box = type('Ora');

    expect(screen.getByRole('option').textContent).toContain('Oran');
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
