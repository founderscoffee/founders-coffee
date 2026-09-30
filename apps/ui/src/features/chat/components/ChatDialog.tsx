import { X as Close } from 'lucide-react';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

import { chat_close, chat_title, type Locale } from '@founders-coffee/i18n';

import { useVisualViewport } from '../useVisualViewport';

type ChatDialogProps = {
  locale: Locale;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export const ChatDialog = ({
  locale,
  title,
  onClose,
  children,
}: ChatDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const hasClosedRef = useRef(false);
  const titleId = useId();
  const frame = useVisualViewport();

  useLayoutEffect(() => {
    const dialog = ref.current;
    hasClosedRef.current = false;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      hasClosedRef.current = true;
      if (dialog?.open) dialog.close();
    };
  }, []);

  const close = () => {
    if (hasClosedRef.current) return;
    hasClosedRef.current = true;
    if (ref.current?.open) ref.current.close();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="modal modal-end"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
      onClose={() => {
        if (!ref.current?.open) close();
      }}
    >
      <div
        className="modal-box flex h-dvh w-full flex-col self-start overflow-hidden p-0 max-lg:rounded-none lg:w-md"
        style={
          frame
            ? { height: frame.height, transform: `translateY(${frame.top}px)` }
            : undefined
        }
      >
        <header className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
          <h2 id={titleId} className="min-w-0 flex-1">
            <span className="eyebrow block">{chat_title({}, { locale })}</span>{' '}
            <bdi className="block truncate font-display text-body font-semibold">
              {title}
            </bdi>
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-xs sm:btn-sm md:btn-md"
            aria-label={chat_close({}, { locale })}
            onClick={close}
          >
            <Close className="size-5" aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1} aria-hidden="true">
          {chat_close({}, { locale })}
        </button>
      </form>
    </dialog>
  );
};
