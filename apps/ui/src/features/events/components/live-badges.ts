import {
  live_at_venue,
  live_running_late,
  live_status_connected,
  live_walking_in,
  type Locale,
} from '@founders-coffee/i18n';

import type { ConnectionState, RosterUser } from '../useEventLive';

export const statusLabel = (
  status: RosterUser['status'],
  locale: Locale,
): string => {
  switch (status) {
    case 'arrived':
      return live_at_venue({}, { locale });
    case 'walking_in':
      return live_walking_in({}, { locale });
    case 'running_late':
      return live_running_late({}, { locale });
    case 'connected':
      return live_status_connected({}, { locale });
  }
};

export const statusColor = (status: RosterUser['status']): string => {
  switch (status) {
    case 'arrived':
      return 'badge-success';
    case 'walking_in':
      return 'badge-warning';
    case 'running_late':
      return 'badge-error';
    case 'connected':
      return 'badge-ghost';
  }
};

export const connectionBadge = (state: ConnectionState): string => {
  switch (state) {
    case 'connected':
      return 'badge-success';
    case 'connecting':
    case 'authenticating':
      return 'badge-warning';
    case 'disconnected':
      return 'badge-ghost';
    case 'error':
      return 'badge-error';
  }
};
