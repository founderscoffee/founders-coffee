import { describe, expect, it } from 'vitest';
import { AppError, err, ok } from '@founders-coffee/core';
import type { EmailProvider, SendEmailInput } from '@founders-coffee/email';

import { processNotification } from './notifications.js';

const recordingProvider = (
  outcome: 'ok' | 'err',
): { provider: EmailProvider; sent: SendEmailInput[] } => {
  const sent: SendEmailInput[] = [];
  const provider: EmailProvider = {
    name: 'fake',
    send: async (input) => {
      sent.push(input);
      return outcome === 'err'
        ? err(new AppError('email_send_failed', 'boom'))
        : ok({ messageId: 'mid' });
    },
  };
  return { provider, sent };
};

describe('processNotification', () => {
  it('dispatches via the provider and returns the messageId', async () => {
    const { provider, sent } = recordingProvider('ok');

    const result = await processNotification(provider, {
      to: 'a@b.co',
      subject: 'RSVP confirmed',
      html: '<p>See you Saturday.</p>',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.messageId).toBe('mid');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('a@b.co');
  });

  it('propagates a send failure', async () => {
    const { provider, sent } = recordingProvider('err');

    const result = await processNotification(provider, {
      to: 'a@b.co',
      subject: 'RSVP confirmed',
      html: '<p>See you Saturday.</p>',
    });

    expect(result.ok).toBe(false);
    expect(sent).toHaveLength(1);
  });
});
