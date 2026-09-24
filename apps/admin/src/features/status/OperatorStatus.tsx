import {
  loading,
  permissions,
  role,
  sign_out,
  signed_in_as,
  title,
  unavailable,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

import { authClient } from '../../lib/auth';
import type { OperatorStatus as Status } from './api';

export const OperatorStatus = ({
  locale,
  status,
  isError,
}: {
  locale: Locale;
  status: Status | undefined;
  isError: boolean;
}) => {
  if (isError)
    return (
      <StatusMessage variant="error">
        {unavailable({}, { locale })}
      </StatusMessage>
    );

  if (!status) return <LoadingStatus label={loading({}, { locale })} />;

  return (
    <div className="space-y-6">
      <section className="rounded-box border border-base-300 p-5">
        <h2 className="text-caption text-neutral">
          {signed_in_as({}, { locale })}
        </h2>
        <p className="mt-1 font-medium" dir="ltr">
          {status.email}
        </p>
        <p className="mt-3 text-caption text-neutral">
          {role({}, { locale })}
        </p>
        <p className="mt-1 font-medium">{status.role}</p>
      </section>

      <section className="rounded-box border border-base-300 p-5">
        <h2 className="text-caption text-neutral">
          {permissions({}, { locale })}
        </h2>
        <ul className="mt-2 space-y-1">
          {status.permissions.map((permission) => (
            <li className="font-mono text-body-sm" dir="ltr" key={permission}>
              {permission}
            </li>
          ))}
        </ul>
      </section>

      <button
        className="btn btn-outline btn-sm"
        type="button"
        onClick={() => {
          void authClient
            .signOut()
            .then(() => window.location.assign('/login'));
        }}
      >
        {sign_out({}, { locale })}
      </button>

      <p className="sr-only">{title({}, { locale })}</p>
    </div>
  );
};
