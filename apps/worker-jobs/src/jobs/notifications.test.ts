import { describe, expect, it } from 'vitest';
import { AppError, err, ok } from '@founders-coffee/core';
import type { EmailProvider, SendEmailInput } from '@founders-coffee/email';
import type {
  NotificationSmsProvider,
  SendNotificationSmsResult,
} from '@founders-coffee/notifications';

import { processNotification } from './notifications.js';

const recordingEmailProvider = (
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

const recordingSmsProvider = (
  outcome: 'ok' | 'err',
): {
  provider: NotificationSmsProvider;
  sent: { to: string; body: string }[];
} => {
  const sent: { to: string; body: string }[] = [];
  const provider: NotificationSmsProvider = {
    name: 'fake-sms',
    send: async (input) => {
      sent.push(input);
      return outcome === 'err'
        ? err(new AppError('sms_transient_failure', 'boom'))
        : ok({ sid: 'sm123', segments: 1 });
    },
  };
  return { provider, sent };
};

describe('processNotification', () => {
  it('dispatches email via the email provider', async () => {
    const { provider: email, sent } = recordingEmailProvider('ok');
    const { provider: sms } = recordingSmsProvider('ok');

    const result = await processNotification(
      {
        channel: 'email',
        to: 'a@b.co',
        subject: 'RSVP confirmed',
        html: '<p>See you Saturday.</p>',
      },
      { email, sms },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.messageId).toBe('mid');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('a@b.co');
  });

  it('dispatches SMS via the SMS provider', async () => {
    const { provider: email } = recordingEmailProvider('ok');
    const { provider: sms, sent } = recordingSmsProvider('ok');

    const result = await processNotification(
      {
        channel: 'sms',
        to: '+213555123456',
        body: "You're in! Coffee Meetup — Sat at Café.",
      },
      { email, sms },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sid).toBe('sm123');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('+213555123456');
  });

  it('propagates email send failure', async () => {
    const { provider: email, sent } = recordingEmailProvider('err');
    const { provider: sms } = recordingSmsProvider('ok');

    const result = await processNotification(
      {
        channel: 'email',
        to: 'a@b.co',
        subject: 'RSVP confirmed',
        html: '<p>See you Saturday.</p>',
      },
      { email, sms },
    );

    expect(result.ok).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it('propagates SMS send failure', async () => {
    const { provider: email } = recordingEmailProvider('ok');
    const { provider: sms, sent } = recordingSmsProvider('err');

    const result = await processNotification(
      {
        channel: 'sms',
        to: '+213555123456',
        body: "You're in!",
      },
      { email, sms },
    );

    expect(result.ok).toBe(false);
    expect(sent).toHaveLength(1);
  });
});
