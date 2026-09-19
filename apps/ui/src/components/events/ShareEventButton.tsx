import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';

import {
  share_copied,
  share_copy_link,
  share_event_text,
  share_on_whatsapp,
  type Locale,
} from '@founders-coffee/i18n';

import {
  copyLink,
  currentShareUrl,
  shareNatively,
  whatsappShareUrl,
} from '../../lib/share';

type ShareEventButtonProps = {
  locale: Locale;
  title: string;
  label: string;
  variant: 'chip' | 'panel';
};

const TRIGGER_CLASS = {
  chip: 'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-base-100 px-3 py-2 text-body-sm font-medium transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-reduce:transition-none',
  panel: 'btn btn-outline btn-sm w-fit',
} as const;

const WRAPPER_CLASS = {
  chip: 'flex flex-col items-start gap-2 self-center',
  panel: 'flex flex-col gap-2',
} as const;

export const ShareEventButton = ({
  locale,
  title,
  label,
  variant,
}: ShareEventButtonProps) => {
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  const text = share_event_text({ title }, { locale });

  const handleShare = () => {
    const url = currentShareUrl();
    void shareNatively({ title, text, url }).then((outcome) => {
      if (outcome === 'unavailable') setFallbackUrl(url);
    });
  };

  const handleCopy = () => {
    if (fallbackUrl === null) return;
    void copyLink(fallbackUrl).then((written) =>
      setCopyState(written ? 'copied' : 'failed'),
    );
  };

  return (
    <div className={WRAPPER_CLASS[variant]}>
      <button
        type="button"
        className={TRIGGER_CLASS[variant]}
        onClick={handleShare}
      >
        <Share2 className="size-4 text-secondary" aria-hidden="true" />
        {label}
      </button>

      {fallbackUrl === null ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={whatsappShareUrl(text, fallbackUrl)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            {share_on_whatsapp({}, { locale })}
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleCopy}
          >
            <Copy className="size-4" aria-hidden="true" />
            {share_copy_link({}, { locale })}
          </button>
          {copyState === 'copied' ? (
            <span role="status" className="text-body-sm text-success">
              {share_copied({}, { locale })}
            </span>
          ) : null}
        </div>
      )}

      {copyState === 'failed' && fallbackUrl !== null ? (
        <input
          type="text"
          readOnly
          dir="ltr"
          aria-label={share_copy_link({}, { locale })}
          className="input input-sm w-full"
          value={fallbackUrl}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
};
