import { createSerializationAdapter } from '@tanstack/react-router';

import { AppError } from '@founders-coffee/core';

type SerializedAppError = {
  readonly code: string;
  readonly message: string;
};

const isAppError = (value: unknown): value is AppError =>
  value instanceof AppError;

/**
 * Reduce an `AppError` to the pair the client is allowed to branch on.
 *
 * AGENTS.md §7 makes server functions the throw boundary and tells the client to read
 * `appErrorCode()`. That contract was silently broken: TanStack Start encodes a thrown error with
 * its own `ShallowErrorPlugin`, which serializes **only** `message` — deliberately, so an error
 * carrying functions (a ZodError, say) cannot break the response. Every `AppError` therefore
 * arrived as a bare `Error`, `appErrorCode()` returned `'unknown'`, and every branch on a code —
 * `event_full`, `already_rsvpd`, `rate_limited`, `validation_failed` — was dead. Nothing looked
 * broken, because each branch has a fallback and the UI always showed *an* error.
 *
 * `details` is deliberately dropped. It is diagnostic data assembled server-side, it is the part
 * most likely to hold something unserializable, and it is the part most likely to describe
 * internals the client has no business seeing. The code and the message are the contract.
 */
const toSerializableAppError = ({
  code,
  message,
}: AppError): SerializedAppError => ({ code, message });

const reviveAppError = ({ code, message }: SerializedAppError): AppError =>
  new AppError(code, message);

export const appErrorSerializationAdapter = createSerializationAdapter({
  key: 'AppError',
  test: isAppError,
  toSerializable: toSerializableAppError,
  fromSerializable: reviveAppError,
});
