import { offline_notice, type Locale } from '@founders-coffee/i18n';

import { useOnlineStatus } from '../../lib/network-status';

type OfflineNoticeProps = { locale: Locale };

export const OfflineNotice = ({ locale }: OfflineNoticeProps) => {
  const isOnline = useOnlineStatus();

  return (
    <div role="status">
      {isOnline ? null : (
        <p className="border-t border-warning/25 bg-warning-tint px-4 py-1.5 text-center text-body-sm text-warning md:px-8">
          {offline_notice({}, { locale })}
        </p>
      )}
    </div>
  );
};
