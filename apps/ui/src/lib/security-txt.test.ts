import { describe, expect, it } from 'vitest';

import { CONTACT_EMAIL } from '../content/company/contact';

import {
  SECURITY_TXT_EXPIRES,
  SECURITY_TXT_PATH,
  securityTxtBody,
} from './security-txt';

const DAY = 86_400_000;
const body = securityTxtBody('https://founders.coffee');
const fieldsNamed = (name: string) =>
  body.split('\n').filter((line) => line.startsWith(`${name}:`));

describe('security.txt satisfies RFC 9116', () => {
  it('carries the two mandatory fields', () => {
    expect(fieldsNamed('Contact').length).toBeGreaterThanOrEqual(1);
    expect(
      fieldsNamed('Expires'),
      'Expires must always be present and must not appear more than once',
    ).toHaveLength(1);
  });

  it.each(['Expires', 'Preferred-Languages', 'Canonical'])(
    'states %s no more than once',
    (name) => {
      expect(fieldsNamed(name).length).toBeLessThanOrEqual(1);
    },
  );

  it('dates Expires as an RFC 3339 timestamp', () => {
    expect(SECURITY_TXT_EXPIRES).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/u,
    );
    expect(Number.isNaN(Date.parse(SECURITY_TXT_EXPIRES))).toBe(false);
  });

  it('points Canonical at wherever this copy is served', () => {
    expect(securityTxtBody('https://staging.example.dev')).toContain(
      `Canonical: https://staging.example.dev${SECURITY_TXT_PATH}`,
    );
  });

  it('gives the address the company pages actually publish', () => {
    expect(
      body,
      'a security contact that has drifted from the published one is the failure this file exists to prevent',
    ).toContain(`Contact: mailto:${CONTACT_EMAIL}`);
  });

  it('promises no disclosure policy or key that does not exist', () => {
    expect(fieldsNamed('Policy')).toHaveLength(0);
    expect(fieldsNamed('Encryption')).toHaveLength(0);
  });
});

describe('security.txt has not been left to go stale', () => {
  it('is more than sixty days from expiring', () => {
    const daysLeft = (Date.parse(SECURITY_TXT_EXPIRES) - Date.now()) / DAY;

    expect(
      daysLeft,
      `SECURITY_TXT_EXPIRES is ${Math.round(daysLeft)} days away. This failure is deliberate: confirm ${CONTACT_EMAIL} is still read by a person, then move the date in security-txt.ts. A lapsed Expires makes the whole file untrustworthy to a scanner and leaves a reporter with no address.`,
    ).toBeGreaterThan(60);
  });

  it('stays inside the year the specification asks for', () => {
    const daysLeft = (Date.parse(SECURITY_TXT_EXPIRES) - Date.now()) / DAY;

    expect(
      daysLeft,
      'RFC 9116 asks that Expires be less than a year out, so a far-future date to dodge the renewal is not a fix',
    ).toBeLessThan(366);
  });
});
