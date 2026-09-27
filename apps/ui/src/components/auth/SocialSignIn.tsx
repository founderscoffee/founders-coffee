import {
  login_or,
  oauth_continue,
  provider_github,
  provider_google,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { PROVIDER_MARK } from './ProviderIcon';

export type SocialProvider = keyof typeof PROVIDER_MARK;

const PROVIDER_LABEL = {
  google: provider_google,
  github: provider_github,
} satisfies Record<SocialProvider, unknown>;

type SocialSignInProps = {
  locale: Locale;
  providers: readonly SocialProvider[];
  isDisabled: boolean;
  onSelect: (provider: SocialProvider) => void;
};

export const SocialSignIn = ({
  locale,
  providers,
  isDisabled,
  onSelect,
}: SocialSignInProps) =>
  providers.length === 0 ? null : (
    <>
      <div className="divider text-caption text-neutral">
        {login_or({}, { locale })}
      </div>
      <div className="space-y-2">
        {providers.map((provider) => {
          const Mark = PROVIDER_MARK[provider];
          return (
            <Button
              key={provider}
              variant="outline"
              onClick={() => onSelect(provider)}
              disabled={isDisabled}
              isFullWidth
            >
              <Mark />
              {oauth_continue(
                { provider: PROVIDER_LABEL[provider]({}, { locale }) },
                { locale },
              )}
            </Button>
          );
        })}
      </div>
    </>
  );
