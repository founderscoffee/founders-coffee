import {
  type ButtonHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '../lib/cn.js';
import { Countdown } from './Countdown.js';

const COOLDOWN_SECONDS = 30;

export type OtpResendState =
  | 'idle'
  | 'sending'
  | 'cooldown'
  | 'resend-available'
  | 'rate-limited'
  | 'fraud-guard'
  | 'network-error';

export interface ResendOtpLabels {
  send: string;
  sending: string;
  resendAvailable: string;
  resendCooldown: string;
  sentTo: string;
  rateLimitedNumber: string;
  fraudGuardBlocked: string;
  tryEmailInstead: string;
  networkError: string;
  tryAgain: string;
}

export interface ResendOtpButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  state: OtpResendState;
  onResend: () => void;
  labels: ResendOtpLabels;
  cooldownSeconds?: number;
  maskedNumber?: string;
}

export const ResendOtpButton = ({
  state,
  onResend,
  labels,
  cooldownSeconds = COOLDOWN_SECONDS,
  maskedNumber,
  className,
  ...props
}: ResendOtpButtonProps) => {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state === 'cooldown') {
      setSecondsLeft(cooldownSeconds);
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }

    return clearTimer;
  }, [state, cooldownSeconds, clearTimer]);

  if (state === 'rate-limited') {
    return (
      <div role='alert' className='alert alert-warning'>
        <span>{labels.rateLimitedNumber}</span>
      </div>
    );
  }

  if (state === 'fraud-guard') {
    return (
      <div role='alert' className='alert alert-warning'>
        <span>
          {labels.fraudGuardBlocked}{' '}
          <a href='/login' className='link link-primary'>
            {labels.tryEmailInstead}
          </a>
        </span>
      </div>
    );
  }

  if (state === 'network-error') {
    return (
      <div role='alert' className='alert alert-error'>
        <span>
          {labels.networkError}{' '}
          <button
            type='button'
            className='link link-primary'
            onClick={onResend}
          >
            {labels.tryAgain}
          </button>
        </span>
      </div>
    );
  }

  if (state === 'sending') {
    return (
      <button
        type='button'
        className={cn('btn btn-disabled', className)}
        disabled
        {...props}
      >
        <span className='loading loading-spinner' />
        {labels.sending}
      </button>
    );
  }

  if (state === 'cooldown') {
    return (
      <div className='flex flex-col items-center gap-1'>
        {maskedNumber && (
          <p className='text-sm text-base-content/70'>
            {labels.sentTo} {maskedNumber}
          </p>
        )}
        <button
          type='button'
          className={cn('btn btn-disabled', className)}
          disabled
          {...props}
        >
          {labels.resendCooldown}{' '}
          <Countdown seconds={secondsLeft} ariaLabel={`${secondsLeft} seconds`} />
        </button>
      </div>
    );
  }

  if (state === 'resend-available') {
    return (
      <button
        type='button'
        className={cn('btn btn-outline', className)}
        onClick={onResend}
        {...props}
      >
        {labels.resendAvailable}
      </button>
    );
  }

  return (
    <button
      type='button'
      className={cn('btn btn-primary', className)}
      onClick={onResend}
      {...props}
    >
      {labels.send}
    </button>
  );
};
ResendOtpButton.displayName = 'ResendOtpButton';
