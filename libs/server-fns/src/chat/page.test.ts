import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cancelRsvp,
  createDb,
  markChatRead,
  setChatMuted,
  type Db,
} from '@founders-coffee/db';

import {
  ban,
  endMeetupAgo,
  goingMember,
  HOST_ID,
  newMember,
  publishMeetup,
  setupDb,
} from './chat.fixtures.js';
import { sendChatMessageResolver } from './messages.js';
import { readChatPageResolver } from './page.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Wrap a D1 binding so that every call that reaches the database is counted: a batch as one, and
 * each statement run outside a batch as one. Statements handed to a batch are unwrapped first,
 * since D1 takes only its own.
 */
const countingD1 = (binding: D1Database) => {
  const calls: string[] = [];
  const unwrapped = new WeakMap<object, D1PreparedStatement>();
  const statement = (
    real: D1PreparedStatement,
    query: string,
  ): D1PreparedStatement => {
    const wrapped = new Proxy(real, {
      get: (target, property) => {
        if (property === 'bind')
          return (...values: unknown[]) =>
            statement(target.bind(...values), query);
        if (['first', 'all', 'run', 'raw'].includes(String(property)))
          return (...args: unknown[]) => {
            calls.push(query);
            return (
              Reflect.get(target, property, target) as (
                ...values: unknown[]
              ) => Promise<unknown>
            ).apply(target, args);
          };
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    unwrapped.set(wrapped, real);
    return wrapped;
  };
  const counted = new Proxy(binding, {
    get: (target, property) => {
      if (property === 'prepare')
        return (query: string) => statement(target.prepare(query), query);
      if (property === 'batch')
        return (statements: D1PreparedStatement[]) => {
          calls.push(`batch of ${statements.length}`);
          return target.batch(
            statements.map((each) => unwrapped.get(each) ?? each),
          );
        };
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { binding: counted, calls };
};

describe("a chat panel's first read (real D1 via Miniflare)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const pageFor = (eventId: string, viewerId: string, now = new Date()) =>
    readChatPageResolver(db, { eventId, viewerId, now });

  const codeOf = async (eventId: string, viewerId: string) => {
    const result = await pageFor(eventId, viewerId);
    return result.ok ? 'opened' : result.error.code;
  };

  const say = (eventId: string, authorId: string, body: string) =>
    sendChatMessageResolver(db, {
      eventId,
      authorId,
      body,
      clientId: crypto.randomUUID(),
    });

  it("opens a member's chat with its messages, their authors and the reader's own state", async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId, { name: 'Nadia' });
    await say(eventId, member, 'On arrive vers 18h');
    await say(eventId, HOST_ID, 'Parfait, à tout à l’heure');
    await markChatRead(db, { eventId, userId: member, at: Date.now() });
    await setChatMuted(db, { eventId, userId: member, muted: true });

    const page = await pageFor(eventId, member);

    if (!page.ok) throw page.error;
    expect(page.data).toMatchObject({
      isHost: false,
      state: 'open',
      readOnlyAt: new Date(Date.parse('2099-01-15T20:00:00Z') + 7 * DAY_MS),
      hasOlder: false,
      muted: true,
    });
    expect(page.data.lastReadAt).toBeInstanceOf(Date);
    expect(
      page.data.messages.map((message) => [
        message.body,
        message.author?.name,
        message.isOwn,
      ]),
    ).toEqual([
      ['On arrive vers 18h', 'Nadia', true],
      ['Parfait, à tout à l’heure', 'Chat Host', false],
    ]);
  });

  it('tells the host they host the chat', async () => {
    const eventId = await publishMeetup(db);

    const page = await pageFor(eventId, HOST_ID);

    expect(page.ok && page.data.isHost).toBe(true);
  });

  it('still opens a read-only chat, for reading', async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    await say(eventId, member, 'Merci pour hier soir');
    await endMeetupAgo(db, eventId, (8 * DAY_MS) / 1000);

    const page = await pageFor(eventId, member);

    if (!page.ok) throw page.error;
    expect(page.data.state).toBe('read_only');
    expect(page.data.messages).toHaveLength(1);
  });

  it('refuses someone who is not going', async () => {
    const eventId = await publishMeetup(db);

    expect(await codeOf(eventId, await newMember(db))).toBe('chat_not_member');
  });

  it('refuses a member who cancelled their RSVP', async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    await cancelRsvp(db, { eventId, userId: member });

    expect(await codeOf(eventId, member)).toBe('chat_not_member');
  });

  it('refuses a banned member', async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    await ban(db, member);

    expect(await codeOf(eventId, member)).toBe('chat_not_member');
  });

  it('answers a meetup that has no chat', async () => {
    expect(await codeOf('evt_never_published', HOST_ID)).toBe('chat_not_found');
  });

  it('reads everything it shows in one trip to D1', async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    await say(eventId, member, 'Salam');
    const d1 = countingD1(env.DB);

    const page = await readChatPageResolver(createDb(d1.binding), {
      eventId,
      viewerId: member,
      now: new Date(),
    });

    expect(page.ok).toBe(true);
    expect(
      d1.calls,
      "the chat, the membership, the latest messages with their authors and the reader's own state come back in one batch",
    ).toEqual(['batch of 3']);
  });
});
