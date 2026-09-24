import { useState } from 'react';

import {
  devices_empty,
  devices_note,
  devices_sign_out,
  devices_sign_out_others,
  devices_this_one,
  providers_disconnect,
  providers_keep_one,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, StatusMessage } from '@founders-coffee/ui';

import { contactErrorMessage } from '../contact-errors';
import { describeDevice } from '../device-name';
import { useMyDevices, useRevokeDevice, useUnlinkProvider } from '../hooks';
import { AccountRow } from './AccountRow';
import { ProviderIdentity } from './ProviderIdentity';

export const DevicePanel = ({ locale }: { locale: Locale }) => {
  const devices = useMyDevices();
  const revoke = useRevokeDevice();
  const unlink = useUnlinkProvider();
  const [error, setError] = useState<string | null>(null);
  const busy = revoke.isPending || unlink.isPending;

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(contactErrorMessage(failure, locale));
    }
  };

  if (!devices.data) return null;
  const others = devices.data.sessions.filter((row) => !row.isCurrent);

  return (
    <div>
      {devices.data.providers.map((provider) => (
        <AccountRow
          key={provider}
          label={<ProviderIdentity locale={locale} provider={provider} />}
          note={providers_keep_one({}, { locale })}
          status={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(() => unlink.mutateAsync({ providerId: provider }))
              }
            >
              {providers_disconnect({}, { locale })}
            </Button>
          }
        />
      ))}

      {devices.data.sessions.map((row) => (
        <AccountRow
          key={row.id}
          label={describeDevice(row.userAgent, locale)}
          note={row.isCurrent ? devices_this_one({}, { locale }) : undefined}
          status={
            row.isCurrent ? undefined : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(() => revoke.mutateAsync({ sessionId: row.id }))
                }
              >
                {devices_sign_out({}, { locale })}
              </Button>
            )
          }
        />
      ))}

      <p className="mt-3 text-caption text-neutral">
        {devices_note({}, { locale })}
      </p>
      {error && (
        <StatusMessage variant="error" className="mt-2">
          {error}
        </StatusMessage>
      )}
      {others.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={() =>
            void run(() => revoke.mutateAsync({ othersOnly: true }))
          }
        >
          {devices_sign_out_others({}, { locale })}
        </Button>
      ) : (
        <p className="mt-3 text-body-sm text-neutral">
          {devices_empty({}, { locale })}
        </p>
      )}
    </div>
  );
};
