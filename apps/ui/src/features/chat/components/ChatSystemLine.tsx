import type { chat } from '@founders-coffee/domain';
import {
  chat_system_cancel_reason,
  chat_system_cancelled,
  chat_system_place,
  chat_system_relocated,
  chat_system_rescheduled,
  chat_system_update,
  type Locale,
} from '@founders-coffee/i18n';
import { IsolatedValue, IsolatedValues } from '@founders-coffee/ui';

import { momentLabel } from '../chat-time';

type ChatSystemLineProps = {
  locale: Locale;
  timeZone: string;
  notice: chat.ChatSystemNotice | null;
};

const LINE = 'px-6 py-2 text-center text-body-sm text-neutral wrap-break-word';

export const ChatSystemLine = ({
  locale,
  timeZone,
  notice,
}: ChatSystemLineProps) => {
  switch (notice?.key) {
    case 'rescheduled':
      return (
        <p className={LINE}>
          <IsolatedValues
            values={{
              date: momentLabel(
                new Date(notice.params.startsAt),
                locale,
                timeZone,
              ),
              venue: notice.params.venue,
            }}
            message={(slot) => chat_system_rescheduled(slot, { locale })}
          />
        </p>
      );
    case 'relocated': {
      const { venue, address } = notice.params;
      return (
        <p className={LINE}>
          <IsolatedValues
            values={{ venue, address: address ?? '' }}
            message={(slot) =>
              chat_system_relocated(
                {
                  place: address
                    ? chat_system_place(slot, { locale })
                    : slot.venue,
                },
                { locale },
              )
            }
          />
        </p>
      );
    }
    case 'cancelled':
      return (
        <div className={LINE}>
          <p>{chat_system_cancelled({}, { locale })}</p>
          {notice.params.reason ? (
            <p className="mt-1">
              <IsolatedValue
                value={notice.params.reason}
                message={(reason) =>
                  chat_system_cancel_reason({ reason }, { locale })
                }
              />
            </p>
          ) : null}
        </div>
      );
    default:
      return <p className={LINE}>{chat_system_update({}, { locale })}</p>;
  }
};
