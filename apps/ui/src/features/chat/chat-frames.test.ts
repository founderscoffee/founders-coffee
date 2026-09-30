import { describe, expect, it } from 'vitest';

import { HEARTBEAT_ACK_FRAME } from '@founders-coffee/core/rooms';

import { parseChatFrame } from './chat-frames';

const stored = {
  id: 'msg_1',
  kind: 'text',
  body: 'Salam',
  systemKey: null,
  systemParams: null,
  createdAt: '2026-09-30T18:00:00.000Z',
  removal: null,
  author: { id: 'usr_amina', name: 'Amina', photoAssetId: null },
  isOwn: true,
  clientId: '8f14e45f-ceea-4e7b-9b4d-5d2c1a3e4b6f',
};

describe('what the chat’s room pushes', () => {
  it('reads a message as the server functions answer it, its time a date again', () => {
    const frame = parseChatFrame(
      JSON.stringify({ type: 'message', message: stored }),
    );

    expect(frame).toEqual({
      type: 'message',
      message: { ...stored, createdAt: new Date(stored.createdAt) },
    });
  });

  it('reads a notice about the meetup, with no author and its key and parameters', () => {
    const notice = {
      ...stored,
      kind: 'system',
      body: '',
      systemKey: 'cancelled',
      systemParams: { reason: 'Le café ferme.' },
      author: null,
      isOwn: false,
      clientId: null,
    };

    expect(
      parseChatFrame(JSON.stringify({ type: 'message', message: notice })),
    ).toEqual({
      type: 'message',
      message: { ...notice, createdAt: new Date(stored.createdAt) },
    });
  });

  it('reads a removal, a closed chat and a revoked member', () => {
    expect(
      parseChatFrame('{"type":"removed","id":"msg_1","removal":"host"}'),
    ).toEqual({ type: 'removed', id: 'msg_1', removal: 'host' });
    expect(parseChatFrame('{"type":"closed"}')).toEqual({ type: 'closed' });
    expect(parseChatFrame('{"type":"revoked"}')).toEqual({ type: 'revoked' });
  });

  it('has nothing to act on in a heartbeat’s answer, a stranger frame or anything malformed', () => {
    expect(parseChatFrame(HEARTBEAT_ACK_FRAME)).toBeNull();
    expect(parseChatFrame('{"type":"typing"}')).toBeNull();
    expect(parseChatFrame('{"type":"removed","id":"msg_1"}')).toBeNull();
    expect(parseChatFrame('{"type":"message"')).toBeNull();
    expect(parseChatFrame(new ArrayBuffer(4))).toBeNull();
  });
});
