import { useState, type FormEvent } from 'react';

import {
  contact_cancel,
  contact_code_label,
  contact_continue,
  contact_email_done,
  contact_email_title,
  contact_locked_out,
  contact_new_email_label,
  contact_old_kept,
  contact_phone_done,
  contact_phone_label,
  contact_phone_title,
  contact_sent,
  contact_step_confirm_email,
  contact_step_confirm_phone,
  contact_step_new_email,
  contact_step_phone,
  contact_step_prove,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Input } from '@founders-coffee/ui';

import { contactErrorMessage } from '../contact-errors';
import {
  useConfirmEmailChange,
  useConfirmPhoneNumber,
  useRequestEmailChange,
  useSendEmailChangeCode,
  useSendPhoneCode,
} from '../contact-hooks';
import {
  FIRST_STEP,
  isCodeStep,
  nextStep,
  type ContactKind,
  type ContactStep,
} from '../contact-flow';

export const ContactDialog = ({
  locale,
  kind,
  onClose,
}: {
  locale: Locale;
  kind: ContactKind;
  onClose: () => void;
}) => {
  const [step, setStep] = useState<ContactStep>(FIRST_STEP[kind]);
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendEmailCode = useSendEmailChangeCode();
  const requestEmail = useRequestEmailChange();
  const confirmEmail = useConfirmEmailChange();
  const sendPhone = useSendPhoneCode();
  const confirmPhone = useConfirmPhoneNumber();
  const busy =
    sendEmailCode.isPending ||
    requestEmail.isPending ||
    confirmEmail.isPending ||
    sendPhone.isPending ||
    confirmPhone.isPending;

  const prompt = {
    'prove-current': contact_step_prove,
    'new-email': contact_step_new_email,
    'confirm-email': contact_step_confirm_email,
    'new-phone': contact_step_phone,
    'confirm-phone': contact_step_confirm_phone,
    done: kind === 'email' ? contact_email_done : contact_phone_done,
  }[step];

  const advance = async (): Promise<void> => {
    if (step === 'prove-current') {
      await sendEmailCode.mutateAsync(undefined);
      return;
    }
    if (step === 'new-email') {
      await requestEmail.mutateAsync({
        newEmail: contact,
        otp: code,
      });
      setNotice(contact_sent({}, { locale }));
      return;
    }
    if (step === 'confirm-email') {
      await confirmEmail.mutateAsync({
        newEmail: contact,
        otp: code,
      });
      return;
    }
    if (step === 'new-phone') {
      await sendPhone.mutateAsync({ phoneNumber: contact });
      return;
    }
    await confirmPhone.mutateAsync({
      phoneNumber: contact,
      otp: code,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || step === 'done') return;
    setError(null);
    try {
      await advance();
      setStep(step === 'prove-current' ? 'new-email' : nextStep(step));
      if (step !== 'prove-current') setCode('');
    } catch (failure) {
      setError(contactErrorMessage(failure, locale));
    }
  };

  const title =
    kind === 'email'
      ? contact_email_title({}, { locale })
      : contact_phone_title({}, { locale });

  return (
    <dialog open className="modal modal-open" aria-label={title}>
      <form
        method="dialog"
        className="modal-box"
        onSubmit={(event) => void submit(event)}
      >
        <h3 className="font-display text-h4">{title}</h3>
        <p className="mt-2 text-body-sm text-neutral">
          {prompt({}, { locale })}
        </p>
        {step === 'prove-current' && (
          <p className="mt-1 text-caption text-neutral">
            {contact_old_kept({}, { locale })}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-2 text-body-sm text-neutral">
            {notice}
          </p>
        )}

        {step !== 'done' && (step === 'new-email' || step === 'new-phone') && (
          <Input
            className="mt-4 w-full"
            type={kind === 'email' ? 'email' : 'tel'}
            dir="ltr"
            value={contact}
            disabled={busy}
            aria-label={
              kind === 'email'
                ? contact_new_email_label({}, { locale })
                : contact_phone_label({}, { locale })
            }
            onChange={(event) => setContact(event.target.value)}
          />
        )}
        {step !== 'done' && isCodeStep(step) && step !== 'prove-current' && (
          <Input
            className="mt-4 w-full"
            inputMode="numeric"
            dir="ltr"
            value={code}
            disabled={busy}
            aria-label={contact_code_label({}, { locale })}
            onChange={(event) => setCode(event.target.value)}
          />
        )}
        {step === 'new-email' && (
          <Input
            className="mt-3 w-full"
            inputMode="numeric"
            dir="ltr"
            value={code}
            disabled={busy}
            aria-label={contact_code_label({}, { locale })}
            onChange={(event) => setCode(event.target.value)}
          />
        )}

        {error && (
          <p role="alert" className="mt-3 text-body-sm text-error">
            {error}
          </p>
        )}
        {kind === 'email' && step !== 'done' && (
          <p className="mt-3 text-caption text-neutral">
            {contact_locked_out({}, { locale })}
          </p>
        )}

        <div className="modal-action">
          {step !== 'done' && (
            <Button type="submit" disabled={busy}>
              {contact_continue({}, { locale })}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            {contact_cancel({}, { locale })}
          </Button>
        </div>
      </form>
    </dialog>
  );
};
