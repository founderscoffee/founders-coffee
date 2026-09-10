import {
  profile_security_error,
  profile_retry,
  toast_dismiss,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Toast, type ToastMessage } from '@founders-coffee/ui';

export const ProfileFeedback = ({
  locale,
  notification,
  onDismiss,
  hasSecurityError = false,
  onRetry,
}: {
  locale: Locale;
  notification: ToastMessage | null;
  onDismiss: () => void;
  hasSecurityError?: boolean;
  onRetry?: () => void;
}) =>
  notification || hasSecurityError ? (
    <div className="toast toast-top toast-center z-50 w-full max-w-lg whitespace-normal">
      {notification && (
        <Toast
          {...notification}
          dismissLabel={toast_dismiss({}, { locale })}
          onDismiss={onDismiss}
        />
      )}
      {hasSecurityError && (
        <Toast variant="error" message={profile_security_error({}, { locale })}>
          <Button
            type="button"
            variant="ghost"
            className="text-inherit"
            onClick={onRetry}
          >
            {profile_retry({}, { locale })}
          </Button>
        </Toast>
      )}
    </div>
  ) : null;
