import { useState } from 'react';

import {
  gate_back,
  gate_title,
  send_code,
  type Locale,
} from '@founders-coffee/i18n';

import { ProfileCompletion } from '../../features/profile/components/ProfileCompletion';
import { useAuth } from '../../lib/app-providers';
import { SignInForm } from '../auth/SignInForm';
import type { SocialProvider } from '../auth/SocialSignIn';

export const HostIdentityGate = (props: {
  locale: Locale;
  turnstileSiteKey: string | null;
  isTurnstileBypassed: boolean;
  socialProviders: readonly SocialProvider[];
  needsReauthentication: boolean;
  onCancel: () => void;
  onAuthenticated: () => void;
}) => {
  const { isAuthenticated } = useAuth();
  const [hasVerified, setHasVerified] = useState(false);
  const getSocialRedirect = () => {
    const here = `${window.location.pathname}${window.location.search}`;
    return { callbackURL: here, newUserCallbackURL: here };
  };

  if ((!isAuthenticated || props.needsReauthentication) && !hasVerified)
    return (
      <SignInForm
        locale={props.locale}
        turnstileSiteKey={props.turnstileSiteKey}
        isTurnstileBypassed={props.isTurnstileBypassed}
        socialProviders={props.socialProviders}
        layout="gate"
        title={gate_title({}, { locale: props.locale })}
        titleLevel="h3"
        emailActionLabel={send_code({}, { locale: props.locale })}
        showEmailHelp={false}
        showAccountNote
        getSocialRedirect={getSocialRedirect}
        onAuthenticated={() => setHasVerified(true)}
        onCancel={props.onCancel}
      />
    );
  return (
    <div className="space-y-4">
      <ProfileCompletion
        locale={props.locale}
        returnPath={`/${props.locale}/profile`}
        onComplete={props.onAuthenticated}
      />
      <button
        type="button"
        className="btn btn-ghost btn-xs sm:btn-sm md:btn-md lg:btn-lg"
        onClick={props.onCancel}
      >
        {gate_back({}, { locale: props.locale })}
      </button>
    </div>
  );
};
