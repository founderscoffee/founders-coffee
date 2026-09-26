import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';

vi.mock('./useCoveredHeight', () => {
  const refs = new Map<
    (height: number) => void,
    (node: HTMLElement | null) => void
  >();
  return {
    useCoveredHeight: (onCoverChange: (height: number) => void) => {
      if (!refs.has(onCoverChange)) {
        refs.set(onCoverChange, (node) => onCoverChange(node ? 238 : 0));
      }
      return refs.get(onCoverChange);
    },
  };
});

describe('the venue list folded over the map on a phone', () => {
  afterEach(resetHostCreateFixtures);

  it('unfolds when Next finds the chosen address unnamed, so the host sees why', async () => {
    renderHostCreateWizard();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose address' }),
    );
    const toggle = screen.getByRole('button', { name: 'Selected location' });
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      toggle.getAttribute('aria-expanded'),
      'the missing name was reported inside a list folded out of sight',
    ).toBe('true');
    expect(
      screen.getByText('Name the venue so attendees can find the entrance.'),
    ).toBeTruthy();
  });
});
