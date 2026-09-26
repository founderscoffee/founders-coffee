import { useId, useState } from 'react';

import {
  cancel,
  telegram_group_title,
  telegram_host_connect,
  telegram_host_connected,
  telegram_host_connected_help,
  telegram_host_disconnect,
  telegram_host_disconnect_confirm,
  telegram_host_disconnect_keep,
  telegram_host_intro,
  telegram_host_new_link,
  telegram_host_open,
  telegram_host_open_help,
  telegram_host_waiting,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import type { TelegramConnectLink, TelegramGroupView } from '../api';
import { telegramErrorFor } from '../errors';
import { useConnectTelegramGroup, useDisconnectTelegramGroup } from '../hooks';
import { useFocusWhenShown } from '../useFocusWhenShown';

type TelegramHostPanelProps = {
  eventId: string;
  locale: Locale;
  view: Extract<TelegramGroupView, { role: 'host' }>;
};

export const TelegramHostPanel = ({
  eventId,
  locale,
  view,
}: TelegramHostPanelProps) => {
  const headingId = useId();
  const connect = useConnectTelegramGroup(eventId);
  const disconnect = useDisconnectTelegramGroup(eventId);
  const [link, setLink] = useState<TelegramConnectLink | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { container, focusWhenShown } = useFocusWhenShown<HTMLElement>();

  if (view.status !== 'active' && !view.canConnect) return null;

  const openLink = () => {
    setError(null);
    connect.mutate(undefined, {
      onSuccess: (created) => {
        setLink(created);
        focusWhenShown('open');
      },
      onError: (cause) => setError(telegramErrorFor(cause, locale)),
    });
  };

  const letGo = () => {
    setError(null);
    disconnect.mutate(undefined, {
      onSuccess: () => {
        setLink(null);
        setIsConfirming(false);
        focusWhenShown('connect');
      },
      onError: (cause) => {
        setIsConfirming(false);
        setError(telegramErrorFor(cause, locale));
      },
    });
  };

  const withdrawButton = (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={letGo}
      disabled={disconnect.isPending}
    >
      {cancel({}, { locale })}
    </button>
  );

  return (
    <section
      ref={container}
      aria-labelledby={headingId}
      className="flex flex-col gap-2 border-t border-base-300 pt-3"
    >
      <h3 id={headingId} className="eyebrow">
        {telegram_group_title({}, { locale })}
      </h3>

      {view.status === 'active' ? (
        <>
          <p className="text-body-sm font-medium">
            {telegram_host_connected({}, { locale })}
          </p>
          {view.chatTitle ? (
            <p className="text-body-sm font-semibold" dir="auto">
              {view.chatTitle}
            </p>
          ) : null}
          <p className="text-body-sm text-neutral">
            {telegram_host_connected_help({}, { locale })}
          </p>
          {isConfirming ? (
            <div className="flex flex-col gap-2 rounded-box bg-base-200 p-3">
              <p className="text-body-sm">
                {telegram_host_disconnect_confirm({}, { locale })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-error btn-sm"
                  onClick={letGo}
                  disabled={disconnect.isPending}
                >
                  {telegram_host_disconnect({}, { locale })}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  data-focus="keep"
                  onClick={() => {
                    setIsConfirming(false);
                    focusWhenShown('disconnect');
                  }}
                >
                  {telegram_host_disconnect_keep({}, { locale })}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm w-fit text-error"
              data-focus="disconnect"
              onClick={() => {
                setIsConfirming(true);
                focusWhenShown('keep');
              }}
            >
              {telegram_host_disconnect({}, { locale })}
            </button>
          )}
        </>
      ) : view.status === 'pending' && link ? (
        <>
          <p className="text-body-sm text-neutral">
            {telegram_host_open_help({}, { locale })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="btn btn-secondary btn-sm"
              data-focus="open"
              href={link.connectLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {telegram_host_open({}, { locale })}
            </a>
            {withdrawButton}
          </div>
        </>
      ) : view.status === 'pending' ? (
        <>
          <p className="text-body-sm text-neutral">
            {telegram_host_waiting({}, { locale })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={openLink}
              disabled={connect.isPending}
            >
              {telegram_host_new_link({}, { locale })}
            </button>
            {withdrawButton}
          </div>
        </>
      ) : (
        <>
          <p className="text-body-sm text-neutral">
            {telegram_host_intro({}, { locale })}
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm w-fit"
            data-focus="connect"
            onClick={openLink}
            disabled={connect.isPending}
          >
            {telegram_host_connect({}, { locale })}
          </button>
        </>
      )}

      {error ? <StatusMessage variant="error">{error}</StatusMessage> : null}
    </section>
  );
};
