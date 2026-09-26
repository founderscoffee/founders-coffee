import { offline_notice, type Locale } from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import { useOnlineStatus } from '../../lib/network-status';

type OfflineNoticeProps = { locale: Locale };

export const OfflineNotice = ({ locale }: OfflineNoticeProps) => {
  const isOnline = useOnlineStatus();

  return (
    <StatusMessage
      variant="warning"
      className="grid-cols-[auto_auto] justify-center rounded-none border-x-0 border-b-0 px-4 py-1.5 md:px-8"
    >
      {isOnline ? null : offline_notice({}, { locale })}
    </StatusMessage>
  );
};
