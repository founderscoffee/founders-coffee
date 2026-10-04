import { expect, test, type Browser, type Page } from '@playwright/test';

import {
  chatEntryOf,
  composerOf,
  expectPanelPlacement,
  openChat,
  optionsOf,
  panelOf,
  send,
  type Screen,
} from './support/chat-panel';
import { cleanupRun, d1 } from './support/d1';
import { t, type E2eLocale } from './support/messages';
import { signIn } from './support/profile-auth';
import { newId, RUN_ID, watchForApplicationErrors } from './support/run';

const SCREENS: readonly Screen[] = [
  { locale: 'ar', width: 390, height: 844, hasTouch: true },
  { locale: 'fr', width: 768, height: 1024, hasTouch: true },
  { locale: 'en', width: 1280, height: 800, hasTouch: false },
];

const DAY_SECONDS = 86_400;

/** The rows one screen's run writes, named by its locale and the run so parallel runs never meet. */
const meetupFor = (locale: E2eLocale) => {
  const tag = `${locale}_${RUN_ID}`;
  const slug = `e2e-chat-${locale}-${RUN_ID}`;
  return {
    eventId: newId('evt'),
    channelId: newId('chn'),
    hostId: `usr_e2e_chat_host_${tag}`,
    title: `E2E chat ${locale} ${RUN_ID}`,
    path: `/${locale}/algeria/e/${slug}`,
    slug,
    hostName: `Host ${locale} ${RUN_ID}`,
    memberName: `Member ${locale} ${RUN_ID}`,
    hostEmail: `e2e-chat-host-${locale}-${RUN_ID}@e2e.invalid`,
    memberEmail: `e2e-chat-member-${locale}-${RUN_ID}@e2e.invalid`,
  };
};

type Meetup = ReturnType<typeof meetupFor>;

/** A meetup in Algiers two days away with its chat, hosted by an account that signs in by email. */
const seedMeetup = (meetup: Meetup, locale: E2eLocale): void => {
  const startsAt = Math.floor(Date.now() / 1000) + 2 * DAY_SECONDS;
  const endsAt = startsAt + 2 * 60 * 60;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${meetup.hostId}', '${meetup.hostName}', '${meetup.hostEmail}'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, ends_at, language, slug) ` +
      `VALUES ('${meetup.eventId}', '${meetup.hostId}', 'DZ', '16', '556', '${meetup.title}', 'Seeded for the meetup chat.', 'Café E2E', ${startsAt}, ${endsAt}, '${locale}', '${meetup.slug}'); ` +
      `INSERT INTO chat_channels (id, kind, event_id, market_code, read_only_at, expires_at, created_at, updated_at) ` +
      `VALUES ('${meetup.channelId}', 'meetup', '${meetup.eventId}', 'DZ', ${endsAt + 7 * DAY_SECONDS}, ${endsAt + 90 * DAY_SECONDS}, unixepoch(), unixepoch());`,
  );
};

/** Name the member who just signed up, and make them one of the people going. */
const joinMeetup = (meetup: Meetup, locale: E2eLocale): void => {
  d1(
    `UPDATE user SET name = '${meetup.memberName}' WHERE email = '${meetup.memberEmail}'; ` +
      `INSERT INTO event_rsvps (id, event_id, user_id, status) ` +
      `SELECT 'rsvp_e2e_chat_${locale}_${RUN_ID}', '${meetup.eventId}', id, 'going' FROM user WHERE email = '${meetup.memberEmail}';`,
  );
};

const cleanup = (meetup: Meetup): void =>
  cleanupRun({
    eventIds: [meetup.eventId],
    emails: [meetup.memberEmail, meetup.hostEmail],
  });

const screenPage = async (browser: Browser, screen: Screen): Promise<Page> => {
  const context = await browser.newContext({
    viewport: { width: screen.width, height: screen.height },
    hasTouch: screen.hasTouch,
  });
  return context.newPage();
};

for (const screen of SCREENS) {
  const { locale } = screen;

  test.describe(`meetup chat · ${locale} at ${screen.width}px`, () => {
    const meetup = meetupFor(locale);

    test.beforeAll(() => {
      cleanup(meetup);
      seedMeetup(meetup, locale);
    });

    test.afterAll(() => cleanup(meetup));

    test('the host and a member talk in real time, each in their own browser, until the host calls it off', async ({
      browser,
    }, testInfo) => {
      test.setTimeout(240_000);
      const member = await screenPage(browser, screen);
      const host = await screenPage(browser, screen);
      const memberErrors = watchForApplicationErrors(member);
      const hostErrors = watchForApplicationErrors(host);

      await member.goto(`${meetup.path}?chat=true`);
      const signedOut = panelOf(member, locale);
      await expect(
        signedOut.getByText(t(locale, 'chat_signed_out')),
      ).toBeVisible({ timeout: 30_000 });
      await signedOut.getByRole('link', { name: t(locale, 'sign_in') }).click();
      await member.waitForURL(/\/login\?/, { timeout: 30_000 });
      await signIn(member, locale, meetup.memberEmail, 'login_email_continue');
      await member.waitForURL(new RegExp(`/e/${meetup.slug}\\?chat=true`), {
        timeout: 60_000,
      });
      await expect(panelOf(member, locale)).toBeHidden();

      joinMeetup(meetup, locale);
      await member.reload();
      const memberPanel = panelOf(member, locale);
      await expect(memberPanel.getByText(t(locale, 'chat_empty'))).toBeVisible({
        timeout: 30_000,
      });
      await expectPanelPlacement(member, memberPanel, screen);

      await host.goto(
        `/${locale}/login?redirect=${encodeURIComponent(meetup.path)}`,
      );
      await signIn(host, locale, meetup.hostEmail, 'login_email_continue');
      await host.waitForURL(new RegExp(`/e/${meetup.slug}$`), {
        timeout: 60_000,
      });
      const hostEntry = chatEntryOf(host, locale);
      await openChat(host, locale);
      await host.waitForURL(/\?chat=true$/);
      const hostPanel = panelOf(host, locale);
      await expect(hostPanel.getByText(t(locale, 'chat_empty'))).toBeVisible({
        timeout: 30_000,
      });

      const address = `https://example.com/${RUN_ID}`;
      await send(memberPanel, locale, `Salam ${locale} ${address}`);
      await expect(
        memberPanel.locator('.chat-end').getByText(`Salam ${locale}`),
      ).toBeVisible();
      const arrived = hostPanel.locator('.chat-start');
      await expect(arrived.getByText(`Salam ${locale}`)).toBeVisible({
        timeout: 15_000,
      });
      await expect(arrived.getByText(meetup.memberName)).toBeVisible();
      const link = arrived.getByRole('link', { name: address });
      await expect(link).toHaveAttribute('href', address);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute(
        'rel',
        'noopener noreferrer nofollow ugc',
      );

      await send(hostPanel, locale, `Welcome ${locale}`);
      await expect(
        memberPanel.locator('.chat-start').getByText(`Welcome ${locale}`),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        memberPanel.locator('.chat-start').getByText(meetup.hostName),
      ).toBeVisible();
      await expectPanelPlacement(host, hostPanel, screen);

      await member.screenshot({ path: testInfo.outputPath('member.png') });
      await host.screenshot({ path: testInfo.outputPath('host.png') });

      await host.goBack();
      await expect(hostPanel).toBeHidden();
      await expect(host).toHaveURL(new RegExp(`/e/${meetup.slug}$`));
      await hostEntry.click();
      await expect(hostPanel.getByText(`Welcome ${locale}`)).toBeVisible();
      await host.keyboard.press('Escape');
      await expect(hostPanel).toBeHidden();
      await expect(host).toHaveURL(new RegExp(`/e/${meetup.slug}$`));

      await send(memberPanel, locale, `Still there ${locale}?`);
      await host.reload();
      const unread = hostEntry.locator('.badge');
      await expect(unread).toHaveText('1', { timeout: 30_000 });
      await hostEntry.scrollIntoViewIfNeeded();
      await host.screenshot({ path: testInfo.outputPath('host-unread.png') });
      await hostEntry.click();
      await expect(hostPanel.getByText(`Still there ${locale}?`)).toBeVisible({
        timeout: 15_000,
      });
      const mute = hostPanel.getByRole('button', {
        name: t(locale, 'chat_mute'),
      });
      await expect(mute).toHaveAttribute('aria-pressed', 'false');
      await mute.click();
      await expect(mute).toHaveAttribute('aria-pressed', 'true');
      await host.keyboard.press('Escape');
      await expect(unread).toBeHidden({ timeout: 15_000 });
      await host.reload();
      await openChat(host, locale);
      await expect(mute).toHaveAttribute('aria-pressed', 'true', {
        timeout: 15_000,
      });
      await host.screenshot({ path: testInfo.outputPath('host-muted.png') });

      await optionsOf(memberPanel, `Welcome ${locale}`).click();
      const report = member.getByRole('dialog', {
        name: t(locale, 'chat_report_title'),
      });
      await report
        .getByRole('radio', { name: t(locale, 'chat_report_spam') })
        .check();
      await member.screenshot({
        path: testInfo.outputPath('member-report.png'),
        animations: 'disabled',
      });
      await report
        .getByRole('button', { name: t(locale, 'chat_report_confirm') })
        .click();
      await expect(report).toBeHidden();
      await expect(
        memberPanel.getByText(t(locale, 'chat_report_sent')),
      ).toBeVisible();
      expect(
        d1(
          `SELECT reason FROM chat_reports WHERE message_id IN (SELECT id FROM chat_messages WHERE channel_id = '${meetup.channelId}' AND body = 'Welcome ${locale}');`,
        ),
      ).toEqual([{ reason: 'spam' }]);

      await optionsOf(hostPanel, `Salam ${locale}`).click();
      await host
        .getByRole('button', { name: t(locale, 'chat_remove_message') })
        .click();
      const removal = host.getByRole('dialog', {
        name: t(locale, 'chat_remove_title'),
      });
      await removal
        .getByRole('button', {
          name: t(locale, 'chat_remove_confirm'),
          exact: true,
        })
        .click();
      for (const panel of [hostPanel, memberPanel])
        await expect(
          panel.getByText(t(locale, 'chat_removed_host')),
        ).toBeVisible({ timeout: 15_000 });
      await expect(memberPanel.getByText(`Salam ${locale}`)).toBeHidden();

      await optionsOf(memberPanel, `Still there ${locale}?`).click();
      await member
        .getByRole('dialog', { name: t(locale, 'chat_delete_title') })
        .getByRole('button', {
          name: t(locale, 'chat_delete_confirm'),
          exact: true,
        })
        .click();
      for (const panel of [memberPanel, hostPanel])
        await expect(
          panel.getByText(t(locale, 'chat_removed_author')),
        ).toBeVisible({ timeout: 15_000 });
      await host.screenshot({ path: testInfo.outputPath('host-removals.png') });
      await host.keyboard.press('Escape');
      await expect(hostPanel).toBeHidden();

      const reason = `Venue closed ${RUN_ID}.`;
      await host
        .getByRole('button', { name: t(locale, 'host_cancel_event') })
        .click();
      const cancelDialog = host.getByRole('dialog', {
        name: t(locale, 'host_cancel_title'),
      });
      await cancelDialog
        .getByRole('textbox', { name: t(locale, 'host_cancel_reason_label') })
        .fill(reason);
      await cancelDialog
        .getByRole('button', { name: t(locale, 'host_cancel_confirm') })
        .click();
      await expect(
        memberPanel.getByText(t(locale, 'chat_system_cancelled')),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        memberPanel.getByText(reason, { exact: true }),
      ).toBeVisible();
      await expect(composerOf(memberPanel, locale)).toBeHidden();
      await member.screenshot({
        path: testInfo.outputPath('member-cancelled.png'),
      });

      await memberPanel
        .getByRole('button', { name: t(locale, 'chat_close') })
        .click();
      await expect(memberPanel).toBeHidden();
      await expect(member).toHaveURL(new RegExp(`/e/${meetup.slug}$`));

      expect([...memberErrors, ...hostErrors]).toEqual([]);
    });
  });
}
