import { useId } from 'react';

import {
  CHAT_REPORT_REASONS,
  type ChatReportReason,
} from '@founders-coffee/core';
import {
  chat_report_harassment,
  chat_report_other,
  chat_report_reason,
  chat_report_spam,
  type Locale,
} from '@founders-coffee/i18n';

type ChatReportReasonsProps = {
  locale: Locale;
  value: ChatReportReason | null;
  isDisabled: boolean;
  onChange: (reason: ChatReportReason) => void;
};

const LABELS = {
  spam: chat_report_spam,
  harassment: chat_report_harassment,
  other: chat_report_other,
} as const satisfies Record<ChatReportReason, unknown>;

export const ChatReportReasons = ({
  locale,
  value,
  isDisabled,
  onChange,
}: ChatReportReasonsProps) => {
  const name = useId();

  return (
    <fieldset className="mt-4" disabled={isDisabled}>
      <legend className="mb-1 text-label text-neutral">
        {chat_report_reason({}, { locale })}
      </legend>
      {CHAT_REPORT_REASONS.map((reason) => (
        <label
          key={reason}
          className="flex min-h-11 cursor-pointer items-center gap-3"
        >
          <input
            type="radio"
            className="radio radio-primary shrink-0"
            name={name}
            value={reason}
            checked={value === reason}
            onChange={() => onChange(reason)}
          />
          <span className="text-body">{LABELS[reason]({}, { locale })}</span>
        </label>
      ))}
    </fieldset>
  );
};
