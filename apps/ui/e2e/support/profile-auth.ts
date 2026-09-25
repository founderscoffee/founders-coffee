import { expect, type Page } from '@playwright/test';

import { latestSignInOtp } from './otp';
import { t, type E2eLocale } from './messages';

/**
 * Authenticate a disposable member through the real local OTP provider and D1 session.
 *
 * The host wizard's sign-in step asks for the code with `send_code`; the standalone login
 * page says `login_email_continue`. Everything after that button is the same on both.
 *
 * The address is typed again until the button takes it. The login page is server-rendered, and an
 * address filled before React hydrates it sets the field but never reaches the component, so the
 * button stays disabled with the address showing.
 */
export const signIn = async (
  page: Page,
  locale: E2eLocale,
  email: string,
  sendKey: 'send_code' | 'login_email_continue' = 'send_code',
) => {
  const field = page.locator('input[type="email"]');
  const send = page.getByRole('button', {
    name: t(locale, sendKey),
    exact: true,
  });
  await expect(async () => {
    await field.fill('');
    await field.fill(email);
    await expect(send).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await send.click();
  const otpField = page.locator('input[autocomplete="one-time-code"]');
  await expect(otpField).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => latestSignInOtp(email), { timeout: 30_000, intervals: [500] })
    .not.toBeNull();
  const otp = latestSignInOtp(email);
  if (!otp) throw new Error('Local OTP was not delivered');
  await otpField.fill(otp);
  await page
    .getByRole('button', { name: t(locale, 'login_verify'), exact: true })
    .click();
};

/** Complete only the display name, with no residence selection or optional profile requirement. */
export const completeProfileName = async (
  page: Page,
  locale: E2eLocale,
  name: string,
) => {
  const input = page.getByRole('textbox', {
    name: t(locale, 'profile_name_label'),
    exact: true,
  });
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(name);
  const save = page.getByRole('button', {
    name: t(locale, 'profile_save'),
    exact: true,
  });
  await expect(save).toBeEnabled({ timeout: 30_000 });
  await save.click();
};
