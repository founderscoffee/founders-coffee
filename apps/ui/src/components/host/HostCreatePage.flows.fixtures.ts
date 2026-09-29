import { fireEvent, screen } from '@testing-library/react';

export const goToHostDetails = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Choose venue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Set schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
};

export const fillHostDetails = () => {
  fireEvent.change(screen.getByLabelText(/^Meetup title/), {
    target: { value: 'Protected meetup' },
  });
  fireEvent.change(screen.getByLabelText(/^Meetup description/), {
    target: { value: 'A complete protected meetup for founders.' },
  });
};

export const publishHostEvent = async () => {
  await goToHostDetails();
  fillHostDetails();
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
};
