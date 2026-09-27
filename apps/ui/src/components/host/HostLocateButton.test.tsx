import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostLocateButton } from './HostLocateButton';

afterEach(cleanup);

describe('HostLocateButton', () => {
  it('stays in the map’s corner, whatever opens over the map beside it', () => {
    render(<HostLocateButton locale="en" onClick={vi.fn()} />);

    const corner = screen.getByRole('button', {
      name: 'Locate me',
    }).parentElement;
    expect(corner?.className).toContain('start-3');
    expect(corner?.className).toContain('top-3');
    expect(
      corner?.style.transform,
      'a list opening over the map covers the button rather than pushing it down',
    ).toBe('');
  });

  it('reports its size while it is on the page, and nothing once it leaves', () => {
    const onResize = vi.fn();
    const { unmount } = render(
      <HostLocateButton locale="en" onResize={onResize} onClick={vi.fn()} />,
    );
    const button = screen.getByRole('button', { name: 'Locate me' });

    expect(onResize).toHaveBeenLastCalledWith({
      width: button.offsetWidth,
      height: button.offsetHeight,
    });

    unmount();
    expect(
      onResize,
      'a hint kept beside a button that has gone would stop short of nothing',
    ).toHaveBeenLastCalledWith(null);
  });
});
