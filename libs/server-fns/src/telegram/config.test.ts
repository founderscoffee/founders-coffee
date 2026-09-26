import { describe, expect, it } from 'vitest';

import {
  BotApiTelegramProvider,
  DEV_TELEGRAM_BOT_ID,
  DevTelegramProvider,
} from '@founders-coffee/notifications';

import { telegramSetup } from './config.js';

const configured = {
  TELEGRAM_BOT_USERNAME: ' @FoundersCoffeeBot ',
  TELEGRAM_WEBHOOK_SECRET: ' webhook-secret ',
};

describe('the Telegram bot a deployment runs', () => {
  it('runs none without a username or a webhook secret', () => {
    expect(
      telegramSetup({
        TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
        TELEGRAM_BOT_TOKEN: '123:abc',
      }),
    ).toBeNull();
    expect(
      telegramSetup({
        TELEGRAM_BOT_USERNAME: 'FoundersCoffeeBot',
        TELEGRAM_BOT_TOKEN: '123:abc',
      }),
    ).toBeNull();
  });

  it('talks to the Bot API as the bot the token names', () => {
    const setup = telegramSetup({
      ...configured,
      TELEGRAM_BOT_TOKEN: '424242:secret-part',
      APP_ENVIRONMENT: 'production',
    });

    expect(setup).toMatchObject({
      botUsername: 'FoundersCoffeeBot',
      webhookSecret: 'webhook-secret',
    });
    expect(setup?.provider).toBeInstanceOf(BotApiTelegramProvider);
    expect(setup?.provider.botId).toBe(424242);
  });

  it('records calls in development without a token, and is off anywhere else', () => {
    const local = telegramSetup({
      ...configured,
      APP_ENVIRONMENT: 'development',
    });

    expect(local?.provider).toBeInstanceOf(DevTelegramProvider);
    expect(local?.provider.botId).toBe(DEV_TELEGRAM_BOT_ID);
    expect(
      telegramSetup({ ...configured, APP_ENVIRONMENT: 'staging' }),
    ).toBeNull();
  });
});
