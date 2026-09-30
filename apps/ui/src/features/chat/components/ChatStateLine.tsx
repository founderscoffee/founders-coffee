import { Clock, Lock } from 'lucide-react';

import {
  chat_open_until,
  chat_read_only,
  chat_read_only_cancelled,
  type Locale,
} from '@founders-coffee/i18n';
import { IsolatedValue } from '@founders-coffee/ui';

import { readOnlyLabel } from '../chat-time';

type ChatStateLineProps = {
  locale: Locale;
  timeZone: string;
  isOpen: boolean;
  isCancelled: boolean;
  readOnlyAt: Date;
  endsAt: Date | null;
};

const LINE =
  'flex items-center gap-2 border-b border-base-300 bg-base-200 px-4 py-2 text-body-sm text-neutral';

export const ChatStateLine = ({
  locale,
  timeZone,
  isOpen,
  isCancelled,
  readOnlyAt,
  endsAt,
}: ChatStateLineProps) => {
  if (!isOpen)
    return (
      <p className={LINE}>
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        {isCancelled
          ? chat_read_only_cancelled({}, { locale })
          : chat_read_only({}, { locale })}
      </p>
    );
  if (endsAt === null || endsAt.getTime() > Date.now()) return null;
  return (
    <p className={LINE}>
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <IsolatedValue
          value={readOnlyLabel(readOnlyAt, locale, timeZone)}
          message={(date) => chat_open_until({ date }, { locale })}
        />
      </span>
    </p>
  );
};
