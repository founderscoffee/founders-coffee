import { describe, expect, it } from 'vitest';

import {
  FIRST_STEP,
  isCodeStep,
  nextStep,
  type ContactStep,
} from './contact-flow';

const walk = (from: ContactStep): ContactStep[] => {
  const path: ContactStep[] = [from];
  let step = from;
  while (step !== 'done') {
    step = nextStep(step);
    path.push(step);
  }
  return path;
};

describe('the contact change flow', () => {
  it('proves the address on file before it will name a new one', () => {
    expect(FIRST_STEP.email).toBe('prove-current');
    expect(walk('prove-current')).toEqual([
      'prove-current',
      'new-email',
      'confirm-email',
      'done',
    ]);
  });

  it('asks nothing of an account with no number to protect', () => {
    expect(FIRST_STEP.phone).toBe('new-phone');
    expect(walk('new-phone')).toEqual(['new-phone', 'confirm-phone', 'done']);
  });

  it('stays finished once it is finished', () => {
    expect(nextStep('done')).toBe('done');
  });

  it('knows which steps take a code and which take a contact', () => {
    const codeSteps: ContactStep[] = [
      'prove-current',
      'confirm-email',
      'confirm-phone',
    ];
    const contactSteps: ContactStep[] = ['new-email', 'new-phone', 'done'];

    expect(codeSteps.every((step) => isCodeStep(step))).toBe(true);
    expect(contactSteps.some((step) => isCodeStep(step))).toBe(false);
  });
});
