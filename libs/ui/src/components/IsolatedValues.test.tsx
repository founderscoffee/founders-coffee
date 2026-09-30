import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { IsolatedValues } from './IsolatedValues.js';

afterEach(cleanup);

const isolatedIn = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll('bdi')].map((node) => node.textContent);

describe('IsolatedValues', () => {
  it('reads as the message would, with each value in its own place', () => {
    const { container } = render(
      <p>
        <IsolatedValues
          values={{ date: 'الخميس 15 يناير 19:00', venue: 'Café des Délices' }}
          message={(slot) => `الموعد الجديد ${slot.date} في ${slot.venue}.`}
        />
      </p>,
    );

    expect(container.textContent).toBe(
      'الموعد الجديد الخميس 15 يناير 19:00 في Café des Délices.',
    );
    expect(isolatedIn(container)).toEqual([
      'الخميس 15 يناير 19:00',
      'Café des Délices',
    ]);
  });

  it('keeps two values apart when the message sets them side by side', () => {
    const { container } = render(
      <p>
        <IsolatedValues
          values={{ venue: 'Café des Délices', address: '12 Rue Didouche' }}
          message={(slot) => `${slot.venue}، ${slot.address}`}
        />
      </p>,
    );

    expect(
      isolatedIn(container),
      'a Latin venue and a Latin address in one isolate would read as one run, the Arabic comma inside it',
    ).toEqual(['Café des Délices', '12 Rue Didouche']);
    expect(container.textContent).toBe('Café des Délices، 12 Rue Didouche');
  });

  it('shows a value as it was written, even one that reads like a slot', () => {
    const { container } = render(
      <p>
        <IsolatedValues
          values={{ reason: '<<VALUE:venue>>', venue: 'Café' }}
          message={(slot) => `Reason: ${slot.reason}`}
        />
      </p>,
    );

    expect(container.textContent).toBe('Reason: <<VALUE:venue>>');
    expect(isolatedIn(container)).toEqual(['<<VALUE:venue>>']);
  });
});
