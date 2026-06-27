import { AppError, err, ok, type Result } from '@founders-coffee/core';
import { logger } from '@founders-coffee/observability';

import { mapEmailProviderCode, readEmailProviderCode } from './error-codes.js';
import type { EmailAddress, EmailProvider, SendEmailInput, SendEmailResult } from './provider.js';

/** Compact, PII-light log value for recipients (count when many, address when one). */
const describeRecipients = (to: string | string[]): string =>
  Array.isArray(to) ? `${to.length} recipients` : to;

/**
 * Build the real `CloudflareEmailProvider` bound to the native `EMAIL` binding (D13). Construct
 * per request (`createCloudflareEmailProvider(env.EMAIL, defaultFrom)`) — never a module singleton.
 * Sends via the structured Email Service `send()` (no MIME construction). Cloudflare throws an
 * `Error` with `.code` on failure; we catch + map it to a `Result` (the P0-012 hybrid model).
 */
export const createCloudflareEmailProvider = (
  email: SendEmail,
  defaultFrom: string | EmailAddress,
): EmailProvider => ({
  name: 'cloudflare',

  send: async (input: SendEmailInput): Promise<Result<SendEmailResult>> => {
    try {
      const result = await email.send({ ...input, from: input.from ?? defaultFrom });
      logger.info('email.sent', {
        messageId: result.messageId,
        subject: input.subject,
        to: describeRecipients(input.to),
      });
      return ok(result);
    } catch (error) {
      const providerCode = readEmailProviderCode(error);
      logger.warn('email.send_failed', { providerCode, subject: input.subject });
      return err(
        new AppError(
          mapEmailProviderCode(providerCode),
          `Email send failed (${providerCode})`,
          { providerCode, subject: input.subject },
        ),
      );
    }
  },
});
