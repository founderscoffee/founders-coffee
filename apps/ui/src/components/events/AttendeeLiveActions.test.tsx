import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  confirm,
  live_running_late_cta,
  live_walking_in_cta,
} from '@founders-coffee/i18n';

import { AttendeeLiveActions } from './AttendeeLiveActions';

const AR = { locale: 'ar' } as const;

const show = () =>
  render(
    <AttendeeLiveActions
      locale="ar"
      onWalkingIn={vi.fn()}
      onRunningLate={vi.fn()}
    />,
  );

const named = (text: string) => screen.getByRole('button', { name: text });

const classesOn = (text: string) => named(text).className.split(/\s+/u);

const alarming = () =>
  [...document.querySelectorAll('button')]
    .filter((button) => /btn-(error|success|warning)/u.test(button.className))
    .map((button) => (button.textContent ?? '').trim());

const openEtaForm = () => {
  show();
  fireEvent.click(named(live_running_late_cta({}, AR)));
};

afterEach(() => cleanup());

describe('what the live room asks of someone who is not there yet', () => {
  it('paints neither answer as a state to be alarmed by', () => {
    show();

    expect(
      alarming(),
      'running late is a courtesy to a table of people waiting, not a fault to confess, and walking in is not an outcome to celebrate in green; both are ordinary things to tell a room',
    ).toEqual([]);
  });

  it('paints nothing in the arrival-time form that way either', () => {
    openEtaForm();

    expect(
      alarming(),
      'the button that actually sends the message was the loudest of the lot: solid danger red, on a courtesy',
    ).toEqual([]);
  });

  it('keeps one clear primary, in the colour the page already uses for its main action', () => {
    show();

    expect(classesOn(live_walking_in_cta({}, AR))).toContain('btn-secondary');
    expect(
      classesOn(live_running_late_cta({}, AR)),
      'the two are peers, so the second reads as an outline beside the first rather than competing with it',
    ).toContain('btn-outline');
  });

  it('sends the arrival time when the form is confirmed', () => {
    const onRunningLate = vi.fn();
    render(
      <AttendeeLiveActions
        locale="ar"
        onWalkingIn={vi.fn()}
        onRunningLate={onRunningLate}
      />,
    );
    fireEvent.click(named(live_running_late_cta({}, AR)));
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '15' },
    });
    fireEvent.click(named(confirm({}, AR)));

    expect(
      onRunningLate,
      'restyling the form must not stop it doing the one thing it is for',
    ).toHaveBeenCalledWith(15);
  });
});
