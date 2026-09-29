import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { IsolatedLines } from './IsolatedLines.js';

afterEach(cleanup);

const DESCRIPTION = 'نلتقي في الطابق الأول.\nBring a friend!\n\n(12:00)';

describe('IsolatedLines', () => {
  it('reads exactly as the text it was given, line breaks included', () => {
    const { container } = render(
      <p>
        <IsolatedLines text={DESCRIPTION} />
      </p>,
    );

    expect(container.textContent).toBe(DESCRIPTION);
  });

  it('sets every line apart, so each takes its own direction and none spans a break', () => {
    const { container } = render(
      <p>
        <IsolatedLines text={DESCRIPTION} />
      </p>,
    );

    expect(
      [...container.querySelectorAll('bdi')].map((line) => line.textContent),
      'one isolate across a line break leaves how the lines after it read to each browser',
    ).toEqual(['نلتقي في الطابق الأول.', 'Bring a friend!', '', '(12:00)']);
  });

  it('isolates a single line once', () => {
    const { container } = render(
      <p>
        <IsolatedLines text="Bring a friend!" />
      </p>,
    );

    expect(container.querySelectorAll('bdi')).toHaveLength(1);
    expect(container.textContent).toBe('Bring a friend!');
  });
});
