import type { ConsoleMessage, Page } from '@playwright/test';

import type { E2eLocale } from './messages';

export const LOCALE_BY_PROJECT: Record<string, E2eLocale> = {
  'mobile-ar': 'ar',
  'tablet-fr': 'fr',
  'desktop-en': 'en',
};

export const RUN_ID = process.env.E2E_RUN_ID ?? Date.now().toString(36);

export const localeFor = (projectName: string): E2eLocale =>
  LOCALE_BY_PROJECT[projectName] ?? 'en';

export const uniqueTitle = (locale: E2eLocale): string =>
  `E2E create-event ${locale} ${RUN_ID}`;

export const disposableEmail = (locale: E2eLocale): string =>
  `e2e-host-${locale}-${RUN_ID}@e2e.invalid`;

const IGNORED_CONSOLE = [
  /cloudflareinsights/i,
  /challenge-platform/i,
  /Content-Security-Policy/i,
  /favicon/i,
  /\[vite\]/i,
];

/**
 * Collect the page errors and console errors the application itself is responsible for.
 *
 * The gate exists to catch our own broken code, so edge-injected analytics, the bot-detection
 * beacon, report-only CSP notices and dev-server chatter are filtered out — none of them can be
 * fixed from this repository, and a gate that fails on them would be turned off within a week.
 * Everything else is treated as a defect and fails the run.
 */
export const watchForApplicationErrors = (page: Page): string[] => {
  const failures: string[] = [];
  const record = (text: string) => {
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    failures.push(text);
  };
  page.on('pageerror', (error) => record(`pageerror: ${error.message}`));
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') record(`console: ${message.text()}`);
  });
  return failures;
};
