import { useEffect, useRef } from 'react';

/**
 * Lets a browser hand the code straight to the field via the WebOTP API, so a phone that just
 * received the message can fill the boxes without the reader copying digits between apps.
 *
 * The request is aborted whenever the code step is left, because an outstanding
 * `navigator.credentials.get` keeps listening otherwise. Everything here is best-effort: the API
 * is absent outside Chromium, and it rejects on cancel — both are swallowed.
 *
 * `onCode` is held in a ref so that a caller passing an inline arrow does not cancel and restart
 * the request on every render.
 *
 * @param isActive whether the code step is the one on screen.
 * @param onCode called with a code the browser recovered from an SMS.
 */
export const useOtpAutofill = (
  isActive: boolean,
  onCode: (code: string) => void,
): void => {
  const latestOnCode = useRef(onCode);
  latestOnCode.current = onCode;

  useEffect(() => {
    if (!isActive || !('credentials' in navigator)) return;

    const controller = new AbortController();
    navigator.credentials
      .get({
        otp: { transport: ['sms'] },
        signal: controller.signal,
      } as CredentialRequestOptions)
      .then((credential) => {
        if (credential && 'code' in credential) {
          latestOnCode.current(credential.code as string);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [isActive]);
};
