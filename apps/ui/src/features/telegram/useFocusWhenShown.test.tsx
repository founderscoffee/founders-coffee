import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useFocusWhenShown } from './useFocusWhenShown';

const Harness = () => {
  const { container, focusWhenShown } = useFocusWhenShown<HTMLDivElement>();
  const [isShown, setIsShown] = useState(false);
  const [renders, setRenders] = useState(0);
  return (
    <div ref={container}>
      <button
        type="button"
        onClick={() => {
          setIsShown(true);
          focusWhenShown('next');
        }}
      >
        Step
      </button>
      {isShown ? (
        <button type="button" data-focus="next">
          Next
        </button>
      ) : null}
      <button type="button" onClick={() => setRenders(renders + 1)}>
        Elsewhere {renders}
      </button>
    </div>
  );
};

afterEach(cleanup);

describe('useFocusWhenShown', () => {
  it('focuses the control a step puts in place once it is shown', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Step' }));

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Next' }),
    );
  });

  it('lets focus go once it has been given, however often the panel renders', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Step' }));

    const elsewhere = screen.getByRole('button', { name: /Elsewhere/ });
    elsewhere.focus();
    fireEvent.click(elsewhere);

    expect(document.activeElement).toBe(elsewhere);
  });
});
