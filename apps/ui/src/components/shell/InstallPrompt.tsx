import { Download } from 'lucide-react';
import { useId, useRef, type KeyboardEvent } from 'react';

import {
  install_prompt_body,
  install_prompt_body_ios,
  install_prompt_decline,
  install_prompt_done,
  install_prompt_install,
  install_prompt_title,
  type Locale,
} from '@founders-coffee/i18n';

import { InstallSteps } from './InstallSteps';
import { useInstallPrompt } from './useInstallPrompt';

type InstallPromptProps = {
  locale: Locale;
  canShow: boolean;
};

const APP_ICON = '/android-chrome-192x192.png';

const BUTTON = 'btn btn-xs sm:btn-sm md:btn-md';

export const InstallPrompt = ({ locale, canShow }: InstallPromptProps) => {
  const { view, install, dismiss } = useInstallPrompt(canShow);
  const titleId = useId();
  const sheet = useRef<HTMLElement>(null);

  const handOffFocus = () => {
    if (sheet.current?.contains(document.activeElement))
      document.getElementById('main-content')?.focus({ preventScroll: true });
  };

  const close = () => {
    handOffFocus();
    dismiss();
  };

  const accept = () => {
    handOffFocus();
    void install();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') close();
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
    >
      {view ? (
        <div className="flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <section
            ref={sheet}
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
            className="pointer-events-auto w-full max-w-md rounded-box border border-base-300 bg-base-100 p-4 shadow-[var(--shadow-3)] transition-[translate,opacity] duration-[var(--duration-slow)] ease-out motion-reduce:transition-none starting:translate-y-4 starting:opacity-0"
          >
            <div className="flex items-start gap-3">
              <img
                src={APP_ICON}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-box border border-base-300"
              />
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="font-display text-body font-semibold text-base-content"
                >
                  {install_prompt_title({}, { locale })}
                </h2>
                <p className="mt-0.5 text-body-sm text-neutral">
                  {view === 'ios'
                    ? install_prompt_body_ios({}, { locale })
                    : install_prompt_body({}, { locale })}
                </p>
              </div>
            </div>
            {view === 'ios' ? <InstallSteps locale={locale} /> : null}
            <div className="mt-4 flex justify-end gap-2">
              {view === 'ios' ? (
                <button
                  type="button"
                  className={`${BUTTON} btn-primary`}
                  onClick={close}
                >
                  {install_prompt_done({}, { locale })}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${BUTTON} btn-ghost`}
                    onClick={close}
                  >
                    {install_prompt_decline({}, { locale })}
                  </button>
                  <button
                    type="button"
                    className={`${BUTTON} btn-primary`}
                    onClick={accept}
                  >
                    <Download aria-hidden="true" className="size-4" />
                    {install_prompt_install({}, { locale })}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
