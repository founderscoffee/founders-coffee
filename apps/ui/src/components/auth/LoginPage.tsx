import {
  brand,
  login_email_continue,
  login_welcome,
  type Locale,
} from '@founders-coffee/i18n';

import { safeAuthReturnPath } from '../../lib/redirect';
import { SignInForm } from './SignInForm';
import type { SocialProvider } from './SocialSignIn';

type LoginPageProps = {
  locale: Locale;
  turnstileSiteKey: string | null;
  isTurnstileBypassed: boolean;
  socialProviders: readonly SocialProvider[];
  redirect: string;
};

export const LoginPage = ({
  locale,
  turnstileSiteKey,
  isTurnstileBypassed,
  socialProviders,
  redirect,
}: LoginPageProps) => (
  <SignInForm
    locale={locale}
    turnstileSiteKey={turnstileSiteKey}
    isTurnstileBypassed={isTurnstileBypassed}
    socialProviders={socialProviders}
    layout="page"
    title={
      <>
        <span className="block">{login_welcome({}, { locale })}</span>
        <span className="block">{brand({}, { locale })}</span>
      </>
    }
    titleLevel="h1"
    emailActionLabel={login_email_continue({}, { locale })}
    showEmailHelp
    showAccountNote
    getSocialRedirect={() => ({
      callbackURL: safeAuthReturnPath(redirect),
    })}
    onAuthenticated={() => {
      window.location.href = safeAuthReturnPath(redirect);
    }}
  />
);
