import type { WorkerEnv } from '@founders-coffee/infra';
import {
  BotApiTelegramProvider,
  DevTelegramProvider,
  type TelegramBotProvider,
} from '@founders-coffee/notifications';

import { workerEnv } from '../env.js';

export interface TelegramSetup {
  readonly botUsername: string;
  readonly webhookSecret: string;
  readonly provider: TelegramBotProvider;
}

type TelegramEnv = Pick<
  WorkerEnv,
  | 'APP_ENVIRONMENT'
  | 'TELEGRAM_BOT_TOKEN'
  | 'TELEGRAM_BOT_USERNAME'
  | 'TELEGRAM_WEBHOOK_SECRET'
>;

/**
 * The Telegram bot this deployment runs, or `null` when it runs none (P1-025).
 *
 * The bot's username and the webhook secret switch the feature on: without the first there is no
 * bot to add to a group, and without the second no update can be trusted. The token picks the real
 * Bot API. Development without a token gets the recording provider, so the panels and the webhook
 * can be exercised locally with no bot at all; anywhere else a missing token turns the feature off,
 * rather than showing members invite links no Telegram group will ever answer.
 */
export const telegramSetup = (
  env: TelegramEnv = workerEnv(),
): TelegramSetup | null => {
  const botUsername = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!botUsername || !webhookSecret) return null;
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (token)
    return {
      botUsername,
      webhookSecret,
      provider: new BotApiTelegramProvider(token),
    };
  if (env.APP_ENVIRONMENT === 'development')
    return { botUsername, webhookSecret, provider: new DevTelegramProvider() };
  return null;
};
