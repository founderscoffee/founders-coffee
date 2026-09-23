import { useEffect, useId, useRef } from 'react';

import {
  cancel_body,
  cancel_title,
  free_seat,
  keep_seat,
  type Locale,
} from '@founders-coffee/i18n';

type RsvpCancelDialogProps = {
  isOpen: boolean;
  hostName: string;
  locale: Locale;
  isPending: boolean;
  onKeep: () => void;
  onConfirm: () => void;
};

export const RsvpCancelDialog = ({
  isOpen,
  hostName,
  locale,
  isPending,
  onKeep,
  onConfirm,
}: RsvpCancelDialogProps) => {
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
      <div className="modal-box max-w-sm rounded-box border border-base-300 bg-base-100">
        <h2 id={titleId} className="font-display text-h4 font-semibold">
          {cancel_title({}, { locale })}
        </h2>
        <p className="mt-2 text-body-sm leading-relaxed text-neutral">
          {cancel_body({ host: hostName }, { locale })}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onKeep}>
            {keep_seat({}, { locale })}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-error"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <span
                className="loading loading-spinner loading-xs"
                aria-hidden="true"
              />
            ) : null}
            {free_seat({}, { locale })}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1} aria-hidden="true">
          {keep_seat({}, { locale })}
        </button>
      </form>
    </dialog>
  );
};
