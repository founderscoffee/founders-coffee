import {
  getMyPreferences,
  getPushDeliveryState,
  updateMyPreferences,
} from '@founders-coffee/server-fns';
import type {
  AccountPreferencesView,
  UpdatePreferencesRequest,
} from '@founders-coffee/server-fns';

export type PreferencesInput = UpdatePreferencesRequest['preferences'];

export const preferencesApi = {
  getMyPreferences: (): Promise<AccountPreferencesView> =>
    getMyPreferences({ data: {} }),
  updateMyPreferences: (
    preferences: PreferencesInput,
  ): Promise<AccountPreferencesView> =>
    updateMyPreferences({ data: { preferences } }),
  getPushDeliveryState: (
    token: string,
  ): Promise<{ registered: boolean; deliverable: boolean }> =>
    getPushDeliveryState({ data: { token } }),
};

export type { AccountPreferencesView };
