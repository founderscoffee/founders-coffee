import { useState, useEffect, useId } from 'react';

import {
  push_prompt_accept,
  push_prompt_body,
  push_prompt_decline,
  push_prompt_title,
  type Locale,
} from '@founders-coffee/i18n';

export interface PushPermissionPromptProps {
  locale: Locale;
  onAccept: () => void;
  onDecline: () => void;
}

const STORAGE_KEY = 'fc_push_prompt_dismissed';

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const markDismissed = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    return;
  }
};

export const PushPermissionPrompt = ({
  locale,
  onAccept,
  onDecline,
}: PushPermissionPromptProps) => {
  const [visible, setVisible] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (wasDismissed()) return;

    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;

    setVisible(true);
  }, []);

  const handleAccept = () => {
    setVisible(false);
    onAccept();
  };

  const handleDecline = () => {
    setVisible(false);
    markDismissed();
    onDecline();
  };

  if (!visible) return null;

  return (
    <dialog className="modal modal-open" aria-labelledby={titleId}>
      <div className="modal-box max-w-sm rounded-box border border-base-300 bg-base-100">
        <h2 id={titleId} className="font-display text-h4 font-semibold">
          {push_prompt_title({}, { locale })}
        </h2>
        <p className="py-4 text-body-sm leading-relaxed text-neutral">
          {push_prompt_body({}, { locale })}
        </p>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleDecline}
          >
            {push_prompt_decline({}, { locale })}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAccept}
          >
            {push_prompt_accept({}, { locale })}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button
          type="submit"
          tabIndex={-1}
          aria-hidden="true"
          onClick={handleDecline}
        >
          {push_prompt_decline({}, { locale })}
        </button>
      </form>
    </dialog>
  );
};
