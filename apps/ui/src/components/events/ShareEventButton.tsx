import { Share2 } from 'lucide-react';
import { useState } from 'react';

import { share_event_text, type Locale } from '@founders-coffee/i18n';

import { currentShareUrl, shareNatively } from '../../lib/share';
import { ShareDialog } from './ShareDialog';

type ShareEventButtonProps = {
  locale: Locale;
  title: string;
  label: string;
};

const TRIGGER_CLASS =
  'inline-flex min-h-9 cursor-pointer items-center gap-2 self-center rounded-full bg-base-100 px-3 py-2 text-body-sm font-medium transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-reduce:transition-none';

export const ShareEventButton = ({
  locale,
  title,
  label,
}: ShareEventButtonProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const text = share_event_text({ title }, { locale });

  const handleShare = () => {
    const here = currentShareUrl();
    setUrl(here);
    void shareNatively({ title, text, url: here }).then((outcome) => {
      if (outcome === 'unavailable') setIsDialogOpen(true);
    });
  };

  return (
    <>
      <button type="button" className={TRIGGER_CLASS} onClick={handleShare}>
        <Share2 className="size-4 text-secondary" aria-hidden="true" />
        {label}
      </button>

      {url === null ? null : (
        <ShareDialog
          isOpen={isDialogOpen}
          locale={locale}
          title={title}
          text={text}
          url={url}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
};
