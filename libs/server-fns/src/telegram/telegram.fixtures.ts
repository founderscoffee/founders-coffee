import { env } from 'cloudflare:workers';

import { id } from '@founders-coffee/core';
import {
  and,
  completeTelegramConnect,
  createDb,
  createEvent,
  createRsvp,
  eq,
  markets,
  openTelegramConnect,
  scheduledNotifications,
  seed,
  user,
  type Db,
  type Event,
  type NewEvent,
  type ScheduledNotification,
} from '@founders-coffee/db';
import {
  DevTelegramProvider,
  type TelegramChatMember,
} from '@founders-coffee/notifications';

import type { TelegramSetup } from './config.js';
import { createConnectToken, hashConnectToken } from './token.js';
import type { TelegramMessage } from './updates.js';

export const HOST_ID = 'usr_telegramhost';
export const MEMBER_IDS = ['usr_tgm0', 'usr_tgm1', 'usr_tgm2'] as const;

let meetupCounter = 0;
let chatCounter = 0;

/** A chat id no other test in the file has used, since D1 is shared across a file's tests. */
export const nextChatId = (): number => -1003000000000 - ++chatCounter;

export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .update(markets)
    .set({ state: 'active' })
    .where(eq(markets.code, 'DZ'))
    .run();
  await db
    .insert(user)
    .values([
      {
        id: HOST_ID,
        name: 'Telegram Host',
        email: 'host@telegram.test',
        emailVerified: false,
        role: 'host',
      },
      ...MEMBER_IDS.map((memberId, index) => ({
        id: memberId,
        name: `Telegram Member ${index}`,
        email: `member${index}@telegram.test`,
        emailVerified: false,
        role: 'member' as const,
      })),
    ])
    .onConflictDoNothing()
    .run();
  return db;
};

/** A published meetup in Algiers, far enough ahead for every reminder, in English unless told. */
export const seedMeetup = async (
  db: Db,
  overrides: Partial<NewEvent> = {},
): Promise<Event> => {
  const n = ++meetupCounter;
  return createEvent(db, {
    id: id('evt'),
    slug: `telegram-meetup-${n}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '556',
    title: `Coffee and code ${n}`,
    description: 'Telegram group fixture.',
    venue: 'Café des Délices',
    venueAddress: '12 Rue Didouche Mourad',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    endsAt: new Date('2099-01-15T20:00:00Z'),
    language: 'en',
    status: 'published',
    ...overrides,
  });
};

/** Connect a meetup to a fresh chat the way the webhook does, and answer the chat's id. */
export const connectMeetup = async (
  db: Db,
  event: Event,
  chatId: number = nextChatId(),
): Promise<number> => {
  const now = new Date();
  const tokenHash = `fixture_${event.id}_${chatId}`;
  await openTelegramConnect(db, {
    eventId: event.id,
    tokenHash,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    now,
  });
  await completeTelegramConnect(db, {
    eventId: event.id,
    tokenHash,
    chatId,
    chatTitle: 'Coffee group',
    now,
  });
  return chatId;
};

export const attend = async (
  db: Db,
  eventId: string,
  userId: string,
): Promise<void> => {
  await createRsvp(db, { id: id('rsvp'), eventId, userId });
};

/** The meetup's group rows, oldest first, whatever their status. */
export const telegramRows = async (
  db: Db,
  eventId: string,
): Promise<ScheduledNotification[]> => {
  const rows = await db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.eventId, eventId),
        eq(scheduledNotifications.channel, 'telegram'),
      ),
    );
  return rows.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
};

export const pendingKeys = async (db: Db, eventId: string): Promise<string[]> =>
  (await telegramRows(db, eventId))
    .filter((row) => row.status === 'pending')
    .map((row) => row.templateKey);

export interface TelegramPayloadFields {
  readonly telegramText?: string;
  readonly telegramPinnedText?: string;
  readonly telegramChatId?: number;
  readonly telegramUserId?: number;
  readonly telegramInviteLink?: string;
  readonly telegramInviteLinks?: string[];
  readonly locale?: string;
}

/** A group row's payload, read as the Telegram fields it may carry. */
export const payloadOf = (
  row: { payload: Record<string, unknown> } | undefined,
): TelegramPayloadFields => (row?.payload ?? {}) as TelegramPayloadFields;

export const BOT_USERNAME = 'FoundersCoffeeBot';
export const WEBHOOK_SECRET = 'webhook-secret-for-tests';
export const ADMIN_ID = 5100000001;

/** Open a Connect link for a meetup the way the host's panel does, and answer its token. */
export const openConnect = async (
  db: Db,
  event: Event,
  now: Date = new Date(),
): Promise<string> => {
  const token = createConnectToken();
  await openTelegramConnect(db, {
    eventId: event.id,
    tokenHash: await hashConnectToken(token),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    now,
  });
  return token;
};

/** The bot as tests run it: the recording provider, which finds `members` and refuses as told. */
export const devSetup = (
  members: ReadonlyMap<number, TelegramChatMember> = new Map(),
  failures: NonNullable<
    ConstructorParameters<typeof DevTelegramProvider>[0]
  >['failures'] = {},
): TelegramSetup & { provider: DevTelegramProvider } => ({
  botUsername: BOT_USERNAME,
  webhookSecret: WEBHOOK_SECRET,
  provider: new DevTelegramProvider({ members, failures }),
});

/** A message posted in a supergroup, by the group's admin unless told. */
export const groupMessage = (
  chatId: number,
  text: string,
  fromId: number = ADMIN_ID,
): TelegramMessage => ({
  chat: { id: chatId, type: 'supergroup', title: 'Coffee group' },
  from: { id: fromId },
  text,
});
