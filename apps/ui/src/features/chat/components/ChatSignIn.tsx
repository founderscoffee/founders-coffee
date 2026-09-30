import { Link, useLocation } from '@tanstack/react-router';

import { chat_signed_out, sign_in, type Locale } from '@founders-coffee/i18n';

import { localizedLogin } from '../../../lib/locale-routing';

type ChatSignInProps = {
  locale: Locale;
};

export const ChatSignIn = ({ locale }: ChatSignInProps) => {
  const here = useLocation({ select: (location) => location.href });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="max-w-prose text-body text-neutral">
        {chat_signed_out({}, { locale })}
      </p>
      <Link
        {...localizedLogin(locale)}
        search={{ redirect: here }}
        className="btn btn-primary btn-xs sm:btn-sm md:btn-md"
      >
        {sign_in({}, { locale })}
      </Link>
    </div>
  );
};
