import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostDetailsStep } from './HostDetailsStep';

const show = (
  title = '',
  description = '',
  errors: { languages?: string } = {},
) =>
  render(
    <HostDetailsStep
      locale="en"
      title={title}
      description={description}
      languages={['en', 'ber']}
      constraints={{
        titleMin: 3,
        titleMax: 120,
        descriptionMin: 10,
        descriptionMax: 2000,
      }}
      errors={errors}
      onTitleChange={vi.fn()}
      onDescriptionChange={vi.fn()}
      onLanguagesChange={vi.fn()}
    />,
  );

const describedText = (field: HTMLElement) =>
  (field.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ');

afterEach(() => cleanup());

describe('what a screen reader is told each field is called', () => {
  it('names the title field without reading the badge and the counter into it', () => {
    show();

    const field = screen.getByLabelText('Meetup title');

    expect(field.getAttribute('id')).toBe('host-title');
    expect(describedText(field)).toContain('0 of 120');
  });

  it('names the description field the same way', () => {
    show();

    const field = screen.getByLabelText('Meetup description');

    expect(field.getAttribute('id')).toBe('host-description');
    expect(describedText(field)).toContain('0 of 2000');
  });

  it('leaves the required badge out of the accessible tree, since the field carries required', () => {
    show();

    const field = screen.getByLabelText('Meetup title') as HTMLInputElement;

    expect(field.required).toBe(true);
    expect(
      screen
        .queryAllByText('Required')
        .every((badge) => badge.closest('[aria-hidden="true"]')),
      'announcing it beside a required field repeats what the attribute already says',
    ).toBe(true);
  });

  it('names the language chips as one group and reads the hint and any error into it', () => {
    show('', '', { languages: 'Choose at least one language.' });

    const group = screen.getByRole('group', { name: 'Languages' });

    expect(group.getAttribute('id')).toBe('host-languages');
    expect(describedText(group)).toContain('You can pick more than one.');
    expect(describedText(group)).toContain('Choose at least one language.');
  });

  it('presses the chip of every language the meetup is held in', () => {
    show();

    expect(
      screen
        .getAllByRole('button', { pressed: true })
        .map((chip) => chip.textContent),
    ).toEqual(['English', 'Tamazight']);
  });

  it('keeps no field inside the label element that names it', () => {
    show();

    for (const name of ['Meetup title', 'Meetup description']) {
      expect(screen.getByLabelText(name).closest('label')).toBeNull();
    }
  });
});
