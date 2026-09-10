import { expect, type Page } from '@playwright/test';

import { latestSignInOtp } from './otp';
import { t, type E2eLocale } from './messages';

/** Authenticate a disposable member through the real local OTP provider and D1 session. */
export const signIn = async (page: Page, locale: E2eLocale, email: string) => {
  await page.locator('input[type="email"]').fill(email);
  const send = page.getByRole('button', {
    name: t(locale, 'login_send_code'),
    exact: true,
  });
  await expect(send).toBeEnabled({ timeout: 30_000 });
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
