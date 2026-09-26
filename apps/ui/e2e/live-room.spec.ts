import { expect, test, type Page } from '@playwright/test';

import {
  HEARTBEAT_ACK_FRAME,
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
} from '../src/durable-objects/event-live/constants';
import { cleanupRun, d1 } from './support/d1';
import { t } from './support/messages';
import { completeProfileName, signIn } from './support/profile-auth';
import { RUN_ID, watchForApplicationErrors } from './support/run';

const LOCALE = 'fr';
const HOST_ID = `usr_e2e_live_host_${RUN_ID}`;
const HOST_EMAIL = `e2e-live-host-${RUN_ID}@e2e.invalid`;
const MEMBER_EMAIL = `e2e-live-member-${RUN_ID}@e2e.invalid`;
const EVENT_ID = `evt_e2e_live_${RUN_ID}`;
const SLUG = `e2e-live-${RUN_ID}`;
const EVENT_PATH = `/${LOCALE}/algeria/e/${SLUG}`;

type RoomTraffic = { sent: string[]; received: string[]; isClosed: boolean };

const cleanup = (): void =>
  cleanupRun({ eventIds: [EVENT_ID], emails: [MEMBER_EMAIL, HOST_EMAIL] });

/** A meetup in Algiers starting in half an hour, so its live room is already open. */
const seedMeetup = (): void => {
  const startsAt = Math.floor(Date.now() / 1000) + 30 * 60;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${HOST_ID}', 'E2E Live Host', '${HOST_EMAIL}'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, language, slug) ` +
      `VALUES ('${EVENT_ID}', '${HOST_ID}', 'DZ', '16', '556', 'E2E live room ${RUN_ID}', 'Seeded to watch the live room heartbeat.', 'Café E2E', ${startsAt}, 'fr', '${SLUG}');`,
  );
};

const setRsvp = (status: 'going' | 'cancelled'): void => {
  d1(
    `INSERT INTO event_rsvps (id, event_id, user_id, status) ` +
      `SELECT 'rsvp_e2e_live_${RUN_ID}', '${EVENT_ID}', id, '${status}' FROM user WHERE email = '${MEMBER_EMAIL}' ` +
      `ON CONFLICT (event_id, user_id) DO UPDATE SET status = excluded.status;`,
  );
};

/** Every frame the page's live room socket sends and receives, as the browser carries them. */
const watchRoom = (page: Page): RoomTraffic => {
  const traffic: RoomTraffic = { sent: [], received: [], isClosed: false };
  page.on('websocket', (socket) => {
    if (!socket.url().endsWith(`/api/live/${EVENT_ID}`)) return;
    socket.on('framesent', ({ payload }) => traffic.sent.push(String(payload)));
    socket.on('framereceived', ({ payload }) =>
      traffic.received.push(String(payload)),
    );
    socket.on('close', () => {
      traffic.isClosed = true;
    });
  });
  return traffic;
};

const typeOf = (frame: string): unknown => {
  try {
    return (JSON.parse(frame) as { type?: unknown }).type;
  } catch {
    return undefined;
  }
};

test.describe('live room heartbeat', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    cleanup();
    seedMeetup();
  });

  test.afterAll(() => cleanup());

  test('keeps a member in on heartbeats, and turns them out once their RSVP is withdrawn', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const failures = watchForApplicationErrors(page);
    await page.goto(
      `/${LOCALE}/login?redirect=${encodeURIComponent(EVENT_PATH)}`,
    );
    await signIn(page, LOCALE, MEMBER_EMAIL, 'login_email_continue');
    await completeProfileName(page, LOCALE, 'E2E Live Member');
    await page.waitForURL(new RegExp(`/e/${SLUG}`), { timeout: 60_000 });

    setRsvp('going');
    const traffic = watchRoom(page);
    await page.reload();
    const room = page.locator('h2', { hasText: t(LOCALE, 'live_title') });
    await expect(room).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(
        () => traffic.received.filter((frame) => frame === HEARTBEAT_ACK_FRAME),
        { timeout: HEARTBEAT_INTERVAL_MS + 10_000 },
      )
      .not.toEqual([]);
    expect(traffic.sent).toContain(HEARTBEAT_FRAME);

    await page
      .getByRole('button', { name: t(LOCALE, 'live_walking_in_cta') })
      .click();
    await expect(page.getByText(t(LOCALE, 'live_walking_in'))).toBeVisible();

    setRsvp('cancelled');
    await expect
      .poll(
        () =>
          traffic.received.filter((frame) => typeOf(frame) === 'not_attending'),
        { timeout: HEARTBEAT_TIMEOUT_MS + 15_000, intervals: [1_000] },
      )
      .not.toEqual([]);
    await expect(room).toBeHidden();
    await expect.poll(() => traffic.isClosed).toBe(true);
    expect(failures).toEqual([]);
  });
});
