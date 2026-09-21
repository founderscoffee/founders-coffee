import {
  live_at_venue,
  live_error_cancelled,
  live_error_connection,
  live_error_session_expired,
  live_error_unknown,
  live_not_arrived,
  live_running_late,
  live_status_authenticating,
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
      return live_not_arrived({}, { locale });
  }
};

/**
 * The dot beside a roster status.
 *
 * It is decorative and carries `aria-hidden`: the status is written out next to it, so the colour
 * repeats the label rather than replacing it. Amber and red at this size are not distinguishable
 * for every reader, and a roster that only coloured its chips said nothing to those who cannot
 * tell them apart.
 */
export const statusDot = (status: RosterUser['status']): string => {
  switch (status) {
    case 'arrived':
      return 'bg-success';
    case 'walking_in':
      return 'bg-warning';
    case 'running_late':
      return 'bg-error';
    case 'connected':
      return 'bg-base-300';
  }
};

/**
 * daisyUI presence classes for the navbar avatar.
 *
 * The component offers only online and offline, so the two states in between borrow the online
 * dot and recolour it. The dot is never the only account of itself: the avatar carries the same
 * state in words for anyone who cannot read a colour, and a socket that has actually failed
 * raises a written alert in the live card rather than relying on this at all.
 */
export const presenceClass = (state: ConnectionState): string => {
  switch (state) {
    case 'connected':
      return 'avatar-online';
    case 'connecting':
    case 'authenticating':
      return 'avatar-online before:!bg-warning';
    case 'disconnected':
      return 'avatar-offline';
    case 'error':
      return 'avatar-online before:!bg-error';
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
