import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { IsolatedValue } from './IsolatedValue.js';

afterEach(cleanup);

const sentence = (reason: string) => `سبب الإلغاء: ${reason}`;

describe('IsolatedValue', () => {
  it('reads as the message would, with the value in its place', () => {
    const { container } = render(
      <p>
        <IsolatedValue value="Venue closed." message={sentence} />
      </p>,
    );

    expect(container.textContent).toBe('سبب الإلغاء: Venue closed.');
  });

  it('sets the value apart so its direction stays out of the sentence', () => {
    const { container } = render(
      <p>
        <IsolatedValue value="Venue closed." message={sentence} />
      </p>,
    );

    const isolated = container.querySelectorAll('bdi');
    expect(isolated).toHaveLength(1);
    expect(
      isolated[0]?.textContent,
      'a Latin reason ending in a full stop inside an Arabic sentence drew the stop on the wrong side',
    ).toBe('Venue closed.');
  });

  it('isolates every place a message names the value, and nothing else', () => {
    const { container } = render(
      <p>
        <IsolatedValue
          value="Amine"
          message={(name) => `${name} hosts; ask ${name}.`}
        />
      </p>,
    );

    expect(
      [...container.querySelectorAll('bdi')].map((node) => node.textContent),
    ).toEqual(['Amine', 'Amine']);
    expect(container.textContent).toBe('Amine hosts; ask Amine.');
  });

  it('isolates a value that opens the sentence', () => {
    const { container } = render(
      <p>
        <IsolatedValue
          value="ياسين"
          message={(host) => `${host} books the table.`}
        />
      </p>,
    );

    expect(container.firstElementChild?.firstChild?.nodeName).toBe('BDI');
    expect(container.textContent).toBe('ياسين books the table.');
  });
});
