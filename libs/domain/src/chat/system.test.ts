import { describe, expect, it } from 'vitest';

import { CHAT_SYSTEM_KEYS } from '@founders-coffee/core';

import { chatSystemNoticeSchema, readChatSystemNotice } from './system.js';

describe('what a system message says happened to its meetup', () => {
  it('reads every key the chat stores, and only those', () => {
    expect(
      chatSystemNoticeSchema.options.map((option) => option.shape.key.value),
    ).toEqual([...CHAT_SYSTEM_KEYS]);
  });

  it('reads a new start with where it is', () => {
    expect(
      readChatSystemNotice('rescheduled', {
        startsAt: '2099-01-15T19:00:00.000Z',
        venue: 'Café des Délices',
      }),
    ).toEqual({
      key: 'rescheduled',
      params: {
        startsAt: '2099-01-15T19:00:00.000Z',
        venue: 'Café des Délices',
      },
    });
  });

  it('reads a new place with its address, or without one', () => {
    expect(
      readChatSystemNotice('relocated', {
        venue: 'Café des Délices',
        address: '12 Rue Didouche Mourad',
      })?.params,
    ).toEqual({ venue: 'Café des Délices', address: '12 Rue Didouche Mourad' });
    expect(
      readChatSystemNotice('relocated', { venue: 'Café des Délices' })?.params,
    ).toEqual({ venue: 'Café des Délices' });
  });

  it('reads a cancellation with the host’s reason, or without one', () => {
    expect(
      readChatSystemNotice('cancelled', { reason: 'Le café ferme.' })?.params,
    ).toEqual({ reason: 'Le café ferme.' });
    expect(readChatSystemNotice('cancelled', null)).toEqual({
      key: 'cancelled',
      params: {},
    });
  });

  it('leaves out a parameter a later build added, and keeps the rest', () => {
    expect(
      readChatSystemNotice('relocated', { venue: 'Café', floor: 'first' }),
    ).toEqual({ key: 'relocated', params: { venue: 'Café' } });
  });

  it('cannot read a key a later build added, or parameters that do not fit their key', () => {
    expect(readChatSystemNotice('renamed', { title: 'New title' })).toBeNull();
    expect(readChatSystemNotice(null, null)).toBeNull();
    expect(
      readChatSystemNotice('rescheduled', {
        startsAt: 'next Friday',
        venue: 'Café',
      }),
    ).toBeNull();
    expect(readChatSystemNotice('relocated', { venue: '' })).toBeNull();
  });
});
