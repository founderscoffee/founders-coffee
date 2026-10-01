import { useId, useLayoutEffect, useRef, useState } from 'react';

import { appErrorCode, type ChatReportReason } from '@founders-coffee/core';
import {
  cancel,
  chat_delete_body,
  chat_delete_confirm,
  chat_delete_error,
  chat_delete_title,
  chat_member,
  chat_message_from,
  chat_message_gone,
  chat_remove_body,
  chat_remove_confirm,
  chat_remove_error,
  chat_remove_message,
  chat_remove_title,
  chat_report_body,
  chat_report_confirm,
  chat_report_error,
  chat_report_message,
  chat_report_title,
  chat_report_unavailable,
  rate_limited,
  type Locale,
} from '@founders-coffee/i18n';
import { IsolatedValue, StatusMessage } from '@founders-coffee/ui';

import type { ChatMessageView, ChatReportStatus } from '../api';
import { chatMessageActions, type ChatMessageAction } from '../chat-actions';
import { useRemoveChatMessage, useReportChatMessage } from '../hooks';
import { ChatReportReasons } from './ChatReportReasons';

type Step = 'choose' | ChatMessageAction;

type ChatMessageDialogProps = {
  locale: Locale;
  eventId: string;
  viewerId: string;
  isHost: boolean;
  message: ChatMessageView;
  onClose: () => void;
  onReported: (status: ChatReportStatus) => void;
};

const TITLES = {
  delete: chat_delete_title,
  remove: chat_remove_title,
  report: chat_report_title,
} as const;

const BODIES = {
  delete: chat_delete_body,
  remove: chat_remove_body,
  report: chat_report_body,
} as const;

const CONFIRMS = {
  delete: chat_delete_confirm,
  remove: chat_remove_confirm,
  report: chat_report_confirm,
} as const;

const failureOf = (
  step: ChatMessageAction,
  error: unknown,
  locale: Locale,
): string => {
  const code = appErrorCode(error);
  if (code === 'rate_limited') return rate_limited({}, { locale });
  if (step === 'report')
    return code === 'chat_report_refused'
      ? chat_report_unavailable({}, { locale })
      : chat_report_error({}, { locale });
  if (code === 'chat_message_not_found')
    return chat_message_gone({}, { locale });
  return step === 'delete'
    ? chat_delete_error({}, { locale })
    : chat_remove_error({}, { locale });
};

export const ChatMessageDialog = ({
  locale,
  eventId,
  viewerId,
  isHost,
  message,
  onClose,
  onReported,
}: ChatMessageDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const actions = chatMessageActions(message, isHost);
  const [step, setStep] = useState<Step>(
    actions.length === 1 && actions[0] ? actions[0] : 'choose',
  );
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const remove = useRemoveChatMessage(eventId, viewerId);
  const report = useReportChatMessage();
  const isPending = remove.isPending || report.isPending;
  const failure = step === 'report' ? report.error : remove.error;
  const name = message.author?.name ?? chat_member({}, { locale });

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const confirm = () => {
    if (step === 'choose') return;
    if (step !== 'report') {
      remove.mutate(message.id, { onSuccess: onClose });
      return;
    }
    if (!reason) return;
    report.mutate(
      { messageId: message.id, reason },
      {
        onSuccess: ({ status }) => {
          onReported(status);
          onClose();
        },
      },
    );
  };

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
    >
      <div className="modal-box max-w-md rounded-box border border-base-300 bg-base-100">
        <h2 id={titleId} className="font-display text-h4 font-semibold">
          {step === 'choose' ? (
            <IsolatedValue
              value={name}
              message={(author) =>
                chat_message_from({ name: author }, { locale })
              }
            />
          ) : (
            TITLES[step]({}, { locale })
          )}
        </h2>
        <blockquote className="mt-3 border-s-4 border-base-300 ps-3 text-body-sm text-neutral">
          <p className="line-clamp-3 break-words">
            <bdi>{message.body}</bdi>
          </p>
        </blockquote>
        {step === 'choose' ? null : (
          <p className="mt-3 text-body-sm leading-relaxed text-neutral">
            {BODIES[step]({}, { locale })}
          </p>
        )}
        {step === 'report' ? (
          <ChatReportReasons
            locale={locale}
            value={reason}
            isDisabled={isPending}
            onChange={setReason}
          />
        ) : null}
        {failure && step !== 'choose' ? (
          <StatusMessage variant="error" className="mt-4">
            {failureOf(step, failure, locale)}
          </StatusMessage>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-ghost btn-xs sm:btn-sm md:btn-md"
            onClick={onClose}
            disabled={isPending}
          >
            {cancel({}, { locale })}
          </button>
          {step === 'choose' ? (
            <>
              {actions.includes('report') ? (
                <button
                  type="button"
                  className="btn btn-outline btn-xs sm:btn-sm md:btn-md"
                  onClick={() => setStep('report')}
                >
                  {chat_report_message({}, { locale })}
                </button>
              ) : null}
              {actions.includes('remove') ? (
                <button
                  type="button"
                  className="btn btn-outline btn-error btn-xs sm:btn-sm md:btn-md"
                  onClick={() => setStep('remove')}
                >
                  {chat_remove_message({}, { locale })}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className={
                step === 'report'
                  ? 'btn btn-primary btn-xs sm:btn-sm md:btn-md'
                  : 'btn btn-error btn-xs sm:btn-sm md:btn-md'
              }
              onClick={confirm}
              disabled={isPending || (step === 'report' && !reason)}
            >
              {isPending ? (
                <span
                  className="loading loading-spinner loading-xs"
                  aria-hidden="true"
                />
              ) : null}
              {CONFIRMS[step]({}, { locale })}
            </button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1} aria-hidden="true">
          {cancel({}, { locale })}
        </button>
      </form>
    </dialog>
  );
};
