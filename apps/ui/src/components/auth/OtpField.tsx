import { login_code_label, type Locale } from '@founders-coffee/i18n';

const OTP_LENGTH = 6;
const BOXES = Array.from({ length: OTP_LENGTH }, (_, index) => index);

type OtpFieldProps = {
  locale: Locale;
  value: string;
  hasError: boolean;
  isDisabled?: boolean;
  onChange: (value: string) => void;
};

export const OtpField = ({
  locale,
  value,
  hasError,
  isDisabled,
  onChange,
}: OtpFieldProps): React.ReactElement => (
  <div className="flex flex-col items-center gap-2">
    <span id="otp-field-label" className="text-label text-neutral">
      {login_code_label({}, { locale })}
    </span>
    <label
      className={`otp otp-lg ${hasError ? 'otp-error' : 'otp-primary'}`}
      dir="ltr"
    >
      {BOXES.map((box) => (
        <span key={box} />
      ))}
      <input
        id="otp-field"
        type="text"
        inputMode="numeric"
        pattern={`[0-9]{${OTP_LENGTH}}`}
        maxLength={OTP_LENGTH}
        autoComplete="one-time-code"
        aria-labelledby="otp-field-label"
        aria-invalid={hasError}
        disabled={isDisabled}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))
        }
        required
      />
    </label>
  </div>
);

export { OTP_LENGTH };
