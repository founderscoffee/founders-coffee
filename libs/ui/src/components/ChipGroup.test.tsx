import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toggleChip } from '../lib/chips.js';
import { ChipGroup } from './ChipGroup.js';

const LANGUAGES = ['ar', 'fr', 'en'] as const;

const renderGroup = (props: Partial<Parameters<typeof ChipGroup>[0]> = {}) => {
  const onToggle = vi.fn();
  render(
    <ChipGroup
      options={LANGUAGES}
      selected={['ar']}
      max={LANGUAGES.length}
      groupLabel="Languages"
      labelFor={(option) => option.toUpperCase()}
      onToggle={onToggle}
      {...props}
    />,
  );
  return onToggle;
};

afterEach(cleanup);

describe('ChipGroup', () => {
  it('presses the selected chips and reports a tap on any of them', () => {
    const onToggle = renderGroup();

    expect(
      screen
        .getAllByRole('button')
        .map((chip) => chip.getAttribute('aria-pressed')),
    ).toEqual(['true', 'false', 'false']);
    fireEvent.click(screen.getByRole('button', { name: 'FR' }));
    expect(onToggle).toHaveBeenCalledWith('fr');
  });

  it('can be focused by its id and described, so a missing answer can be pointed at', () => {
    renderGroup({ id: 'meetup-languages', describedBy: 'meetup-hint' });
    const group = screen.getByRole('group', { name: 'Languages' });

    group.focus();

    expect(document.activeElement).toBe(group);
    expect(group.getAttribute('aria-describedby')).toBe('meetup-hint');
  });

  it('stays out of the tab order, where its chips already are', () => {
    renderGroup({ id: 'meetup-languages' });

    expect(
      screen.getByRole('group', { name: 'Languages' }).getAttribute('tabindex'),
    ).toBe('-1');
  });
});

describe('toggleChip', () => {
  it('adds an option at the end and takes a selected one out', () => {
    expect(toggleChip(['ar'], 'fr', 3)).toEqual(['ar', 'fr']);
    expect(toggleChip(['ar', 'fr'], 'ar', 3)).toEqual(['fr']);
  });

  it('adds nothing once the group is full', () => {
    expect(toggleChip(['ar', 'fr'], 'en', 2)).toEqual(['ar', 'fr']);
  });
});
