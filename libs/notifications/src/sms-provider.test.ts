import { describe, expect, it } from 'vitest';

import {
  DevNotificationSmsProvider,
  TwilioProgrammableSmsProvider,
} from './sms-provider.js';

describe('DevNotificationSmsProvider', () => {
  it('records sent messages', async () => {
    const provider = new DevNotificationSmsProvider();
    const result = await provider.send({
      to: '+213555123456',
      body: 'Test message',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sid).toMatch(/^dev_sms_/);
      expect(result.data.segments).toBe(1);
    }
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.to).toBe('+213555123456');
    expect(provider.sent[0]?.body).toBe('Test message');
  });

  it('records multiple messages', async () => {
    const provider = new DevNotificationSmsProvider();
    await provider.send({ to: '+213555111111', body: 'First' });
    await provider.send({ to: '+213555222222', body: 'Second' });

    expect(provider.sent).toHaveLength(2);
  });
});

describe('TwilioProgrammableSmsProvider', () => {
  it('has correct name', () => {
    const provider = new TwilioProgrammableSmsProvider({
      TWILIO_AID: 'AC123',
      TWILIO_SEC: 'secret',
      TWILIO_SMS_FROM: '+1234567890',
    });
    expect(provider.name).toBe('twilio-sms');
  });
});
