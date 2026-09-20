import { CONTACT_EMAIL } from '../content/company/contact';

export const SECURITY_TXT_EXPIRES = '2027-06-30T00:00:00Z';

export const SECURITY_TXT_PATH = '/.well-known/security.txt';

/**
 * The vulnerability disclosure contact, as served from a given origin (RFC 9116).
 *
 * `Contact` and `Expires` are the only mandatory fields, and `Expires` must appear exactly
 * once. That second rule is what makes a lapsed date the most common way one of these files
 * is wrong: it is written once, quietly passes its own deadline, and a scanner then treats
 * the whole thing as untrustworthy — leaving a reporter with no address, which is the single
 * failure the file exists to prevent. `security-txt.test.ts` fails sixty days before
 * `SECURITY_TXT_EXPIRES`, deliberately, so the review lands in CI on a known day instead of
 * depending on somebody remembering. Renewing is the whole ritual: confirm the address below
 * is still read by a person, then move the date.
 *
 * The address is imported from the company pages rather than written again, because a
 * security contact that has drifted from the published one fails just as quietly.
 * `Canonical` names where this copy is served rather than where production lives, so a
 * staging deployment describes itself honestly.
 *
 * `Policy` and `Encryption` are absent on purpose. Both are optional, and advertising a
 * disclosure policy nobody has written or a key nobody can decrypt is worse than omitting
 * them: it sends a reporter somewhere that does not answer.
 */
export const securityTxtBody = (origin: string): string =>
  `${[
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    'Preferred-Languages: ar, fr, en',
    `Canonical: ${origin}${SECURITY_TXT_PATH}`,
  ].join('\n')}\n`;
