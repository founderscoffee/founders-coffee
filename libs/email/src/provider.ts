import type { Result } from '@founders-coffee/core';

/** A named email address. Mirrors the Cloudflare Email Service builder shape (name required). */
export interface EmailAddress {
  readonly email: string;
  readonly name: string;
}

/** Input to send one email. Mirrors the Cloudflare Email Service structured `send()` builder. */
export interface SendEmailInput {
  readonly to: string | string[];
  /** Defaults to the provider's configured `defaultFrom`. */
  readonly from?: string | EmailAddress;
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
  readonly cc?: string | string[];
  readonly bcc?: string | string[];
  readonly replyTo?: string | EmailAddress;
  readonly headers?: Record<string, string>;
}

/** Result of a successful send — Cloudflare's message id. */
export interface SendEmailResult {
  readonly messageId: string;
}

/**
 * Abstraction over email delivery (AGENTS.md §11.7 — external services behind a provider
 * interface). The real variant `CloudflareEmailProvider` sends through Cloudflare's native
 * `EMAIL` binding (D13 — zero external vendors). Returns `Result` (the P0-012 hybrid model —
 * server functions / worker-jobs unwrap via `handleResult`). Distinct from `libs/auth`'s
 * OTP-specific provider: this is the *general* notification pipeline (FR-N1).
 */
export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<Result<SendEmailResult>>;
}
