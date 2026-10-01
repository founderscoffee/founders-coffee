import { MessagesSquare } from 'lucide-react';

import { chat_invite, type Locale } from '@founders-coffee/i18n';

type ChatInviteProps = {
  locale: Locale;
};

export const ChatInvite = ({ locale }: ChatInviteProps) => (
  <p className="flex items-start gap-2 text-body-sm text-neutral">
    <MessagesSquare
      className="mt-0.5 size-4 shrink-0 text-secondary"
      aria-hidden="true"
    />
    <span>{chat_invite({}, { locale })}</span>
  </p>
);
