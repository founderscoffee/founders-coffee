import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { host_next, type Locale } from '@founders-coffee/i18n';

import {
  getHostCreateMocks,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';
import {
  fillHostDetails,
  goToHostDetails,
} from './HostCreatePage.flows.fixtures';

const hostCreateMocks = getHostCreateMocks();

const chip = (name: string) => screen.getByRole('button', { name });

const PAGE = {
  ar: { group: 'لغات اللقاء', own: 'العربية' },
  fr: { group: 'Langues', own: 'Français' },
  en: { group: 'Languages', own: 'English' },
} as const satisfies Record<Locale, { group: string; own: string }>;

const goToDetailsIn = async (locale: Locale) => {
  const next = () =>
    fireEvent.click(
      screen.getByRole('button', { name: host_next({}, { locale }) }),
    );
  fireEvent.click(await screen.findByRole('button', { name: 'Choose venue' }));
  next();
  fireEvent.click(screen.getByRole('button', { name: 'Set schedule' }));
  next();
};

const pressed = (group: string) =>
  within(screen.getByRole('group', { name: group }))
    .getAllByRole('button', { pressed: true })
    .map((button) => button.textContent);

describe('the languages a meetup is held in', () => {
  afterEach(resetHostCreateFixtures);

  it.each(['ar', 'fr', 'en'] as const)(
    'starts on the language the page is read in, in %s',
    async (locale) => {
      renderHostCreateWizard(locale);
      await goToDetailsIn(locale);

      expect(pressed(PAGE[locale].group)).toEqual([PAGE[locale].own]);
    },
  );

  it('follows the page into another language while the host has chosen none', async () => {
    const wizard = renderHostCreateWizard('en');
    await goToHostDetails();
    wizard.switchLocale('ar');

    await waitFor(() =>
      expect(
        pressed('لغات اللقاء'),
        'a draft begun in English went on offering English on the Arabic page',
      ).toEqual(['العربية']),
    );
  });

  it('keeps a choice the host made through a switch of page language', async () => {
    const wizard = renderHostCreateWizard('en');
    await goToHostDetails();
    fireEvent.click(chip('French'));
    wizard.switchLocale('ar');

    await waitFor(() =>
      expect(pressed('لغات اللقاء')).toEqual(['الفرنسية', 'الإنجليزية']),
    );
  });

  it('publishes every language the host picked', async () => {
    renderHostCreateWizard('en');
    await goToHostDetails();
    fillHostDetails();
    fireEvent.click(chip('Arabic'));
    fireEvent.click(chip('Tamazight'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(hostCreateMocks.mutateAsync).toHaveBeenCalledOnce(),
    );
    expect(hostCreateMocks.mutateAsync).toHaveBeenCalledWith({
      data: {
        event: expect.objectContaining({ languages: ['en', 'ar', 'ber'] }),
      },
    });
  });

  it('will not publish a meetup held in no language, and points at the chips', async () => {
    renderHostCreateWizard('en');
    await goToHostDetails();
    fillHostDetails();
    fireEvent.click(chip('English'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(
      await screen.findByText('Choose at least one language.'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement?.id).toBe('host-languages'),
    );
    expect(hostCreateMocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('keeps the choice when the host steps back and forward again', async () => {
    renderHostCreateWizard('en');
    await goToHostDetails();
    fireEvent.click(chip('French'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(pressed('Languages')).toEqual(['French', 'English']);
  });
});
