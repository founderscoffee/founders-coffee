import { describe, expect, it } from 'vitest';

import type { ChatMessageWithAuthor } from '@founders-coffee/db';

import { chatMessageView } from './view.js';

const row = (
  overrides: Partial<ChatMessageWithAuthor> = {},
): ChatMessageWithAuthor => ({
  id: 'msg_00000000000000000000000000000001',
  channelId: 'chn_00000000000000000000000000000001',
  authorId: 'usr_author',
  kind: 'text',
  body: 'Salam',
  systemKey: null,
  systemParams: null,
  clientId: '5a3bb1f4-7f0a-4b8e-9f6d-2f1c3b4a5d6e',
  createdAt: new Date('2099-01-10T09:00:00.123Z'),
  removedAt: null,
  removedBy: null,
  removal: null,
  authorName: 'Amina',
  authorEmail: 'amina@example.com',
  authorPhotoAssetId: 'ast_amina',
  ...overrides,
});

describe('a message as a member reads it', () => {
  it("names its author, and gives the device's id back to the author only", () => {
    expect(chatMessageView(row(), 'usr_author')).toMatchObject({
      author: { id: 'usr_author', name: 'Amina', photoAssetId: 'ast_amina' },
      isOwn: true,
      clientId: '5a3bb1f4-7f0a-4b8e-9f6d-2f1c3b4a5d6e',
      createdAt: new Date('2099-01-10T09:00:00.123Z'),
    });
    expect(chatMessageView(row(), 'usr_reader')).toMatchObject({
      isOwn: false,
      clientId: null,
    });
    expect(JSON.stringify(chatMessageView(row(), 'usr_reader'))).not.toContain(
      'amina@example.com',
    );
  });

  it('names nobody when the author can no longer be shown, or their name is their email', () => {
    expect(
      chatMessageView(row({ authorName: null, authorPhotoAssetId: null }), 'x')
        .author,
    ).toEqual({ id: 'usr_author', name: null, photoAssetId: null });
    expect(
      chatMessageView(row({ authorName: 'amina@example.com' }), 'x').author
        ?.name,
    ).toBeNull();
  });

  it('gives a system message no author, and keeps what it says', () => {
    expect(
      chatMessageView(
        row({
          authorId: null,
          kind: 'system',
          body: '',
          systemKey: 'rescheduled',
          systemParams: { startsAt: '2099-01-16T18:00:00Z' },
          clientId: null,
        }),
        'usr_author',
      ),
    ).toMatchObject({
      kind: 'system',
      author: null,
      isOwn: false,
      systemKey: 'rescheduled',
      systemParams: { startsAt: '2099-01-16T18:00:00Z' },
    });
  });

  it('shows a removed message as the tombstone it is', () => {
    expect(
      chatMessageView(row({ body: '', removal: 'host' }), 'x'),
    ).toMatchObject({ body: '', removal: 'host' });
  });
});
