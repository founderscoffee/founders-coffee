import { expect, test } from '@playwright/test';

import { requestSignInCode } from './support/profile-auth';
import { RUN_ID } from './support/run';

const PHONE = { width: 390, height: 844 } as const;
const EMAIL = `e2e-code-width-${RUN_ID}@e2e.invalid`;

test.describe('Sign-in code on a phone', () => {
  test('never widens the page, even where the browser cannot size the code input', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/en/login');
    await page.addStyleTag({
      content: '#otp-field { field-sizing: fixed !important; }',
    });

    const code = await requestSignInCode(
      page,
      'en',
      EMAIL,
      'login_email_continue',
    );
    await code.locator('xpath=..').click();
    await expect(code).toBeFocused();
    await page.keyboard.type('123456');
    await expect(code).toHaveValue('123456');

    const reach = await code.evaluate(
      (input) => input.getBoundingClientRect().right,
    );
    expect(
      reach,
      'without field-sizing the input keeps its default width, as in Safari before 26',
    ).toBeGreaterThan(PHONE.width);

    const pageWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(
      pageWidth,
      'the code input widened the page, which lets iOS Safari zoom out as it takes focus (#123)',
    ).toBe(PHONE.width);
  });
});
