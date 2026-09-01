import { useState, useEffect } from 'react';

export interface PushPermissionPromptProps {
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
  onAccept,
  onDecline,
}: PushPermissionPromptProps) => {
  const [visible, setVisible] = useState(false);

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
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">never miss a seat.</h3>
        <p className="py-4 text-sm opacity-70">
          We only use notifications to let you know when the host arrives, what
          table they are at, or if an event changes location. No marketing spam,
          ever.
        </p>
        <div className="modal-action">
          <button className="btn btn-primary btn-sm" onClick={handleAccept}>
            Keep me updated
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleDecline}>
            Not now, stick to SMS
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleDecline}>close</button>
      </form>
    </dialog>
  );
};
