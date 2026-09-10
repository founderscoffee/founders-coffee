import { describe, expect, it } from 'vitest';

import { processNotificationDue } from './notifications.js';
import {
  EVENT_ID,
  OTHER_EVENT_ID,
  countingSms,
  enqueue,
  providers,
  rowById,
  setupDb,
} from './notification-sweep.fixtures.js';

const due = { kind: 'notification_due' as const, eventId: EVENT_ID };

describe('processNotificationDue', () => {
  it('delivers what the named event has due', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db);
    const { provider, sends } = countingSms();

    const result = await processNotificationDue(
      db,
      due,
      providers({
        sms: provider,
      }),
    );

    expect(result.ok).toBe(true);
    expect(sends).toHaveLength(1);
    expect((await rowById(db, rowId))?.status).toBe('sent');
  });

  it('leaves another event alone, so one alarm cannot take another event work', async () => {
    const db = await setupDb();
    const mine = await enqueue(db);
    const theirs = await enqueue(db, { eventId: OTHER_EVENT_ID });

    await processNotificationDue(db, due, providers());

    expect((await rowById(db, mine))?.status).toBe('sent');
    expect((await rowById(db, theirs))?.status).toBe('pending');
  });

  it('delivers once when the same message arrives twice', async () => {
    const db = await setupDb();
    await enqueue(db);
    const { provider, sends } = countingSms();
    const deps = providers({ sms: provider });

    await processNotificationDue(db, due, deps);
    await processNotificationDue(db, due, deps);

    expect(sends).toHaveLength(1);
  });

  it('acks an event with nothing due rather than retrying an empty run', async () => {
    const db = await setupDb();

    const result = await processNotificationDue(db, due, providers());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.selected).toBe(0);
  });

  it('acks a delivery failure, because the row already records it', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db, { channel: 'push' });

    const result = await processNotificationDue(db, due, providers());

    expect(result.ok).toBe(true);
    expect((await rowById(db, rowId))?.status).not.toBe('sent');
  });
});
