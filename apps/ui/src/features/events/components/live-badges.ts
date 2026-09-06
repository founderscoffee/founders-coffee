import {
  live_at_venue,
  live_error_cancelled,
  live_error_connection,
  live_error_session_expired,
  live_error_unknown,
  live_running_late,
  live_status_authenticating,
  live_status_connected,
  live_status_connecting,
  live_status_disconnected,
  live_status_error,
  live_walking_in,
  type Locale,
} from '@founders-coffee/i18n';

import type {
  ConnectionState,
  LiveErrorCode,
  RosterUser,
} from '../useEventLive';

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

/**
 * The connection state, in the reader's language.
 *
 * `connected` is deliberately absent: the caller renders its own label for it, because a connected
 * room is the ordinary case and reads better as part of the heading than as a status word.
 */
export const connectionLabel = (
  state: Exclude<ConnectionState, 'connected'>,
  locale: Locale,
): string => {
  switch (state) {
    case 'connecting':
      return live_status_connecting({}, { locale });
    case 'authenticating':
      return live_status_authenticating({}, { locale });
    case 'disconnected':
      return live_status_disconnected({}, { locale });
    case 'error':
      return live_status_error({}, { locale });
  }
};

/** A live-room failure, as a sentence the reader can act on. */
export const liveErrorMessage = (
  code: LiveErrorCode,
  locale: Locale,
): string => {
  switch (code) {
    case 'session_expired':
      return live_error_session_expired({}, { locale });
    case 'cancelled':
      return live_error_cancelled({}, { locale });
    case 'connection':
      return live_error_connection({}, { locale });
    case 'unknown':
      return live_error_unknown({}, { locale });
  }
};
