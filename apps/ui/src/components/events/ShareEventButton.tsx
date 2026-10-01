import { Share2 } from 'lucide-react';
import { useState } from 'react';

import { share_event_text, type Locale } from '@founders-coffee/i18n';

import { eventShareUrl, shareNatively } from '../../lib/share';
import { ShareDialog } from './ShareDialog';

type ShareEventButtonProps = {
  locale: Locale;
  eventId: string;
  title: string;
  label: string;
};

const TRIGGER_CLASS =
  'btn btn-xs sm:btn-sm md:btn-md gap-2 self-center rounded-full border-0 bg-base-100 font-medium shadow-none hover:shadow-[var(--shadow-2)]';

export const ShareEventButton = ({
  locale,
  eventId,
  title,
  label,
}: ShareEventButtonProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const text = share_event_text({ title }, { locale });

  const handleShare = () => {
    const here = eventShareUrl(locale, eventId);
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
