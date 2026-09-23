import { Mail, X as Close } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import {
  share_close,
  share_copied,
  share_copy_link,
  share_email,
  share_event,
  type Locale,
} from '@founders-coffee/i18n';

import { copyLink } from '../../lib/share';
import { shareTargetsFor, type ShareTargetKey } from '../../lib/share-targets';

type ShareDialogProps = {
  isOpen: boolean;
  locale: Locale;
  title: string;
  text: string;
  url: string;
  onClose: () => void;
};

const BRAND_LABEL: Record<Exclude<ShareTargetKey, 'email'>, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  x: 'X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

export const ShareDialog = ({
  isOpen,
  locale,
  title,
  text,
  url,
  onClose,
}: ShareDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  const targets = shareTargetsFor({ title, text, url });

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="modal-box max-w-md rounded-box border border-base-300 bg-base-100">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-display text-h4 font-semibold">
            {share_event({}, { locale })}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={onClose}
            aria-label={share_close({}, { locale })}
          >
            <Close className="size-5" aria-hidden="true" />
          </button>
        </div>

        <ul className="mt-5 flex list-none gap-3 overflow-x-auto pb-2">
          {targets.map((target) => (
            <li key={target.key} className="shrink-0">
              <a
                href={target.href}
                target="_blank"
                rel="noreferrer"
                className="flex w-18 flex-col items-center gap-1.5 rounded-box py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                <span
                  className={`flex size-14 items-center justify-center rounded-full text-base-100 ${target.swatch}`}
                >
                  {target.glyph === null ? (
                    <Mail className="size-6" aria-hidden="true" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="size-6 fill-current"
                      aria-hidden="true"
                    >
                      <path d={target.glyph} />
                    </svg>
                  )}
                </span>
                <span className="text-body-sm text-neutral">
                  {target.key === 'email'
                    ? share_email({}, { locale })
                    : BRAND_LABEL[target.key]}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-2 rounded-full border border-base-300 bg-base-200 p-1.5 ps-3">
          <input
            type="text"
            readOnly
            dir="ltr"
            aria-label={share_copy_link({}, { locale })}
            className="min-w-0 flex-1 truncate bg-transparent text-body-sm text-neutral outline-none"
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className={`btn btn-sm shrink-0 rounded-full ${copied ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => void copyLink(url).then(setCopied)}
          >
            {copied
              ? share_copied({}, { locale })
              : share_copy_link({}, { locale })}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1} aria-hidden="true">
          {share_close({}, { locale })}
        </button>
      </form>
    </dialog>
  );
};
