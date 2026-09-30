import { expect, test, type Browser, type Page } from '@playwright/test';

import { composerOf, panelOf, send, type Screen } from './support/chat-panel';
import { cleanupRun, d1 } from './support/d1';
import { t, type E2eLocale } from './support/messages';
import { signIn } from './support/profile-auth';
import { RUN_ID, watchForApplicationErrors } from './support/run';

const HOST: Screen = { locale: 'ar', width: 390, height: 844, hasTouch: true };
const MEMBER: Screen = {
  locale: 'en',
  width: 1280,
  height: 800,
  hasTouch: false,
};
const OUTSIDER: Screen = {
  locale: 'fr',
  width: 768,
  height: 1024,
  hasTouch: true,
};

const DAY_SECONDS = 86_400;
const HOUR_SECONDS = 3_600;

/** An id in the one format the server functions accept: a prefix, an underscore, 32 hex digits. */
const newId = (prefix: string): string =>
  `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

const meetup = {
  eventId: newId('evt'),
  channelId: newId('chn'),
  hostId: `usr_e2e_chat_life_host_${RUN_ID}`,
  hostName: `Host ${RUN_ID}`,
  memberName: `Member ${RUN_ID}`,
  title: `E2E chat lifecycle ${RUN_ID}`,
  slug: `e2e-chat-life-${RUN_ID}`,
  hostEmail: `e2e-chat-life-host-${RUN_ID}@e2e.invalid`,
  memberEmail: `e2e-chat-life-member-${RUN_ID}@e2e.invalid`,
  outsiderEmail: `e2e-chat-life-outsider-${RUN_ID}@e2e.invalid`,
};

/** The meetup's page in `locale`. */
const pathIn = (locale: E2eLocale): string =>
  `/${locale}/algeria/e/${meetup.slug}`;

/** A pattern for the line a message with values renders, from its words before the first value. */
const opening = (locale: E2eLocale, key: string): RegExp =>
  new RegExp(
    (t(locale, key).split('{')[0] ?? '')
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );

/** A meetup in Algiers two days away, in Arabic, with its chat, hosted by an account that signs in by email. */
const seedMeetup = (): void => {
  const startsAt = Math.floor(Date.now() / 1000) + 2 * DAY_SECONDS;
  const endsAt = startsAt + 2 * HOUR_SECONDS;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${meetup.hostId}', '${meetup.hostName}', '${meetup.hostEmail}'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, ends_at, language, languages, slug) ` +
      `VALUES ('${meetup.eventId}', '${meetup.hostId}', 'DZ', '16', '556', '${meetup.title}', 'Seeded for the meetup chat lifecycle.', 'Café E2E', ${startsAt}, ${endsAt}, 'ar', json_array('ar'), '${meetup.slug}'); ` +
      `INSERT INTO chat_channels (id, kind, event_id, market_code, read_only_at, expires_at, created_at, updated_at) ` +
      `VALUES ('${meetup.channelId}', 'meetup', '${meetup.eventId}', 'DZ', ${endsAt + 7 * DAY_SECONDS}, ${endsAt + 90 * DAY_SECONDS}, unixepoch(), unixepoch());`,
  );
};

const cleanup = (): void =>
  cleanupRun({
    eventIds: [meetup.eventId],
    emails: [meetup.hostEmail, meetup.memberEmail, meetup.outsiderEmail],
  });

const screenPage = async (browser: Browser, screen: Screen): Promise<Page> => {
  const context = await browser.newContext({
    viewport: { width: screen.width, height: screen.height },
    hasTouch: screen.hasTouch,
  });
  return context.newPage();
};

/** Sign `email` in and land on the meetup's page in `locale`. */
const signInTo = async (page: Page, locale: E2eLocale, email: string) => {
  await page.goto(
    `/${locale}/login?redirect=${encodeURIComponent(pathIn(locale))}`,
  );
  await signIn(page, locale, email, 'login_email_continue');
  await page.waitForURL(new RegExp(`/e/${meetup.slug}$`), { timeout: 60_000 });
};

const chatEntry = (page: Page, locale: E2eLocale) =>
  page.getByRole('button', { name: t(locale, 'chat_open') });

/**
 * RSVP from the meetup page, turn down the push prompt if it follows, and wait for the chat entry.
 *
 * The button is server-rendered, and a click that lands before React hydrates it does nothing, so
 * it is clicked again until the RSVP shows. The prompt asks once per browser, not once per RSVP.
 */
const joinThroughPage = async (page: Page, locale: E2eLocale) => {
  const join = page.getByRole('button', { name: t(locale, 'rsvp_cta') });
  const prompt = page.getByRole('dialog', {
    name: t(locale, 'push_prompt_title'),
  });
  const entry = chatEntry(page, locale);
  await expect(async () => {
    if (await join.isVisible()) await join.click({ timeout: 2_000 });
    await expect(prompt.or(entry).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  const isPrompted = await prompt
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(
      () => true,
      () => false,
    );
  if (isPrompted)
    await prompt
      .getByRole('button', { name: t(locale, 'push_prompt_decline') })
      .click();
  await expect(prompt).toBeHidden();
  await expect(entry).toBeVisible({ timeout: 30_000 });
};

/** Give up the seat from the meetup page. */
const leaveThroughPage = async (page: Page, locale: E2eLocale) => {
  await page.getByRole('button', { name: t(locale, 'rsvp_cancel') }).click();
  const dialog = page.getByRole('dialog', { name: t(locale, 'cancel_title') });
  await dialog.getByRole('button', { name: t(locale, 'free_seat') }).click();
  await expect(dialog).toBeHidden();
};

test.describe('meetup chat lifecycle · an Arabic host, an English member, a French outsider', () => {
  test.beforeAll(() => {
    cleanup();
    seedMeetup();
  });

  test.afterAll(() => cleanup());

  test('membership follows the RSVP across three languages, and the chat closes after the meetup', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    const host = await screenPage(browser, HOST);
    const member = await screenPage(browser, MEMBER);
    const outsider = await screenPage(browser, OUTSIDER);
    const errors = [host, member, outsider].map(watchForApplicationErrors);
    const hostPanel = panelOf(host, 'ar');
    const memberPanel = panelOf(member, 'en');
    const greeting = `أهلا ${RUN_ID}`;
    const reply = `Hello ${RUN_ID}`;
    const whileAway = `غبت عنا ${RUN_ID}`;

    await signInTo(member, 'en', meetup.memberEmail);
    d1(
      `UPDATE user SET name = '${meetup.memberName}' WHERE email = '${meetup.memberEmail}'`,
    );
    await expect(member.getByText(t('en', 'chat_invite'))).toBeVisible({
      timeout: 30_000,
    });
    await joinThroughPage(member, 'en');

    await signInTo(host, 'ar', meetup.hostEmail);
    await chatEntry(host, 'ar').click();
    await expect(hostPanel.getByText(t('ar', 'chat_empty'))).toBeVisible({
      timeout: 30_000,
    });
    await send(hostPanel, 'ar', greeting);
    await chatEntry(member, 'en').click();
    await expect(memberPanel.getByText(greeting)).toBeVisible({
      timeout: 15_000,
    });
    await send(memberPanel, 'en', reply);
    await expect(hostPanel.getByText(reply)).toBeVisible({ timeout: 15_000 });

    await signInTo(outsider, 'fr', meetup.outsiderEmail);
    await expect(outsider.getByText(t('fr', 'chat_invite'))).toBeVisible({
      timeout: 30_000,
    });
    await expect(chatEntry(outsider, 'fr')).toHaveCount(0);
    await outsider.goto(`${pathIn('fr')}?chat=true`);
    await expect(outsider.getByText(t('fr', 'chat_invite'))).toBeVisible({
      timeout: 30_000,
    });
    await expect(panelOf(outsider, 'fr')).toBeHidden();
    await outsider.screenshot({ path: testInfo.outputPath('outsider.png') });

    await member.keyboard.press('Escape');
    await expect(memberPanel).toBeHidden();
    await leaveThroughPage(member, 'en');
    await expect(chatEntry(member, 'en')).toHaveCount(0, { timeout: 30_000 });
    await member.goto(`${pathIn('en')}?chat=true`);
    await expect(member.getByText(t('en', 'chat_invite'))).toBeVisible({
      timeout: 30_000,
    });
    await expect(memberPanel).toBeHidden();
    await send(hostPanel, 'ar', whileAway);

    await member.goto(pathIn('en'));
    await joinThroughPage(member, 'en');
    await chatEntry(member, 'en').click();
    for (const text of [greeting, reply, whileAway])
      await expect(memberPanel.getByText(text)).toBeVisible({
        timeout: 15_000,
      });
    await member.screenshot({ path: testInfo.outputPath('member-back.png') });

    const endedAt = Math.floor(Date.now() / 1000) - HOUR_SECONDS;
    d1(
      `UPDATE events SET starts_at = ${endedAt - 2 * HOUR_SECONDS}, ends_at = ${endedAt} WHERE id = '${meetup.eventId}'; ` +
        `UPDATE chat_channels SET read_only_at = ${endedAt + 7 * DAY_SECONDS} WHERE id = '${meetup.channelId}';`,
    );
    await member.goto(`${pathIn('en')}?chat=true`);
    await expect(
      memberPanel.getByText(opening('en', 'chat_open_until')),
    ).toBeVisible({ timeout: 30_000 });
    await expect(composerOf(memberPanel, 'en')).toBeVisible();
    await member.screenshot({ path: testInfo.outputPath('member-ended.png') });

    d1(
      `UPDATE chat_channels SET read_only_at = ${endedAt} WHERE id = '${meetup.channelId}';`,
    );
    await member.reload();
    await expect(memberPanel.getByText(t('en', 'chat_read_only'))).toBeVisible({
      timeout: 30_000,
    });
    await expect(composerOf(memberPanel, 'en')).toBeHidden();
    await member.screenshot({
      path: testInfo.outputPath('member-read-only.png'),
    });

    expect(errors.flat()).toEqual([]);
  });
});
