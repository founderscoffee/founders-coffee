import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BackArrow, PROVIDER_MARK } from './ProviderIcon';

const pathOf = (locale: 'ar' | 'en' | 'fr') => {
  const { container } = render(<BackArrow locale={locale} />);
  return container.querySelector('path')?.getAttribute('d');
};

describe('BackArrow', () => {
  it('points the way back: right in Arabic, left in the LTR locales', () => {
    const rtl = pathOf('ar');
    const ltr = pathOf('en');

    expect(rtl).toBe('M7.5 4 13.5 10l-6 6');
    expect(ltr).toBe('M12.5 4 6.5 10l6 6');
    expect(pathOf('fr')).toBe(ltr);
  });
});

describe('PROVIDER_MARK', () => {
  it('renders a mark for each provider, hidden from assistive tech', () => {
    for (const provider of ['google', 'github'] as const) {
      const Mark = PROVIDER_MARK[provider];
      const { container } = render(<Mark />);
      const svg = container.querySelector('svg');

      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
