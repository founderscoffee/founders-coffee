import { chat_load_error, retry, type Locale } from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

type ChatLoadFailureProps = {
  locale: Locale;
  onRetry: () => void;
};

export const ChatLoadFailure = ({ locale, onRetry }: ChatLoadFailureProps) => (
  <div className="m-auto p-4">
    <StatusMessage
      variant="error"
      action={
        <button
          type="button"
          className="btn btn-ghost btn-xs sm:btn-sm md:btn-md"
          onClick={onRetry}
        >
          {retry({}, { locale })}
        </button>
      }
    >
      {chat_load_error({}, { locale })}
    </StatusMessage>
  </div>
);
