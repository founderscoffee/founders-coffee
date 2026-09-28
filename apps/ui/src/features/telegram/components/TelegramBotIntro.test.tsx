import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { telegram_host_intro } from '@founders-coffee/i18n';

import { TelegramBotIntro } from './TelegramBotIntro';

const HANDLE = '@FoundersCoffeeBot';

afterEach(() => cleanup());

describe('TelegramBotIntro', () => {
  it.each(['ar', 'fr', 'en'] as const)(
    'reads as the %s catalogue writes it, with the handle as a link to the bot',
    (locale) => {
      const { container } = render(
        <TelegramBotIntro locale={locale} botHandle={HANDLE} />,
      );
      const link = screen.getByRole('link', { name: HANDLE });

      expect(container.textContent).toBe(
        telegram_host_intro({ bot: HANDLE }, { locale }),
      );
      expect(link.getAttribute('href')).toBe('https://t.me/FoundersCoffeeBot');
      expect(
        link.getAttribute('dir'),
        'a handle is written left to right, even in an Arabic sentence',
      ).toBe('ltr');
    },
  );
});
