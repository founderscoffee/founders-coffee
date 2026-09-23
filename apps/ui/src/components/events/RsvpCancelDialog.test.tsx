import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RsvpCancelDialog } from './RsvpCancelDialog';

const show = () =>
  render(
    <RsvpCancelDialog
      isOpen={true}
      hostName="أمينة"
      locale="ar"
      isPending={false}
      onKeep={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );

afterEach(() => cleanup());

describe('how the cancel dialog announces itself', () => {
  it('is named by the question it is asking', () => {
    show();

    expect(
      screen.getByRole('dialog', { name: 'تريد التخلّي عن مقعدك؟' }),
      'the heading sits inside the dialog, which names nothing on its own; only aria-labelledby carries it to the dialog, and only if the id it points at is really on the heading',
    ).toBeTruthy();
  });

  it('gives two dialogs on one page two names of their own', () => {
    show();
    show();

    expect(
      screen.getAllByRole('dialog', { name: 'تريد التخلّي عن مقعدك؟' }),
      'a hardcoded id would collide the moment a page rendered a second one, and every dialog would answer to the first heading',
    ).toHaveLength(2);
    const ids = screen
      .getAllByRole('dialog')
      .map((dialog) => dialog.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(2);
  });
});
