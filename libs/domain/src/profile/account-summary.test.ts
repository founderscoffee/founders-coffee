import { describe, expect, it } from 'vitest';

import {
  knownAccountProviders,
  maskEmail,
  maskPhoneNumber,
} from './account-summary.js';

describe('masking an account identifier', () => {
  it.each([
    ['amina@example.dz', 'am•••@example.dz'],
    ['yagoub.2.amine@gmail.com', 'ya•••@gmail.com'],
    ['ab@example.dz', 'a•••@example.dz'],
    ['a@example.dz', 'a•••@example.dz'],
  ])('keeps %s recognisable without reading it out', (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it('does not grow with the address, so the mask cannot be measured', () => {
    expect(maskEmail('amina@example.dz').length).toBe(
      maskEmail('amina.long.name@example.dz').length,
    );
  });

  it('never carries more of the local part than the two leading characters', () => {
    const masked = maskEmail('amina.long.name@example.dz');

    expect(masked.startsWith('am')).toBe(true);
    expect(masked).not.toContain('ina');
    expect(masked).not.toContain('long');
    expect(masked).not.toContain('name');
  });

  it('keeps the domain whole, so two accounts stay distinguishable', () => {
    expect(maskEmail('amina@example.dz')).toContain('@example.dz');
    expect(maskEmail('amina@work.example')).toContain('@work.example');
  });

  it('never returns the address it was given', () => {
    for (const email of ['amina@example.dz', 'a@b.co', 'longer.name@x.dz']) {
      expect(maskEmail(email)).not.toBe(email);
    }
  });

  it('hides a value that is not an address at all rather than echoing it', () => {
    expect(maskEmail('not-an-address')).toBe('••••••••••••••');
    expect(maskEmail('@leading')).toBe('••••••••');
  });

  it('shows a country code and the last digits of a number', () => {
    expect(maskPhoneNumber('+213600000042')).toBe('+213 •••• 42');
    expect(maskPhoneNumber('0600000042')).toBe('•••• 42');
  });

  it('says nothing at all when there is no number on file', () => {
    expect(maskPhoneNumber(null)).toBeNull();
  });

  it('never returns the number it was given', () => {
    expect(maskPhoneNumber('+213600000042')).not.toContain('600000');
    expect(maskPhoneNumber('12')).toBe('••••');
  });
});

describe('provider list', () => {
  it('keeps the providers this product knows, once each', () => {
    expect(
      knownAccountProviders(['google', 'github', 'google', 'email']),
    ).toEqual(['google', 'github', 'email']);
  });

  it('drops an identifier it does not recognise rather than rendering it', () => {
    expect(knownAccountProviders(['credential', 'saml', 'google'])).toEqual([
      'google',
    ]);
    expect(knownAccountProviders([])).toEqual([]);
  });
});
