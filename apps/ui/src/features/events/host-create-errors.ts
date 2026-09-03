import { appErrorCode } from '@founders-coffee/core';
import {
  host_error_forbidden,
  host_error_invalid,
  host_error_market_disabled,
  host_error_market_unavailable,
  host_error_rate_limited,
  host_error_signed_out,
  host_error_title_taken,
  host_error_unavailable,
  host_map_error,
  host_publish_error,
  host_venue_outside_city,
  host_venue_unsupported,
  type Locale,
} from '@founders-coffee/i18n';

type HostErrorMessage = (
  inputs?: Record<string, never>,
  options?: { locale?: Locale },
) => string;

const PUBLISH_ERROR_MESSAGES: Record<string, HostErrorMessage> = {
  unauthenticated: host_error_signed_out,
  forbidden: host_error_forbidden,
  rate_limited: host_error_rate_limited,
  security_configuration_error: host_error_unavailable,
  validation_failed: host_error_invalid,
  event_market_unavailable: host_error_market_unavailable,
  event_creation_disabled: host_error_market_disabled,
  map_venue_outside_city: host_venue_outside_city,
  map_venue_unsupported: host_venue_unsupported,
  map_city_not_found: host_map_error,
  map_provider_unavailable: host_map_error,
  event_route_conflict: host_error_title_taken,
};

export const REAUTHENTICATION_ERROR_CODE = 'unauthenticated';

export interface HostPublishFailure {
  readonly code: string;
  readonly message: string;
  readonly requiresReauthentication: boolean;
}

/**
 * Turn a failed create mutation into the localized, actionable message for the confirmation step.
 *
 * Every stable code the create path can produce — the authorization, rate-limit, validation,
 * market, geography and route-conflict stages — gets copy that names the action the host can take,
 * because "couldn't publish, try again" is wrong advice for a paused market and useless advice for
 * an expired session. Anything unrecognized keeps that generic retry message: a new server code
 * must degrade to a safe fallback rather than render blank.
 *
 * `requiresReauthentication` is separated from the message because an expired session is the one
 * failure the wizard resolves by leaving the page (EC-08), and the caller — not this mapping — owns
 * the draft-preserving handoff.
 */
export const hostPublishFailure = (
  error: unknown,
  locale: Locale,
): HostPublishFailure => {
  const code = appErrorCode(error);
  const message = PUBLISH_ERROR_MESSAGES[code] ?? host_publish_error;
  return {
    code,
    message: message({}, { locale }),
    requiresReauthentication: code === REAUTHENTICATION_ERROR_CODE,
  };
};
