import { act } from '@testing-library/react';

import type { ChatMessageView, ChatPage } from './api';
import type { ChatMeta } from './chat-cache';

export const AMINA = { id: 'usr_amina', name: 'Amina', photoAssetId: null };

export const YACINE = { id: 'usr_yacine', name: 'Yacine', photoAssetId: null };

/** A stored text message as the server functions answer it, written by Amina unless overridden. */
export const chatMessage = (
  id: string,
  createdAt: Date,
  overrides: Partial<ChatMessageView> = {},
): ChatMessageView => ({
  id,
  kind: 'text',
  body: `Body of ${id}`,
  systemKey: null,
  systemParams: null,
  createdAt,
  removal: null,
  author: AMINA,
  isOwn: false,
  clientId: null,
  ...overrides,
});

/** An open chat's state and a member's own, who has never read it, unless overridden. */
export const chatMeta = (overrides: Partial<ChatMeta> = {}): ChatMeta => ({
  isHost: false,
  state: 'open',
  readOnlyAt: new Date('2026-10-09T20:00:00Z'),
  lastReadAt: null,
  muted: false,
  ...overrides,
});

/** The page an open chat's panel opens with, holding no messages unless overridden. */
export const chatPage = (overrides: Partial<ChatPage> = {}): ChatPage => ({
  ...chatMeta(),
  messages: [],
  hasOlder: false,
  ...overrides,
});

export const openedSockets: FakeSocket[] = [];

export class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  sent: string[] = [];
  closedWith: { code: number; reason: string } | null = null;

  constructor(readonly url: string) {
    openedSockets.push(this);
  }

  send = (data: string) => {
    this.sent.push(data);
  };

  close = (code?: number, reason?: string) => {
    this.readyState = FakeSocket.CLOSED;
    this.closedWith = { code: code ?? 1000, reason: reason ?? '' };
  };

  open = () =>
    act(() => {
      this.readyState = FakeSocket.OPEN;
      this.onopen?.();
    });

  push = (frame: Record<string, unknown>) =>
    act(() => {
      this.onmessage?.({ data: JSON.stringify(frame) });
    });

  drop = (code: number, reason = '') =>
    act(() => {
      this.readyState = FakeSocket.CLOSED;
      this.onclose?.({ code, reason });
    });
}

/** The socket the hook under test opened last, which a test drives as the room would. */
export const latestSocket = (): FakeSocket => {
  const socket = openedSockets.at(-1);
  if (!socket) throw new Error('No socket was opened');
  return socket;
};
