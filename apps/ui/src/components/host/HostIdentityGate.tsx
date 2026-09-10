import { useState } from 'react';

import { gate_back, type Locale } from '@founders-coffee/i18n';

import { ProfileCompletion } from '../../features/profile/components/ProfileCompletion';
import { useAuth } from '../../lib/app-providers';
import { HostSignInGate } from './HostSignInGate';

export const HostIdentityGate = (props: {
  locale: Locale;
  turnstileSiteKey: string | null;
  hasSocial: boolean;
  needsReauthentication: boolean;
  onCancel: () => void;
  onAuthenticated: () => void;
}) => {
  const { isAuthenticated } = useAuth();
  const [hasVerified, setHasVerified] = useState(false);
  if ((!isAuthenticated || props.needsReauthentication) && !hasVerified)
    return (
      <HostSignInGate {...props} onAuthenticated={() => setHasVerified(true)} />
    );
  return (
    <div className="space-y-4">
      <ProfileCompletion
        locale={props.locale}
        returnPath="/profile"
        onComplete={props.onAuthenticated}
      />
      <button type="button" className="btn btn-ghost" onClick={props.onCancel}>
        {gate_back({}, { locale: props.locale })}
      </button>
    </div>
  );
};
