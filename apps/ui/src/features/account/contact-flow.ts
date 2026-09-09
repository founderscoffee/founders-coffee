export type ContactKind = 'email' | 'phone';

export type ContactStep =
  | 'prove-current'
  | 'new-email'
  | 'confirm-email'
  | 'new-phone'
  | 'confirm-phone'
  | 'done';

export const FIRST_STEP: Record<ContactKind, ContactStep> = {
  email: 'prove-current',
  phone: 'new-phone',
};

/**
 * Where a contact change goes next, once the step it is on succeeds.
 *
 * Changing an address takes three steps and adding a number takes two, and the difference is not
 * arbitrary: an email already on the account is the thing an attacker would move first, so it costs
 * a code sent to the address currently on file before a new one is even named. A phone that does
 * not exist yet has nothing to protect, so proving the new number is the whole of it.
 *
 * Written as a table rather than as conditionals inside the component, so the order is something
 * that can be read and tested rather than inferred from which branch renders which field.
 */
export const nextStep = (step: ContactStep): ContactStep =>
  ({
    'prove-current': 'new-email',
    'new-email': 'confirm-email',
    'confirm-email': 'done',
    'new-phone': 'confirm-phone',
    'confirm-phone': 'done',
    done: 'done',
  })[step] as ContactStep;

/** Whether this step asks for a six-digit code rather than a contact detail. */
export const isCodeStep = (step: ContactStep): boolean =>
  step === 'prove-current' ||
  step === 'confirm-email' ||
  step === 'confirm-phone';
