import type { Result } from '@founders-coffee/core';

export interface EmailAddress {
  readonly email: string;
  readonly name: string;
}

export interface SendEmailInput {
  readonly to: string | string[];
  readonly from?: string | EmailAddress;
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
  readonly cc?: string | string[];
  readonly bcc?: string | string[];
  readonly replyTo?: string | EmailAddress;
  readonly headers?: Record<string, string>;
}

export interface SendEmailResult {
  readonly messageId: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<Result<SendEmailResult>>;
}
