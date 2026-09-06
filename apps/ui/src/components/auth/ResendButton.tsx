import type { CSSProperties } from 'react';

import {
  login_resend,
  login_resend_in,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

type ResendButtonProps = {
  locale: Locale;
  secondsLeft: number;
  isBusy: boolean;
  onResend: () => void;
};

export const ResendButton = ({
  locale,
  secondsLeft,
  isBusy,
  onResend,
}: ResendButtonProps): React.ReactElement => {
  const isWaiting = secondsLeft > 0;

  return (
    <Button
      variant="ghost"
      onClick={onResend}
      disabled={isWaiting || isBusy}
      isFullWidth
    >
      {isWaiting ? (
        <>
          {login_resend_in({}, { locale })}
          <span
            className="countdown font-mono"
            dir="ltr"
            aria-hidden="true"
            data-testid="resend-countdown"
          >
            <span
              style={
                { '--value': Math.floor(secondsLeft / 60) } as CSSProperties
              }
            />
            :
            <span
              style={
                { '--value': secondsLeft % 60, '--digits': 2 } as CSSProperties
              }
            />
          </span>
        </>
      ) : (
        login_resend({}, { locale })
      )}
    </Button>
  );
};
