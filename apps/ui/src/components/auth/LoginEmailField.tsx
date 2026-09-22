import {
  login_email_label,
  login_email_placeholder,
  login_help,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

export const LoginEmailField = ({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: string;
  onChange: (next: string) => void;
}) => (
  <div className="form-control">
    <label className="mb-1 block text-label text-neutral" htmlFor="login-email">
      {login_email_label({}, { locale })}
    </label>
    <Input
      id="login-email"
      type="email"
      autoComplete="email"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={login_email_placeholder({}, { locale })}
      aria-describedby="login-email-help"
    />
    <span
      id="login-email-help"
      className="mt-1.5 block text-body-sm text-neutral"
    >
      {login_help({}, { locale })}
    </span>
  </div>
);
