import {
  connectTelegramGroup,
  disconnectTelegramGroup,
  getTelegramGroupView,
  requestTelegramInvite,
  type TelegramGroupView,
} from '@founders-coffee/server-fns';

export type TelegramConnectLink = { connectLink: string; expiresAt: Date };

export const telegramApi = {
  getView: (eventId: string): Promise<TelegramGroupView> =>
    getTelegramGroupView({ data: { eventId } }),
  connect: (eventId: string): Promise<TelegramConnectLink> =>
    connectTelegramGroup({ data: { eventId } }),
  disconnect: (eventId: string): Promise<{ disconnected: boolean }> =>
    disconnectTelegramGroup({ data: { eventId } }),
  requestInvite: (eventId: string): Promise<{ inviteLink: string }> =>
    requestTelegramInvite({ data: { eventId } }),
};

export type { TelegramGroupView };
