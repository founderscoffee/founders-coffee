import { useEffect, useId, useRef } from 'react';

import {
  host_cancel_body,
  host_cancel_confirm,
  host_cancel_keep,
  host_cancel_reason_label,
  host_cancel_reason_placeholder,
  host_cancel_title,
  host_cancelling,
  type Locale,
} from '@founders-coffee/i18n';

export const CANCEL_REASON_MAX_LENGTH = 280;

type CancelEventDialogProps = {
  isOpen: boolean;
  locale: Locale;
  reason: string;
  isPending: boolean;
  onReasonChange: (reason: string) => void;
  onKeep: () => void;
  onConfirm: () => void;
};

export const CancelEventDialog = ({
  isOpen,
  locale,
  reason,
  isPending,
  onReasonChange,
  onKeep,
  onConfirm,
}: CancelEventDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onKeep}
    >
      <div className="modal-box max-w-md rounded-box border border-base-300 bg-base-100">
        <h2 id={titleId} className="font-display text-h4 font-semibold">
          {host_cancel_title({}, { locale })}
        </h2>
        <p className="mt-2 text-body-sm leading-relaxed text-neutral">
          {host_cancel_body({}, { locale })}
        </p>

        <label className="form-control mt-4">
          <span className="mb-1 block text-label text-neutral">
            {host_cancel_reason_label({}, { locale })}
          </span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            maxLength={CANCEL_REASON_MAX_LENGTH}
            value={reason}
            disabled={isPending}
            placeholder={host_cancel_reason_placeholder({}, { locale })}
            onChange={(event) => onReasonChange(event.target.value)}
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onKeep}
            disabled={isPending}
          >
            {host_cancel_keep({}, { locale })}
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <span
                className="loading loading-spinner loading-xs"
                aria-hidden="true"
              />
            ) : null}
            {isPending
              ? host_cancelling({}, { locale })
              : host_cancel_confirm({}, { locale })}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1} aria-hidden="true">
          {host_cancel_keep({}, { locale })}
        </button>
      </form>
    </dialog>
  );
};
