import { MessagesSquare } from 'lucide-react';

import {
  chat_empty,
  chat_empty_help,
  type Locale,
} from '@founders-coffee/i18n';

type ChatEmptyProps = {
  locale: Locale;
  isOpen: boolean;
};

export const ChatEmpty = ({ locale, isOpen }: ChatEmptyProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
    <MessagesSquare className="size-8 text-secondary" aria-hidden="true" />
    <p className="font-semibold">{chat_empty({}, { locale })}</p>
    {isOpen ? (
      <p className="text-body-sm text-neutral">
        {chat_empty_help({}, { locale })}
      </p>
    ) : null}
  </div>
);
