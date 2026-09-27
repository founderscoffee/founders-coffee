import { list, section, text, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const organizersEnglish: CompanyPageContent = translatedPage(
  'en',
  'Organizer terms',
  'Responsibilities for publishing a gathering: accurate information, venue, safety, attendee lists, and cancellation.',
  [
    section(
      'When these terms apply',
      text(
        'They apply when you publish a gathering on Founders Coffee and supplement the [Terms of use](/terms) and [Community guidelines](/community). Organising here is simple: choose a café, time, and topic. It still carries the responsibilities below.',
      ),
    ),
    section(
      'You are the host',
      text(
        'When you publish, you or the organisation you represent become the **host**. We provide the platform but do not organise the gathering, represent you to attendees, or take responsibility for your promises. The relationship with people who RSVP is yours.',
      ),
    ),
    section(
      'Accurate gathering information',
      text(
        'Your title, topic, venue name and address, date, time, and discussion language must be accurate when published. Update the page quickly when anything changes. If the gathering is for a specific audience, say so openly; transparent audience selection is acceptable, hiding the real purpose is not.',
      ),
    ),
    section(
      'Venue and permissions',
      text(
        'Choosing the venue and agreeing with its owner is your responsibility. Confirm that you may use it at that time and that the expected attendance is acceptable. Follow venue rules and tell attendees what they need to know. If the gathering requires a permit or notice under Algerian regulations, you must obtain it.',
      ),
    ),
    section(
      'Attendee safety',
      text(
        'You run the session. If abusive or dangerous conduct occurs, warn the person, ask them to leave, or end the gathering if needed. Contact the authorities for serious incidents, then tell us so we can act on the account.',
      ),
    ),
    section(
      'Attendee list',
      text(
        'We show you the names of people who RSVP so you know who to expect. **The list is only for organising this gathering.** Do not copy, export, share, or add it to a mailing list or database, or use it for unrelated contact. If you collect extra information at the gathering, tell people that you are collecting it and why; you then become responsible for that data under Law 18-07. Breaching this rule is serious.',
      ),
    ),
    section(
      'Recording attendance',
      text(
        'After the gathering, tell us whether it happened, record who attended, who did not, and how many people arrived without an RSVP. Record what actually happened. People can correct inaccurate attendance data, and your private note about the session is not shown to members.',
      ),
    ),
    section(
      'Contact with attendees',
      text(
        'We send RSVP confirmations, reminders, changes, and cancellations through standard platform messages. You cannot write a custom broadcast through the platform. Put information in the gathering description, and never use the attendee list to market products or services without prior consent.',
      ),
    ),
    section(
      'Changes, postponement, and cancellation',
      text(
        '**Changes:** update the page immediately and we notify attendees. **Postponement:** publish the new date; if there is no replacement, cancel and publish a new gathering later. **Cancellation:** cancel on the platform as soon as you know, with a short reason. Free gatherings create no financial obligation, but repeated last-minute cancellations damage trust and may remove your ability to publish.',
      ),
    ),
    section(
      'Content you upload',
      text(
        'Text, images, and logos on the gathering page must belong to you or be licensed for your use. By using the platform, you grant us a limited licence to display them on the gathering page and related discovery pages as needed to operate the service.',
      ),
    ),
    section(
      'Photography at a gathering',
      text(
        'If you plan to photograph or record, say so in the description and at the start, and respect anyone who asks not to appear. Publishing someone’s image without consent is a rights issue, not merely a matter of taste.',
      ),
    ),
    section('Gatherings we do not accept', [
      ...text(
        'We do not publish gatherings that breach Algerian law or whose purpose is:',
      ),
      list([
        'collecting money or promoting investment schemes, currencies, or guaranteed returns;',
        'selling goods or services whose marketing is prohibited;',
        'charging applicants for recruitment;',
        'a commercial offer disguised as a community gathering;',
        'conduct that harms public order or morality.',
      ]),
    ]),
    section(
      'Paid gatherings',
      text(
        'All gatherings are currently free and the platform has no payment collection feature. Do not ask RSVPs to pay outside the platform. If paid gatherings are introduced later, the ticketing, cancellation, and refund policy will apply after it is announced.',
      ),
    ),
    section(
      'When you have a problem',
      text(
        'Email **contact@founders.coffee** about abusive members, suspicious gatherings, venue disputes, or anything requiring our intervention. We take organizer reports seriously.',
      ),
    ),
    section(
      'What we may do',
      text(
        'We may unpublish a gathering, restrict new publishing, or suspend an account for breaching these terms, the Community guidelines, or the law. Decisions are scoped to the market where the breach occurred; a restriction in one city or country does not automatically apply elsewhere. Contact us if you think a decision is wrong and we will review it.',
      ),
    ),
  ],
);
