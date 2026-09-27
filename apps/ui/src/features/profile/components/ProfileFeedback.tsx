import { toast_dismiss, type Locale } from '@founders-coffee/i18n';
import { Toast, type ToastNotice } from '@founders-coffee/ui';

export const ProfileFeedback = ({
  locale,
  notification,
  onDismiss,
}: {
  locale: Locale;
  notification: ToastNotice | null;
  onDismiss: () => void;
}) =>
  notification ? (
    <div className="toast toast-top toast-center z-50 w-full max-w-lg whitespace-normal">
      <Toast
        key={notification.id}
        message={notification.message}
        variant={notification.variant}
        dismissLabel={toast_dismiss({}, { locale })}
        onDismiss={onDismiss}
      />
    </div>
  ) : null;
